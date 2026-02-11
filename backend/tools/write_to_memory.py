"""
Append een geheugen-entry aan memory.md. Vast format met datum/tijd; overschrijft niets.
"""

import re
from pathlib import Path
from typing import Type
from datetime import datetime

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


_MEMORY_FILE = Path(__file__).resolve().parent.parent / "knowledge" / "memory.md"

_TEMPLATE = """# Sonja geheugen

Sonja kan hier korte notities en leerpunten bijhouden om over tijd beter te worden.

---

*Laatste update: (wordt door Sonja bijgewerkt)*

---
"""


class WriteToMemoryInput(BaseModel):
    content: str = Field(description="De geheugen-entry: korte notitie, voorkeur, feit of geleerde les om op te slaan.")


class WriteToMemoryTool(BaseTool):
    """Voeg een entry toe aan memory.md (append). Format: ## DD-MM-YYYY HH:MM gevolgd door de content."""
    name: str = "write_to_memory"
    description: str = (
        "Sla een geheugen-entry op in memory.md (append). Gebruik voor gebruikersvoorkeuren, belangrijke feiten of geleerde lessen. "
        "Geef alleen de inhoud op; datum en tijd worden automatisch toegevoegd. Er wordt niets overschreven."
    )
    args_schema: Type[BaseModel] = WriteToMemoryInput

    def _run(self, content: str) -> str:
        content = content.strip()
        if not content:
            return "Geen inhoud opgegeven."
        now = datetime.now()
        timestamp = now.strftime("%d-%m-%Y %H:%M")
        new_block = f"\n\n## {timestamp}\n{content}\n"

        _MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        if not _MEMORY_FILE.exists():
            text = _TEMPLATE.strip() + new_block
            # Eerste keer: "Laatste update" direct goed zetten
            text = text.replace("(wordt door Sonja bijgewerkt)", timestamp)
            _MEMORY_FILE.write_text(text, encoding="utf-8")
        else:
            text = _MEMORY_FILE.read_text(encoding="utf-8", errors="replace")
            # Update "*Laatste update: ...*" regel
            text = re.sub(
                r"\*Laatste update:.*?\*",
                f"*Laatste update: {timestamp}*",
                text,
                count=1,
            )
            text = text.rstrip() + new_block
            _MEMORY_FILE.write_text(text, encoding="utf-8")

        from .rag_tool import refresh_rag_tool
        refresh_rag_tool()
        return f"Geheugen bijgewerkt: entry toegevoegd ({timestamp})."


write_to_memory_tool = WriteToMemoryTool()
