"""
Agenda voor Sonja: taken/afspraken (eenmalig of recurring) met titel en prompt.
Opslag in JSON; elke minuut door scheduler gecheckt. Tijdzone: Europe/Amsterdam.
E-mail: als de taak resultaat per e-mail moet, geef dat in de prompt aan (bijv. 'mail het resultaat naar jan@example.com').
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field

TZ_AMSTERDAM = ZoneInfo("Europe/Amsterdam")

# Bestand in backend/data/agenda.json
_DATA_DIR = Path(__file__).resolve().parent / "data"
_AGENDA_FILE = _DATA_DIR / "agenda.json"


class AgendaItem(BaseModel):
    model_config = ConfigDict(extra="ignore")  # oude items met mail_to blijven laden

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    prompt: str
    type: str = Field(description="once or recurring")
    schedule: str = Field(description="ISO datetime (once) or cron (recurring, bijv. 0 9 * * 1-5)")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    last_run_at: str | None = None
    last_run_response: str | None = None  # Antwoord van Sonja bij laatste run
    last_run_steps: list[dict] | None = None  # Denkstappen (tool-aanroepen) bij laatste run


def _load() -> list[dict]:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not _AGENDA_FILE.exists():
        return []
    raw = _AGENDA_FILE.read_text(encoding="utf-8")
    return json.loads(raw) if raw.strip() else []


def _save(items: list[dict]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Verwijder oude mail_to-velden zodat ze niet meer in de file staan
    for d in items:
        d.pop("mail_to", None)
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


def get_next_run(item: AgendaItem, now: datetime | None = None) -> datetime | None:
    """Volgende geplande uitvoering voor dit item (Amsterdam). Voor once: schedule-datum (of None als al uitgevoerd); voor recurring: volgende cron-moment."""
    if now is None:
        now = datetime.now(TZ_AMSTERDAM)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=TZ_AMSTERDAM)
    else:
        now = now.astimezone(TZ_AMSTERDAM)
    if item.type == "once":
        if item.last_run_at:
            return None  # Eenmalige taak al uitgevoerd
        try:
            raw = item.schedule.replace("Z", "+00:00")
            dt = datetime.fromisoformat(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=TZ_AMSTERDAM)
            else:
                dt = dt.astimezone(TZ_AMSTERDAM)
            return dt
        except Exception:
            return None
    if item.type == "recurring":
        try:
            from croniter import croniter
            now_naive = now.replace(tzinfo=None)
            c = croniter(item.schedule, now_naive)
            next_naive = c.get_next(datetime)
            return next_naive.replace(tzinfo=TZ_AMSTERDAM)
        except Exception:
            return None
    return None


def get_due_items(now: datetime | None = None) -> list[AgendaItem]:
    """Items die nu (deze minuut) uitgevoerd moeten worden. Tijdzone: Europe/Amsterdam."""
    if now is None:
        now = datetime.now(TZ_AMSTERDAM)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=TZ_AMSTERDAM)
    else:
        now = now.astimezone(TZ_AMSTERDAM)
    due: list[AgendaItem] = []
    try:
        from croniter import croniter
    except ImportError:
        croniter = None

    for item in list_items():
        if item.type == "once":
            try:
                # schedule = ISO datetime (naive = Amsterdam, of met Z = UTC → omrekenen)
                raw = item.schedule.replace("Z", "+00:00")
                dt = datetime.fromisoformat(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=TZ_AMSTERDAM)
                else:
                    dt = dt.astimezone(TZ_AMSTERDAM)
                diff_sec = (now - dt).total_seconds()
                if 0 <= diff_sec < 60:
                    due.append(item)
            except Exception:
                continue
        elif item.type == "recurring" and croniter:
            try:
                # schedule = cron (bijv. 0 9 * * 1-5); croniter met Amsterdam-tijd
                now_naive = now.replace(tzinfo=None)
                c = croniter(item.schedule, now_naive)
                prev = c.get_prev(datetime)
                if (now_naive - prev).total_seconds() < 60:
                    if item.last_run_at:
                        try:
                            last = datetime.fromisoformat(item.last_run_at.replace("Z", "+00:00"))
                            if last.tzinfo:
                                last = last.astimezone(TZ_AMSTERDAM).replace(tzinfo=None)
                            if (now_naive - last).total_seconds() < 60:
                                continue
                        except Exception:
                            pass
                    due.append(item)
            except Exception:
                continue
    return due
