"""
Custom RAG: Qdrant (één collection) + Voyage embeddings.

- Kennis (knowledge/): bestanden gechunkt (~3000 tekens, overlap 200), metadata = filename.
- Geheugen (memory/): 1 vector per herinnering, metadata = filename, date (ISO), title (uit bestandsnaam).

Qdrant moet draaien voordat je de zoekindex vernieuwt of RAG gebruikt. Start bijvoorbeeld in een terminal:
  docker run -p 6333:6333 qdrant/qdrant
(Backend kan gewoon lokaal draaien; alleen de vectordb draait in de container.)

Env: VOYAGEAI_API_KEY, QDRANT_URL (default http://localhost:6333).
"""

import logging
import os
import re
import uuid
from pathlib import Path
from typing import Iterator, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
_MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"
_COLLECTION_NAME = "sonja_rag"
_VECTOR_SIZE = 1024

_CHUNK_SIZE = 3000
_CHUNK_OVERLAP = 200
_RAG_EXTENSIONS = (".md", ".txt")

# Search: max aantal resultaten en minimale similarity (cosine) om mee te nemen
_SEARCH_LIMIT = 10
_SIMILARITY_THRESHOLD = 0.5

# ─── Config ───────────────────────────────────────────────────────────────────


def _qdrant_url() -> str:
    return os.getenv("QDRANT_URL", "http://localhost:6333").strip()


def _voyage_api_key() -> str:
    return os.getenv("VOYAGEAI_API_KEY", "").strip()


def _is_configured() -> bool:
    return bool(_voyage_api_key()) and bool(_qdrant_url())


# ─── Chunking & metadata ─────────────────────────────────────────────────────


def _chunk_text(text: str) -> list[str]:
    """Grof chunken op karakterbasis: chunk_size tekens, overlap tekens."""
    if not text or not text.strip():
        return []
    text = text.strip()
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + _CHUNK_SIZE, len(text))
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        start = end - _CHUNK_OVERLAP if end < len(text) else len(text)
    return chunks


def _parse_memory_filename(filename: str) -> tuple[str, str]:
    """Uit bestandsnaam DD-MM-YYYY_HH-MM_slug.md → (date_iso, title). Title = slug."""
    # DD-MM-YYYY_HH-MM_slug.md
    base = Path(filename).stem
    parts = base.split("_")
    date_iso = ""
    if len(parts) >= 1 and re.match(r"\d{2}-\d{2}-\d{4}", parts[0]):
        d, m, y = parts[0].split("-")
        date_iso = f"{y}-{m}-{d}"
    title = parts[2] if len(parts) >= 3 else base
    title = title.replace("-", " ").strip()
    return date_iso, title or base


def _iter_rag_files(dir_path: Path) -> Iterator[Path]:
    if not dir_path.is_dir():
        return
    for root, dirs, files in os.walk(dir_path):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            if name.startswith("."):
                continue
            if Path(name).suffix.lower() in _RAG_EXTENSIONS:
                yield Path(root) / name


# ─── Embedding ───────────────────────────────────────────────────────────────


def _embed(texts: list[str], input_type: str = "document") -> list[list[float]]:
    if not texts:
        return []
    try:
        import voyageai
    except ImportError:
        raise RuntimeError("voyageai niet geïnstalleerd")
    api_key = _voyage_api_key()
    if not api_key:
        raise RuntimeError("VOYAGEAI_API_KEY niet gezet")
    vo = voyageai.Client(api_key=api_key)
    model = os.getenv("VOYAGEAI_EMBEDDING_MODEL", "voyage-4")
    out = vo.embed(texts, model=model, input_type=input_type)
    return getattr(out, "embeddings", out) if hasattr(out, "embeddings") else list(out)


# ─── Qdrant ──────────────────────────────────────────────────────────────────


def _get_client():
    from qdrant_client import QdrantClient
    return QdrantClient(url=_qdrant_url())


