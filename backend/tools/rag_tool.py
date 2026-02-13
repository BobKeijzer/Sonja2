"""
RAG-tool over de knowledge-directory: Chroma (lokaal) + VoyageAI embeddings (1024 dim, voyage-4).

Bij refresh_rag_tool() (of POST /knowledge/refresh): chroma_db wordt volledig geleegd,
daarna opnieuw gevuld vanuit de actuele knowledge/-folder. Verwijderde bestanden
verdwijnen daarmee uit de vector index.

Env: VOYAGEAI_API_KEY (verplicht voor RAG). Optioneel: VOYAGEAI_EMBEDDING_MODEL.
"""

import os
import shutil
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from crewai_tools import RagTool
from crewai_tools.tools.rag import RagToolConfig, VectorDbConfig
from pydantic import BaseModel, Field

_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
_MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"
_CHROMA_PERSIST_DIR = Path(__file__).resolve().parent.parent / "chroma_db"
_COLLECTION_NAME = "sonja_knowledge"

# Huidige RAG-tool-instantie; wordt vervangen bij refresh (wrapper blijft dezelfde)
_rag_tool_inner = None


def _clear_chroma_store() -> None:
    """Wis de hele chroma_db-map zodat de vector index echt leeg is (geen resten van verwijderde bestanden)."""
    if _CHROMA_PERSIST_DIR.exists():
        try:
            shutil.rmtree(_CHROMA_PERSIST_DIR)
        except OSError:
            pass
    _CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)


def _get_config() -> RagToolConfig | None:
    """Chroma + VoyageAI voyage-4, 1024 dim (standaard). None als geen VOYAGEAI_API_KEY."""
    voyage_key = os.getenv("VOYAGEAI_API_KEY", "").strip()
    if not voyage_key:
        return None
    _CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    vectordb: VectorDbConfig = {
        "provider": "chromadb",
        "config": {"persist_directory": str(_CHROMA_PERSIST_DIR)},
    }
    embedding_model = {
        "provider": "voyageai",
        "config": {
            "api_key": voyage_key,
            "model": os.getenv("VOYAGEAI_EMBEDDING_MODEL", "voyage-4"),
            "output_dimension": 1024,
        },
    }
    return {
        "vectordb": vectordb,
        "embedding_model": embedding_model,
    }


def _make_rag_tool() -> RagTool:
    """Leeg chroma_db, bouw RagTool en vul opnieuw vanuit knowledge/."""
    config = _get_config()
    if not config:
        tool = RagTool(summarize=True)
    else:
        _clear_chroma_store()
        tool = RagTool(
            config=config,
            summarize=True,
            collection_name=_COLLECTION_NAME,
        )
    import time
    import warnings
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            if _KNOWLEDGE_DIR.is_dir():
                tool.add(data_type="directory", path=str(_KNOWLEDGE_DIR))
            if _MEMORY_DIR.is_dir():
                tool.add(data_type="directory", path=str(_MEMORY_DIR))
            last_err = None
            break
        except Exception as e:
            last_err = e
            if attempt < 2:
                time.sleep(2)
            else:
                warnings.warn(
                    f"RAG add directory failed (VoyageAI/Chroma). Controleer VOYAGEAI_API_KEY. Fout: {e}",
                    stacklevel=0,
                )
                break
    return tool


def refresh_rag_tool() -> None:
    """Herbouw de RAG-index: wis chroma_db volledig en vul opnieuw vanuit knowledge/ en memory/."""
    global _rag_tool_inner
    _clear_chroma_store()
    _rag_tool_inner = _make_rag_tool()


# Eerste keer: vul index (bij refresh wordt chroma_db gewist en opnieuw gevuld)
_rag_tool_inner = _make_rag_tool()


class _RagQueryInput(BaseModel):
    query: str = Field(description="Zoekvraag voor semantisch zoeken in de knowledge base.")


class _RefreshableRagTool(BaseTool):
    """Wrapper rond de echte RagTool zodat refresh_rag_tool() de inner tool vervangt."""
    name: str = "rag_search"
    description: str = (
        "Semantisch zoeken in de knowledge base (knowledge/) en herinneringen (memory/). "
        "Gebruik wanneer je relevante informatie wilt vinden zonder een heel bestand te lezen. "
        "Geef een zoekvraag op."
    )
    args_schema: Type[BaseModel] = _RagQueryInput

    def _run(self, query: str) -> str:
        return _rag_tool_inner._run(query)


rag_tool = _RefreshableRagTool()