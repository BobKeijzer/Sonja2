"""
FastAPI app voor Sonja – chat, agenda en scheduler.
Start met: uv run uvicorn main:app --reload (vanuit backend/) of met API_PORT uit .env.
"""

import threading
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agenda import (
    AgendaItem,
    list_items as agenda_list,
    get_item as agenda_get,
    add_item as agenda_add,
    update_item as agenda_update,
    delete_item as agenda_delete,
    get_due_items,
    set_last_run,
)
from competitors import (
    Competitor,
    list_competitors,
    get_competitor,
    add_competitor,
    update_competitor,
    delete_competitor,
)
from sonja import get_sonja
from tools.rag_tool import refresh_rag_tool


app = FastAPI(title="Sonja API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Chat ---

class ChatRequest(BaseModel):
    message: str
    context: str = ""


class StepItem(BaseModel):
    tool: str
    summary: str | None = None


class ChatResponse(BaseModel):
    response: str
    steps: list[StepItem] = Field(default_factory=list, description="Sonja denkstappen (tool-aanroepen)")


def _to_chat_response(response: str, steps: list) -> ChatResponse:
    return ChatResponse(
        response=response,
        steps=[StepItem(tool=s["tool"], summary=s.get("summary")) for s in steps],
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Stel een vraag aan Sonja. Optioneel: context = eerdere berichten in het gesprek."""
    sonja = get_sonja()
    response, steps = await sonja.chat_async(request.message, context=request.context)
    return _to_chat_response(response, steps)


# --- Vergaderingen: extract actiepunten + opslaan in geheugen ---

class MeetingsExtractRequest(BaseModel):
    transcript: str = Field(description="Vergadertranscript om actiepunten en leerpunten uit te halen.")
    custom_prompt: str | None = Field(default=None, description="Optioneel: eigen prompt voor de extractie.")


@app.post("/meetings/extract", response_model=ChatResponse)
async def meetings_extract(request: MeetingsExtractRequest):
    """Haal actiepunten, to-do's en kennis uit een transcript; leerpunten worden opgeslagen in memory.md."""
    transcript = request.transcript or ""
    if request.custom_prompt and request.custom_prompt.strip():
        prompt = request.custom_prompt.strip() + "\n\nTranscript:\n" + transcript
    else:
        prompt = (
            "Uit onderstaand vergadertranscript: haal actiepunten, to-do's en leerpunten/kennis. "
            "Sla de leerpunten en relevante kennis op met write_to_memory. "
            "Roep write_to_memory zo min mogelijk aan: bundel alle leerpunten in één (of heel weinig) dense entry/entries — liever één aanroep met alles samengevat dan veel losse aanroepen. "
            "Geef daarna een kort overzicht van wat je hebt opgeslagen en de actiepunten.\n\n"
            "Transcript:\n" + transcript
        )
    sonja = get_sonja()
    response, steps = await sonja.chat_async(prompt, context="")
    return _to_chat_response(response, steps)


# --- Website-analyse ---

class AnalyzeWebsiteRequest(BaseModel):
    url: str = Field(description="URL van de te analyseren website (bijv. https://www.afas.nl).")
    custom_prompt: str | None = Field(default=None, description="Optioneel: eigen prompt voor de analyse.")


@app.post("/analyze/website", response_model=ChatResponse)
async def analyze_website(request: AnalyzeWebsiteRequest):
    """Scrape de URL en laat Sonja analyseren op SEO, content, tone of voice en CTA."""
    url = (request.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is verplicht.")
    if request.custom_prompt and request.custom_prompt.strip():
        prompt = request.custom_prompt.strip() + "\n\nURL: " + url
    else:
        prompt = (
            "Scrape de volgende URL met de scrape_website tool en analyseer de pagina op: "
            "SEO, contentkwaliteit, tone of voice en call-to-actions. Geef een bondige analyse in het Nederlands.\n\nURL: " + url
        )
    sonja = get_sonja()
    response, steps = await sonja.chat_async(prompt, context="")
    return _to_chat_response(response, steps)


# --- Concurrenten-analyse ---

class AnalyzeCompetitorsRequest(BaseModel):
    competitor_names: list[str] = Field(description="Lijst met namen van concurrenten om te analyseren.")
    custom_prompt: str | None = Field(default=None, description="Optioneel: eigen prompt voor de analyse.")


@app.post("/analyze/competitors", response_model=ChatResponse)
async def analyze_competitors(request: AnalyzeCompetitorsRequest):
    """Laat Sonja per opgegeven concurrent spy_competitor_research uitvoeren en geef een gecombineerd overzicht."""
    names = [n.strip() for n in (request.competitor_names or []) if n.strip()]
    if not names:
        raise HTTPException(status_code=400, detail="Minimaal één concurrent opgeven.")
    
    if request.custom_prompt and request.custom_prompt.strip():
        # Gebruik de custom prompt (concurrenten-namen worden nog toegevoegd voor duidelijkheid)
        prompt = request.custom_prompt.strip() + f"\n\nConcurrenten: {', '.join(names)}"
    else:
        # Standaard prompt: expliciet en direct
        prompt = (
            f"Gebruik de spy_competitor_research tool voor elk van de volgende concurrenten: {', '.join(names)}.\n\n"
            "Voor elke concurrent:\n"
            "- Roep spy_competitor_research aan met de naam van de concurrent\n"
            "- Sla de belangrijkste bevindingen op\n\n"
            "Geef daarna per concurrent een samenvatting (recente ontwikkelingen, sterke punten, marktpositie) "
            "en sluit af met concrete actiepunten voor AFAS marketing op basis van de gecombineerde analyse."
        )
    sonja = get_sonja()
    response, steps = await sonja.chat_async(prompt, context="")
    return _to_chat_response(response, steps)


# --- Concurrentenlijst (voor tabblad Concurrenten) ---

class CompetitorCreate(BaseModel):
    name: str = Field(description="Naam van de concurrent")


class CompetitorUpdate(BaseModel):
    name: str | None = None


@app.get("/competitors")
def competitors_list():
    """Lijst van alle opgeslagen concurrenten."""
    return {"competitors": [c.model_dump() for c in list_competitors()]}


@app.post("/competitors", status_code=201)
def competitors_create(body: CompetitorCreate):
    """Voeg een concurrent toe."""
    try:
        c = add_competitor(name=body.name)
        return c.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/competitors/{competitor_id}")
def competitors_get(competitor_id: str):
    """Details van één concurrent."""
    c = get_competitor(competitor_id)
    if not c:
        raise HTTPException(status_code=404, detail="Concurrent niet gevonden.")
    return c.model_dump()


@app.patch("/competitors/{competitor_id}")
def competitors_update(competitor_id: str, body: CompetitorUpdate):
    """Werk naam bij."""
    c = update_competitor(competitor_id, name=body.name)
    if not c:
        raise HTTPException(status_code=404, detail="Concurrent niet gevonden.")
    return c.model_dump()


@app.delete("/competitors/{competitor_id}", status_code=204)
def competitors_delete(competitor_id: str):
    """Verwijder een concurrent uit de lijst."""
    if not delete_competitor(competitor_id):
        raise HTTPException(status_code=404, detail="Concurrent niet gevonden.")
    return None


# --- Kennis & Geheugen (knowledge/) – voor frontend tabblad: lijst, open bestand, upload, verwijderen ---

_KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"
_MEMORY_FILE = _KNOWLEDGE_DIR / "memory.md"


def _get_knowledge_filenames() -> list[str]:
    """Lijst van .md en .txt bestandsnamen in knowledge/ (zelfde logica als in sonja)."""
    if not _KNOWLEDGE_DIR.is_dir():
        return []
    names = []
    for ext in ("*.md", "*.txt"):
        names.extend(f.name for f in _KNOWLEDGE_DIR.glob(ext) if f.is_file())
    return sorted(names)


def _safe_filename(name: str) -> bool:
    """Alleen basename, geen path traversal."""
    p = Path(name)
    return p.name == name and "/" not in name and "\\" not in name and ".." not in name


class KnowledgeListResponse(BaseModel):
    files: list[str] = Field(description="Bestandsnamen in knowledge/ (o.a. memory.md).")


class KnowledgeContentResponse(BaseModel):
    content: str = Field(description="Inhoud van het bestand.")


@app.get("/knowledge", response_model=KnowledgeListResponse)
def knowledge_list():
    """Lijst van alle bestandsnamen in knowledge/ (voor tabblad Kennis & Geheugen: klik om te openen)."""
    return KnowledgeListResponse(files=_get_knowledge_filenames())


@app.get("/knowledge/{filename}", response_model=KnowledgeContentResponse)
def knowledge_get_content(filename: str):
    """Inhoud van één bestand uit knowledge/. Frontend toont dit om doorheen te scrollen (geen aparte zoekfunctie)."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _KNOWLEDGE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    return KnowledgeContentResponse(content=path.read_text(encoding="utf-8", errors="replace"))


class KnowledgeUpdateRequest(BaseModel):
    content: str = Field(description="Nieuwe inhoud van het bestand.")


@app.put("/knowledge/{filename}")
def knowledge_update(filename: str, body: KnowledgeUpdateRequest):
    """Bewerk een bestand in knowledge/: schrijf inhoud weg en ververs RAG-index (alleen bij expliciet opslaan)."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _KNOWLEDGE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    path.write_text(body.content or "", encoding="utf-8")
    refresh_rag_tool()
    return {"status": "ok", "filename": filename}


class KnowledgeCreateRequest(BaseModel):
    filename: str = Field(description="Bestandsnaam, bijv. notities.md")
    content: str = Field(description="Inhoud van het document.")


@app.post("/knowledge/create")
def knowledge_create(request: KnowledgeCreateRequest):
    """Maak een nieuw document in knowledge/ met opgegeven naam en inhoud. Alleen .md en .txt. RAG-index wordt daarna ververst."""
    name = (request.filename or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Geen bestandsnaam.")
    if not name.endswith(".md") and not name.endswith(".txt"):
        name = name + ".md"
    if not _safe_filename(name):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    _KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    path = _KNOWLEDGE_DIR / name
    path.write_text(request.content or "", encoding="utf-8")
    refresh_rag_tool()
    return {"status": "ok", "filename": name}


@app.post("/knowledge/upload")
def knowledge_upload(file: UploadFile):
    """Upload een bestand naar knowledge/. Alleen .md en .txt. RAG-index wordt daarna ververst."""
    name = (file.filename or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Geen bestandsnaam.")
    if not _safe_filename(name):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    if not (name.endswith(".md") or name.endswith(".txt")):
        raise HTTPException(status_code=400, detail="Alleen .md en .txt zijn toegestaan.")
    _KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    path = _KNOWLEDGE_DIR / name
    content = file.file.read()
    path.write_bytes(content)
    refresh_rag_tool()
    return {"status": "ok", "filename": name}


@app.delete("/knowledge/{filename}")
def knowledge_delete(filename: str):
    """Verwijder een bestand uit knowledge/. RAG-index wordt daarna ververst. memory.md mag; write_to_memory maakt het opnieuw aan indien nodig."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _KNOWLEDGE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    path.unlink()
    refresh_rag_tool()
    return {"status": "ok", "filename": filename}


@app.post("/knowledge/refresh")
def knowledge_refresh():
    """Herbouw de RAG-index over knowledge/. Wordt ook na upload/delete automatisch aangeroepen."""
    refresh_rag_tool()
    return {"status": "ok", "message": "RAG-index opnieuw opgebouwd."}


# --- Geheugen (memory.md) – shortcut voor content (tabblad kan ook GET /knowledge/memory.md gebruiken) ---

class MemoryResponse(BaseModel):
    content: str = Field(description="Volledige inhoud van memory.md voor weergave.")


@app.get("/memory", response_model=MemoryResponse)
def get_memory():
    """Volledige inhoud van memory.md. Frontend tabblad Geheugen kan dit of GET /knowledge/memory.md gebruiken."""
    if not _MEMORY_FILE.exists():
        return MemoryResponse(content="")
    return MemoryResponse(content=_MEMORY_FILE.read_text(encoding="utf-8", errors="replace"))


# --- Agenda CRUD ---

class AgendaItemCreate(BaseModel):
    title: str
    prompt: str
    type: str = Field(description="once of recurring")
    schedule: str = Field(description="ISO datetime (once) of cron (recurring)")
    mail_to: list[str] = Field(default_factory=list)


class AgendaItemUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    type: str | None = None
    schedule: str | None = None
    mail_to: list[str] | None = None


@app.get("/agenda", response_model=list[AgendaItem])
def agenda_list_endpoint():
    """Lijst van alle agenda-items."""
    return agenda_list()


@app.get("/agenda/{item_id}", response_model=AgendaItem)
def agenda_get_one(item_id: str):
    """Eén agenda-item op id."""
    item = agenda_get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Agenda-item niet gevonden")
    return item


@app.post("/agenda", response_model=AgendaItem)
def agenda_create(body: AgendaItemCreate):
    """Agenda-item aanmaken (eenmalig of recurring)."""
    item = AgendaItem(
        title=body.title,
        prompt=body.prompt,
        type=body.type,
        schedule=body.schedule,
        mail_to=body.mail_to,
    )
    agenda_add(item)
    return item


@app.put("/agenda/{item_id}", response_model=AgendaItem)
def agenda_update_one(item_id: str, body: AgendaItemUpdate):
    """Agenda-item bijwerken."""
    item = agenda_get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Agenda-item niet gevonden")
    kwargs = body.model_dump(exclude_unset=True)
    updated = agenda_update(item_id, **kwargs)
    return updated


@app.delete("/agenda/{item_id}")
def agenda_delete_one(item_id: str):
    """Agenda-item verwijderen."""
    if not agenda_delete(item_id):
        raise HTTPException(status_code=404, detail="Agenda-item niet gevonden")
    return {"status": "ok"}


# --- Scheduler (elke minuut geplande items uitvoeren) ---

def _run_due_agenda_items():
    """Voer alle items uit die nu due zijn. Wordt elke minuut aangeroepen."""
    now = datetime.now()
    due = get_due_items(now)
    sonja = get_sonja()
    for item in due:
        mail_list = ", ".join(item.mail_to) if item.mail_to else "geen"
        message = (
            f"Geplande taak: [{item.title}].\n\n"
            f"Voer de volgende opdracht uit: {item.prompt}\n\n"
            f"Stuur daarna het resultaat per e-mail naar: {mail_list}. "
            "Gebruik de send_email tool met onderwerp gelijk aan de titel van deze taak."
        )
        try:
            sonja.chat(message)
            if item.type == "once":
                agenda_delete(item.id)
            else:
                set_last_run(item.id, now)
        except Exception as e:
            # Log maar blokkeer scheduler niet
            print(f"Agenda-item {item.id} fout: {e}")


def _scheduler_loop():
    """Background thread: direct eerste check, daarna elke 60 seconden agenda checken."""
    time.sleep(5)  # Even wachten tot app klaar is
    while True:
        try:
            _run_due_agenda_items()
        except Exception as e:
            print(f"Scheduler fout: {e}")
        time.sleep(60)


@app.on_event("startup")
def start_scheduler():
    t = threading.Thread(target=_scheduler_loop, daemon=True)
    t.start()


# --- Health ---

@app.get("/health")
def health():
    return {"status": "ok"}
