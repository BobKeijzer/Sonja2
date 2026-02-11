"""
Agenda voor Sonja: taken/afspraken (eenmalig of recurring) met titel, prompt en maillijst.
Opslag in JSON; elke minuut door scheduler gecheckt.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field

# Bestand in backend/data/agenda.json
_DATA_DIR = Path(__file__).resolve().parent / "data"
_AGENDA_FILE = _DATA_DIR / "agenda.json"


class AgendaItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    prompt: str
    type: str = Field(description="once or recurring")
    schedule: str = Field(description="ISO datetime (once) or cron (recurring, bijv. 0 9 * * 1-5)")
    mail_to: list[str] = Field(default_factory=list, description="E-mailadressen voor resultaat")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    last_run_at: str | None = None  # Voor recurring: niet dubbel runnen


def _load() -> list[dict]:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not _AGENDA_FILE.exists():
        return []
    raw = _AGENDA_FILE.read_text(encoding="utf-8")
    return json.loads(raw) if raw.strip() else []


def _save(items: list[dict]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _AGENDA_FILE.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


def list_items() -> list[AgendaItem]:
    """Alle agenda-items."""
    data = _load()
    return [AgendaItem.model_validate(d) for d in data]


def get_item(item_id: str) -> AgendaItem | None:
    data = _load()
    for d in data:
        if d.get("id") == item_id:
            return AgendaItem.model_validate(d)
    return None


def add_item(item: AgendaItem) -> AgendaItem:
    data = _load()
    d = item.model_dump()
    data.append(d)
    _save(data)
    return item


def update_item(item_id: str, **kwargs) -> AgendaItem | None:
    data = _load()
    for i, d in enumerate(data):
        if d.get("id") == item_id:
            for k, v in kwargs.items():
                if k in d:
                    d[k] = v
            data[i] = d
            _save(data)
            return AgendaItem.model_validate(d)
    return None


def delete_item(item_id: str) -> bool:
    data = _load()
    new_data = [d for d in data if d.get("id") != item_id]
    if len(new_data) == len(data):
        return False
    _save(new_data)
    return True


def set_last_run(item_id: str, at: datetime) -> None:
    update_item(item_id, last_run_at=at.isoformat())


def get_due_items(now: datetime | None = None) -> list[AgendaItem]:
    """Items die nu (deze minuut) uitgevoerd moeten worden."""
    if now is None:
        now = datetime.now()
    due: list[AgendaItem] = []
    try:
        from croniter import croniter
    except ImportError:
        croniter = None

    for item in list_items():
        if item.type == "once":
            try:
                # schedule = ISO datetime
                dt = datetime.fromisoformat(item.schedule.replace("Z", "+00:00").replace("+00:00", ""))
                # Zonder timezone vergelijken we lokaal
                if dt.tzinfo:
                    dt = dt.replace(tzinfo=None)
                if (now - dt).total_seconds() >= 0 and (now - dt).total_seconds() < 60:
                    due.append(item)
            except Exception:
                continue
        elif item.type == "recurring" and croniter:
            try:
                # schedule = cron (bijv. 0 9 * * 1-5)
                c = croniter(item.schedule, now)
                prev = c.get_prev(datetime)
                if (now - prev).total_seconds() < 60:
                    # Recurring: niet twee keer in dezelfde minuut
                    if item.last_run_at:
                        try:
                            last = datetime.fromisoformat(item.last_run_at.replace("Z", "+00:00"))
                            if (now - last).total_seconds() < 60:
                                continue
                        except Exception:
                            pass
                    due.append(item)
            except Exception:
                continue
    return due
