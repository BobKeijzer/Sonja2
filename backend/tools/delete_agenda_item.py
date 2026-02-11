"""
Verwijder een agenda-item. Sonja of de gebruiker kan geplande taken zo annuleren.
"""

import sys
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
from agenda import delete_item as agenda_delete, get_item as agenda_get  # noqa: E402


class DeleteAgendaItemInput(BaseModel):
    item_id: str = Field(description="ID van het agenda-item dat je wilt verwijderen")


class DeleteAgendaItemTool(BaseTool):
    name: str = "delete_agenda_item"
    description: str = (
        "Verwijder een agenda-item (taak/afspraak). Geef het item_id op (uit list_agenda_items of na add_agenda_item)."
    )
    args_schema: Type[BaseModel] = DeleteAgendaItemInput

    def _run(self, item_id: str) -> str:
        item = agenda_get(item_id)
        if not item:
            return f"Agenda-item met id {item_id} niet gevonden."
        agenda_delete(item_id)
        return f"Agenda-item verwijderd: {item.title} (id: {item_id})."


delete_agenda_item_tool = DeleteAgendaItemTool()