def _ensure_collection(client) -> None:
    from qdrant_client.models import Distance, VectorParams
    collections = client.get_collections().collections
    names = [c.name for c in collections]
    if _COLLECTION_NAME not in names:
        client.create_collection(
            collection_name=_COLLECTION_NAME,
            vectors_config=VectorParams(size=_VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("RAG: Qdrant collection aangemaakt: %s", _COLLECTION_NAME)


def _delete_by_filename_and_type(client, filename: str, doc_type: str) -> None:
    from qdrant_client.models import FieldCondition, Filter, MatchValue, FilterSelector
    client.delete(
        collection_name=_COLLECTION_NAME,
        points_selector=FilterSelector(
            filter=Filter(
                must=[
                    FieldCondition(key="type", match=MatchValue(value=doc_type)),
                    FieldCondition(key="filename", match=MatchValue(value=filename)),
                ]
            )
        ),
    )


def _memory_point_id(filename: str) -> str:
    """Stable UUID voor één herinnering zodat upsert overschrijft. Qdrant accepteert alleen UUID of integer."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sonja.memory.{filename}"))


def _knowledge_point_id(file_path: str, chunk_index: int) -> str:
    """Stable UUID per kennis-chunk. Qdrant accepteert alleen UUID of integer."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sonja.knowledge.{file_path}:{chunk_index}"))


# ─── Indexeren ───────────────────────────────────────────────────────────────


def _index_knowledge_file(client, path: Path) -> int:
    """Chunk bestand, embed, upsert. Retourneert aantal chunks."""
    path_str = str(path.resolve())
    filename = path.name
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.warning("RAG: kon kennisbestand niet lezen %s: %s", path, e)
        return 0
    chunks = _chunk_text(text)
    if not chunks:
        return 0
    vectors = _embed(chunks, input_type="document")
    from qdrant_client.models import PointStruct
    points = [
        PointStruct(
            id=_knowledge_point_id(path_str, i),
            vector=vec,
            payload={
                "type": "knowledge",
                "filename": filename,
                "content": chunk,
                "chunk_index": i,
            },
        )
        for i, (chunk, vec) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=_COLLECTION_NAME, points=points)
    logger.info("RAG: kennis geïndexeerd: %s (%d chunks)", filename, len(points))
    return len(points)


def _index_memory_file(client, path: Path) -> bool:
    """Eén vector per herinnering; metadata date (ISO) en title uit bestandsnaam."""
    filename = path.name
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.warning("RAG: kon memory niet lezen %s: %s", path, e)
        return False
    date_iso, title = _parse_memory_filename(filename)
    vectors = _embed([content], input_type="document")
    from qdrant_client.models import PointStruct
    point = PointStruct(
        id=_memory_point_id(filename),
        vector=vectors[0],
        payload={
            "type": "memory",
            "filename": filename,
            "date": date_iso,
            "title": title,
            "content": content,
        },
    )
    client.upsert(collection_name=_COLLECTION_NAME, points=[point])
    logger.info("RAG: herinnering geïndexeerd: %s (datum %s)", filename, date_iso)
    return True


def _path_is_memory(path: Path) -> bool:
    try:
        path = path.resolve()
        return _MEMORY_DIR in path.parents or path.parent == _MEMORY_DIR
    except Exception:
        return False


# ─── Search ──────────────────────────────────────────────────────────────────


def _search(query: str, limit: int | None = None) -> list[dict]:
    """Semantisch zoeken; retourneert lijst met content, filename, en voor memory ook date, title."""
    if not _is_configured():
        return []
    try:
        client = _get_client()
    except Exception as e:
        logger.warning("RAG: Qdrant niet bereikbaar: %s", e)
        return []
    _ensure_collection(client)
    q_vecs = _embed([query], input_type="query")
    search_limit = limit if limit is not None else _SEARCH_LIMIT
    hits = client.search(
        collection_name=_COLLECTION_NAME,
        query_vector=q_vecs[0],
        limit=search_limit,
        score_threshold=_SIMILARITY_THRESHOLD,
        with_payload=True,
    )
    out = []
    for h in hits:
        p = h.payload or {}
        out.append({
            "content": p.get("content", ""),
            "filename": p.get("filename", ""),
            "date": p.get("date"),
            "title": p.get("title"),
            "type": p.get("type", ""),
        })
    return out


def _format_search_result(r: dict) -> str:
    """Eén resultaat als leesbare tekst; Sonja kan zien uit welk bestand het komt."""
    fn = r.get("filename", "")
    content = (r.get("content") or "").strip()
    if r.get("type") == "memory" and r.get("date"):
        return f"[Bestand: {fn} | datum: {r['date']}]\n{content}"
    return f"[Bestand: {fn}]\n{content}"


