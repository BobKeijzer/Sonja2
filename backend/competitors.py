"""
Lijst van concurrenten voor het tabblad Concurrenten.
Opslag in JSON (backend/data/competitors.json); frontend kan GET/POST/DELETE/PATCH gebruiken.
"""

import json
import uuid
from pathlib import Path

from pydantic import BaseModel, Field

_DATA_DIR = Path(__file__).resolve().parent / "data"
_COMPETITORS_FILE = _DATA_DIR / "competitors.json"


class Competitor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(description="Naam van de concurrent (bijv. Exact, Visma)")
    enabled: bool = Field(default=True, description="Of deze concurrent meedoet bij analyse")


def _load() -> list[dict]:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not _COMPETITORS_FILE.exists():
        return []
    raw = _COMPETITORS_FILE.read_text(encoding="utf-8")
    return json.loads(raw) if raw.strip() else []


def _save(items: list[dict]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _COMPETITORS_FILE.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


def list_competitors() -> list[Competitor]:
    """Alle concurrenten."""
    data = _load()
    return [Competitor.model_validate(d) for d in data]


def get_competitor(competitor_id: str) -> Competitor | None:
    data = _load()
    for d in data:
        if d.get("id") == competitor_id:
            return Competitor.model_validate(d)
    return None


def add_competitor(name: str, enabled: bool = True) -> Competitor:
    name = (name or "").strip()
    if not name:
        raise ValueError("Naam is verplicht.")
    data = _load()
    item = Competitor(name=name, enabled=enabled)
    data.append(item.model_dump())
    _save(data)
    return item


def update_competitor(competitor_id: str, name: str | None = None, enabled: bool | None = None) -> Competitor | None:
    data = _load()
    for i, d in enumerate(data):
        if d.get("id") == competitor_id:
            if name is not None:
                data[i]["name"] = name.strip()
            if enabled is not None:
                data[i]["enabled"] = enabled
            _save(data)
            return Competitor.model_validate(data[i])
    return None


def delete_competitor(competitor_id: str) -> bool:
    data = _load()
    for i, d in enumerate(data):
        if d.get("id") == competitor_id:
            data.pop(i)
            _save(data)
            return True
    return False
