"""
Voeg een agenda-item toe (taak of afspraak voor Sonja).
Sonja of de gebruiker kan zo eenmalige of terugkerende taken inplannen.
"""

import sys
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
from agenda import AgendaItem, add_item as agenda_add_item  # noqa: E402


class AddAgendaItemInput(BaseModel):
    title: str = Field(description="Titel van de taak/afspraak")
    prompt: str = Field(description="De opdracht/prompt die Sonja moet uitvoeren op het geplande tijdstip. Voor e-mail: vermeld in de prompt (bijv. 'mail het resultaat naar jan@example.com').")
    type: str = Field(description="'once' voor eenmalig (schedule = datum+tijd ISO) of 'recurring' (schedule = cron, bijv. 0 9 * * 1-5)")
    schedule: str = Field(description="Bij once: ISO datetime zoals 2025-02-15T09:00:00. Bij recurring: cron, bijv. 0 9 * * 1-5 voor 9u doordeweeks")


class AddAgendaItemTool(BaseTool):
    name: str = "add_agenda_item"
    description: str = (
        "Voeg een agenda-item toe: een taak of afspraak die Sonja op een gepland moment uitvoert. "
        "Geef title, prompt (wat Sonja moet doen, incl. eventueel 'mail naar ...'), type (once of recurring), schedule (ISO of cron)."
    )
    args_schema: Type[BaseModel] = AddAgendaItemInput

    def _run(self, title: str, prompt: str, type: str, schedule: str) -> str:
        if type not in ("once", "recurring"):
            return "Fout: type moet 'once' of 'recurring' zijn."
        item = AgendaItem(
            title=title.strip(),
            prompt=prompt.strip(),
            type=type,
            schedule=schedule.strip(),
        )
        agenda_add_item(item)
        return f"Agenda-item toegevoegd: {item.title} (id: {item.id}), type={type}, schedule={schedule}."


add_agenda_item_tool = AddAgendaItemTool()
