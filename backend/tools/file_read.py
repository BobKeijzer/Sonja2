"""
Lees een bestand uit de knowledge-directory.

Gebruik voor: volledige inhoud van een knowledge-bestand (bijv. memory.md, afas_info.md).
Alleen bestanden in de knowledge/ map zijn toegestaan.

Uses the same pattern as crewai_tools FileReadTool (https://github.com/crewAIInc/crewAI/tree/main/lib/crewai-tools);
restricted to knowledge/ for security.
"""

from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

# Optioneel: from crewai_tools import FileReadTool  # voor niet-beperkte reads
_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


class ReadKnowledgeFileInput(BaseModel):
    """Input voor read_knowledge_file."""
    file_path: str = Field(
        description="Bestandsnaam of relatief pad binnen knowledge, bijv. 'memory.md' of 'afas_info.md'. Alleen .md en .txt in knowledge/ zijn toegestaan."
    )


class ReadKnowledgeFileTool(BaseTool):
    """Lees de inhoud van een bestand uit de knowledge base."""
    name: str = "read_knowledge_file"
    description: str = (
        "Lees de volledige inhoud van een bestand uit de knowledge base (knowledge/). "
        "Geef de bestandsnaam op, bijv. memory.md of afas_info.md. Alleen bestanden in knowledge/ zijn toegestaan."
    )
    args_schema: Type[BaseModel] = ReadKnowledgeFileInput

    def _run(self, file_path: str) -> str:
        path = Path(file_path.strip().replace("\\", "/"))
        if path.is_absolute():
            return "Fout: gebruik alleen een bestandsnaam of relatief pad, bijv. memory.md"
        # Alleen bestanden direct in knowledge/
        if "/" in path.parts or path.parts[0] == "..":
            return "Fout: alleen bestanden direct in de knowledge map zijn toegestaan (bijv. memory.md)."
        full = _KNOWLEDGE_DIR / path.name
        if not full.is_file():
            return f"Bestand niet gevonden: {path.name}. Beschikbare bestanden: {', '.join(f.name for f in _KNOWLEDGE_DIR.iterdir() if f.is_file()) or 'geen'}."
        try:
            return full.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            return f"Kon bestand niet lezen: {e}"


# Export voor Sonja (zelfde als crewai_tools FileReadTool-gebruik, maar beperkt tot knowledge)
knowledge_file_read_tool = ReadKnowledgeFileTool()