# ─── Publieke API (zelfde als voorheen) ──────────────────────────────────────


def refresh_rag_tool() -> tuple[bool, str]:
    """Volledige herbouw: wis alle punten in de collection en indexeer knowledge/ en memory/ opnieuw.
    Retourneert (success, message) zodat de API 503 kan geven als Qdrant niet bereikbaar is."""
    if not _is_configured():
        msg = "RAG: refresh overgeslagen (QDRANT_URL of VOYAGEAI_API_KEY niet gezet)"
        logger.info(msg)
        return False, msg
    try:
        client = _get_client()
        from qdrant_client.models import VectorParams, Distance
        try:
            client.delete_collection(_COLLECTION_NAME)
        except Exception:
            pass
        client.create_collection(
            collection_name=_COLLECTION_NAME,
            vectors_config=VectorParams(size=_VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("RAG: collection geleegd, opnieuw opbouwen...")
        k_count, m_count = 0, 0
        for path in _iter_rag_files(_KNOWLEDGE_DIR):
            k_count += _index_knowledge_file(client, path)
        for path in _iter_rag_files(_MEMORY_DIR):
            if _index_memory_file(client, path):
                m_count += 1
        logger.info("RAG: refresh klaar — %d kennis-chunks, %d herinneringen", k_count, m_count)
        return True, f"RAG-index opnieuw opgebouwd ({k_count} kennis-chunks, {m_count} herinneringen)."
    except Exception as e:
        logger.warning("RAG: refresh mislukt: %s", e)
        return False, (
            "Qdrant is niet bereikbaar. Start Qdrant (bijv. in een terminal: "
            "docker run -p 6333:6333 qdrant/qdrant) en probeer opnieuw."
        )


def rag_add_file(path: Path | str) -> None:
    """Eén bestand toevoegen of bijwerken in de vectordb (incrementeel)."""
    path = Path(path).resolve()
    if path.suffix.lower() not in _RAG_EXTENSIONS:
        logger.debug("RAG: bestand genegeerd (geen .md/.txt): %s", path.name)
        return
    if not _is_configured():
        logger.debug("RAG: add overgeslagen (niet geconfigureerd)")
        return
    try:
        client = _get_client()
    except Exception as e:
        logger.warning("RAG: add mislukt voor %s: %s", path.name, e)
        return
    _ensure_collection(client)
    filename = path.name
    if _path_is_memory(path):
        _delete_by_filename_and_type(client, filename, "memory")
        _index_memory_file(client, path)
    else:
        _delete_by_filename_and_type(client, filename, "knowledge")
        _index_knowledge_file(client, path)


def rag_remove_file(path: Path | str) -> None:
    """Eén bestand uit de vectordb verwijderen (incrementeel)."""
    path = Path(path).resolve()
    filename = path.name
    if not _is_configured():
        logger.debug("RAG: remove overgeslagen (niet geconfigureerd)")
        return
    try:
        client = _get_client()
    except Exception as e:
        logger.warning("RAG: remove mislukt voor %s: %s", filename, e)
        return
    if _path_is_memory(path):
        _delete_by_filename_and_type(client, filename, "memory")
        logger.info("RAG: herinnering uit index verwijderd: %s", filename)
    else:
        _delete_by_filename_and_type(client, filename, "knowledge")
        logger.info("RAG: kennis uit index verwijderd: %s", filename)


# ─── CrewAI-tool wrapper ────────────────────────────────────────────────────


class _RagQueryInput(BaseModel):
    query: str = Field(description="Zoekvraag voor semantisch zoeken in de knowledge base en herinneringen.")


class _RagTool(BaseTool):
    name: str = "rag_search"
    description: str = (
        "Semantisch zoeken in de knowledge base (knowledge/) en herinneringen (memory/). "
        "Gebruik wanneer je relevante informatie wilt vinden. Geef een zoekvraag op."
    )
    args_schema: Type[BaseModel] = _RagQueryInput

    def _run(self, query: str) -> str:
        if not query or not query.strip():
            return "Geen zoekvraag opgegeven."
        results = _search(query.strip())
        if not results:
            return "Geen relevante stukken gevonden. Controleer of de zoekindex is ververst (knop bij Kennis/Geheugen)."
        return "\n\n---\n\n".join(_format_search_result(r) for r in results)


rag_tool = _RagTool()
