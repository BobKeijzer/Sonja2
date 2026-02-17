"""
Sla een herinnering op als nieuw bestand in memory/.

Formaat bestandsnaam: DD-MM-YYYY_HH-MM_slug.md (bijv. 12-02-2026_11-51_marketing-vergadering-leerpunten-kennis.md).
Inhoud: ## DD-MM-YYYY HH:MM gevolgd door **Titel** en de content. Alleen Sonja kan herinneringen aanmaken (via deze tool).
"""

import re
from pathlib import Path
from typing import Type
from datetime import datetime

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


_MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"


def _slug_from_title(title: str) -> str:
    """Maak een bestandsnaam-slug uit de titel: lowercase, spaties en leestekens naar streepjes."""
    t = (title or "").strip().lower()
    t = re.sub(r"[^\w\s-]", "", t)
    t = re.sub(r"[-\s]+", "-", t).strip("-")
    return t[:80] if t else "herinnering"


class WriteToMemoryInput(BaseModel):
    title: str = Field(
        description="Korte semantische titel van de herinnering, zonder datum (die wordt automatisch toegevoegd). "
        "Bijv. 'Marketing vergadering leerpunten' of 'Concurrentie-inzicht Exact'."
    )
    content: str = Field(description="De inhoud van de herinnering: notitie, voorkeur, feit of geleerde les.")


class WriteToMemoryTool(BaseTool):
    """Maak een nieuwe herinnering aan als bestand in memory/ (alleen via deze tool; gebruikers kunnen niet zelf aanmaken)."""
    name: str = "write_to_memory"
    description: str = (
        "Sla een herinnering op als nieuw bestand in memory/. Geef een titel en de inhoud op. "
        "Er wordt een bestand aangemaakt met formaat DD-MM-YYYY_HH-MM_slug.md. "
        "Gebruik voor gebruikersvoorkeuren, belangrijke feiten of geleerde lessen. Roep zo min mogelijk aan: bundel in één entry."
    )
    args_schema: Type[BaseModel] = WriteToMemoryInput

    def _run(self, title: str, content: str) -> str:
        title = title.strip()
        content = (content or "").strip()
        if not title and not content:
            return "Geen titel of inhoud opgegeven."
        if not title:
            title = "Herinnering"
        if not content:
            content = "(geen inhoud)"

        now = datetime.now()
        date_str = now.strftime("%d-%m-%Y")
        time_str = now.strftime("%H-%M")
        slug = _slug_from_title(title)
        filename = f"{date_str}_{time_str}_{slug}.md"

        header_ts = now.strftime("%d-%m-%Y %H:%M")
        file_content = f"## {header_ts}\n**{title}**\n\n{content}\n"

        _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        path = _MEMORY_DIR / filename
        counter = 0
        while path.exists():
            counter += 1
            filename = f"{date_str}_{time_str}_{slug}-{counter}.md"
            path = _MEMORY_DIR / filename
        path.write_text(file_content, encoding="utf-8")

        from .rag_tool import rag_add_file
        rag_add_file(path)
        return f"Herinnering opgeslagen: {filename}. Gebruik read_file met memory/{filename} om het later te lezen."


write_to_memory_tool = WriteToMemoryTool()
