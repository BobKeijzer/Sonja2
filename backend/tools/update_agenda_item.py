"""
Werk een bestaand agenda-item bij (titel, prompt, type, schedule).
Sonja of de gebruiker kan geplande taken zo aanpassen.
"""

import sys
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
from agenda import get_item as agenda_get, update_item as agenda_update  # noqa: E402


class UpdateAgendaItemInput(BaseModel):
    item_id: str = Field(description="ID van het agenda-item dat je wilt wijzigen (bijv. uit de lijst)")
    title: str | None = Field(default=None, description="Nieuwe titel (optioneel)")
    prompt: str | None = Field(default=None, description="Nieuwe prompt (optioneel)")
    type: str | None = Field(default=None, description="'once' of 'recurring' (optioneel)")
    schedule: str | None = Field(default=None, description="Nieuwe schedule: ISO datetime of cron (optioneel)")


class UpdateAgendaItemTool(BaseTool):
    name: str = "update_agenda_item"
    description: str = (
        "Werk een bestaand agenda-item bij. Geef het item_id (uit list_agenda_items of na add_agenda_item) "
        "en alleen de velden die je wilt wijzigen: title, prompt, type, schedule."
    )
    args_schema: Type[BaseModel] = UpdateAgendaItemInput

    def _run(
        self,
        item_id: str,
        title: str | None = None,
        prompt: str | None = None,
        type: str | None = None,
        schedule: str | None = None,
    ) -> str:
        item = agenda_get(item_id)
        if not item:
            return f"Agenda-item met id {item_id} niet gevonden."
        if type is not None and type not in ("once", "recurring"):
            return "Fout: type moet 'once' of 'recurring' zijn."
        kwargs = {}
        if title is not None:
            kwargs["title"] = title.strip()
        if prompt is not None:
            kwargs["prompt"] = prompt.strip()
        if type is not None:
            kwargs["type"] = type
        if schedule is not None:
            kwargs["schedule"] = schedule.strip()
        updated = agenda_update(item_id, **kwargs)
        return f"Agenda-item bijgewerkt: {updated.title} (id: {item_id})."


update_agenda_item_tool = UpdateAgendaItemTool()
