"""
Toon alle agenda-items (taken/afspraken). Sonja kan zo zien wat er gepland staat en ids gebruiken voor update/delete.
"""

import sys
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
from agenda import list_items as agenda_list_items  # noqa: E402


class ListAgendaItemsInput(BaseModel):
    optional_query: str | None = Field(default=None, description="Optioneel; leeg laten om de volledige agenda te tonen.")


class ListAgendaItemsTool(BaseTool):
    name: str = "list_agenda_items"
    description: str = (
        "Toon alle agenda-items (geplande taken en afspraken). Gebruik dit om te zien wat er in de agenda staat "
        "of om een item_id te vinden voor update_agenda_item of delete_agenda_item. Retourneert titel, id, type en schedule per item."
    )
    args_schema: Type[BaseModel] = ListAgendaItemsInput

    def _run(self, optional_query: str | None = None) -> str:
        items = agenda_list_items()
        if not items:
            return "De agenda is leeg. Gebruik add_agenda_item om een taak of afspraak in te plannen."
        lines = []
        for i, item in enumerate(items, 1):
            lines.append(
                f"{i}. {item.title} (id: {item.id})\n   type={item.type}, schedule={item.schedule}"
            )
        return "Agenda:\n\n" + "\n\n".join(lines)


list_agenda_items_tool = ListAgendaItemsTool()
