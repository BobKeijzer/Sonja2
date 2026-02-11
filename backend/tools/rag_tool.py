"""
RAG-tool over de knowledge-directory: vector search op alle bestanden in knowledge/.

Gebruik wanneer je semantisch wilt zoeken in de knowledge base in plaats van
een enkel bestand volledig te lezen met read_knowledge_file.
Embedder: VoyageAI (VOYAGEAI_API_KEY in .env).

Na toevoegen/verwijderen van bestanden in knowledge/: roep refresh_rag_tool() aan
(of POST /knowledge/refresh) zodat de index opnieuw wordt opgebouwd.
"""

import os
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from crewai_tools import RagTool
from pydantic import BaseModel, Field


_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"

# VoyageAI embedder config (zie https://docs.crewai.com/en/tools/ai-ml/ragtool)
VOYAGE_EMBEDDER_CONFIG = {
    "embedding_model": {
        "provider": "voyageai",
        "config": {
            "api_key": os.getenv("VOYAGEAI_API_KEY", ""),
            "model": os.getenv("VOYAGEAI_MODEL", "voyage-3"),
        },
    },
}

# Huidige RAG-tool-instantie; wordt vervangen bij refresh (wrapper blijft dezelfde)
_rag_tool_inner = None


def _make_rag_tool() -> RagTool:
    """Bouw een nieuwe RagTool met de actuele inhoud van knowledge/."""
    config = VOYAGE_EMBEDDER_CONFIG if os.getenv("VOYAGEAI_API_KEY") else None
    tool = RagTool(config=config) if config else RagTool()
    if _KNOWLEDGE_DIR.is_dir():
        tool.add(data_type="directory", path=str(_KNOWLEDGE_DIR))
    return tool


def refresh_rag_tool() -> None:
    """Herbouw de RAG-index na wijzigingen in knowledge/ (upload, delete of write)."""
    global _rag_tool_inner
    _rag_tool_inner = _make_rag_tool()


# Eerste keer vullen
_rag_tool_inner = _make_rag_tool()


class _RagQueryInput(BaseModel):
    query: str = Field(description="Zoekvraag voor semantisch zoeken in de knowledge base.")


class _RefreshableRagTool(BaseTool):
    """Wrapper rond de echte RagTool zodat refresh_rag_tool() de inner tool vervangt."""
    name: str = "rag_search"
    description: str = (
        "Semantisch zoeken in de knowledge base (knowledge/). "
        "Gebruik wanneer je relevante informatie wilt vinden zonder een heel bestand te lezen. "
        "Geef een zoekvraag op."
    )
    args_schema: Type[BaseModel] = _RagQueryInput

    def _run(self, query: str) -> str:
        return _rag_tool_inner._run(query)


rag_tool = _RefreshableRagTool()
