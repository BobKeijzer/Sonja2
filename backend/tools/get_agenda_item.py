"""
Haal één agenda-item op op id. Sonja kan zo de last_run_ velden bekijken (laatste uitvoering, antwoord, denkstappen).
"""

import sys
from pathlib import Path
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
from agenda import get_item as agenda_get_item  # noqa: E402


class GetAgendaItemInput(BaseModel):
    item_id: str = Field(description="ID van het agenda-item (uit list_agenda_items).")


class GetAgendaItemTool(BaseTool):
    name: str = "get_agenda_item"
    description: str = (
        "Haal één agenda-item op op id. Retourneert titel, prompt, type, schedule en de laatste uitvoering: "
        "last_run_at, last_run_response (antwoord van Sonja) en last_run_steps (denkstappen). "
        "Gebruik dit om te zien wat er bij de laatste run is gebeurd of welk antwoord/resultaat er is opgeslagen."
    )
    args_schema: Type[BaseModel] = GetAgendaItemInput

    def _run(self, item_id: str) -> str:
        item = agenda_get_item(item_id)
        if not item:
            return f"Agenda-item met id {item_id} niet gevonden."
        lines = [
            f"Titel: {item.title}",
            f"ID: {item.id}",
            f"Type: {item.type}",
            f"Schedule: {item.schedule}",
            f"Prompt: {item.prompt}",
            f"Created at: {item.created_at}",
        ]
        lines.append("--- Laatste uitvoering ---")
        if item.last_run_at:
            lines.append(f"Last run at: {item.last_run_at}")
            if item.last_run_response:
                lines.append(f"Last run response:\n{item.last_run_response}")
            else:
                lines.append("Last run response: (geen)")
            if item.last_run_steps:
                lines.append("Last run steps (denkstappen):")
                for i, step in enumerate(item.last_run_steps, 1):
                    label = step.get("display_label") or step.get("summary") or step.get("tool", "?")
                    lines.append(f"  {i}. {label}")
            else:
                lines.append("Last run steps: (geen)")
        else:
            lines.append("Nog niet uitgevoerd (geen last_run_at).")
        return "\n".join(lines)


get_agenda_item_tool = GetAgendaItemTool()
