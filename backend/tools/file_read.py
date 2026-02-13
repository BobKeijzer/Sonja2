"""
Lees een bestand uit de knowledge-directory of de memory-directory.

- Bestandsnaam alleen (bijv. afas_info.md) → leest uit knowledge/
- Pad memory/... (bijv. memory/12-02-2026_11-51_marketing-vergadering.md) → leest uit memory/

Beperkt tot deze twee mappen voor security.
"""

from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
_MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"


class ReadFileInput(BaseModel):
    """Input voor read_file."""
    file_path: str = Field(
        description="Bestandsnaam in knowledge/ (bijv. afas_info.md) of pad memory/bestandsnaam (bijv. memory/12-02-2026_11-51_titel.md) voor een herinnering."
    )


def _resolve_path(file_path: str) -> Path | None:
    """Bepaal absoluut pad: knowledge/ of memory/. Retourneert None bij ongeldig pad."""
    raw = file_path.strip().replace("\\", "/")
    if not raw or raw.startswith("/") or ".." in raw:
        return None
    parts = [p for p in raw.split("/") if p]
    if len(parts) == 1:
        return _KNOWLEDGE_DIR / parts[0]
    if len(parts) == 2 and parts[0].lower() == "memory":
        return _MEMORY_DIR / parts[1]
    return None


class ReadFileTool(BaseTool):
    """Lees de inhoud van een bestand uit knowledge/ of memory/."""
    name: str = "read_file"
    description: str = (
        "Lees de volledige inhoud van een bestand uit de knowledge base (knowledge/) of een herinnering (memory/). "
        "Geef een bestandsnaam op voor knowledge (bijv. afas_info.md) of memory/bestandsnaam voor een herinnering (bijv. memory/12-02-2026_11-51_titel.md)."
    )
    args_schema: Type[BaseModel] = ReadFileInput

    def _run(self, file_path: str) -> str:
        full = _resolve_path(file_path)
        if full is None:
            return "Fout: gebruik een bestandsnaam (knowledge/) of memory/bestandsnaam (herinnering)."
        if not full.is_file():
            if str(_MEMORY_DIR) in str(full):
                available = ", ".join(f.name for f in _MEMORY_DIR.iterdir() if f.is_file()) if _MEMORY_DIR.is_dir() else "geen"
                return f"Bestand niet gevonden in memory/: {full.name}. Beschikbaar: {available}."
            available = ", ".join(f.name for f in _KNOWLEDGE_DIR.iterdir() if f.is_file()) if _KNOWLEDGE_DIR.is_dir() else "geen"
            return f"Bestand niet gevonden: {full.name}. Beschikbare bestanden in knowledge/: {available}."
        try:
            return full.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            return f"Kon bestand niet lezen: {e}"


file_read_tool = ReadFileTool()
