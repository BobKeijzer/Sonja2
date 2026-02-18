"""
FastAPI app voor Sonja – chat, agenda en scheduler.
Start met: uv run uvicorn main:app --reload (vanuit backend/) of met API_PORT uit .env.
"""

import asyncio
import calendar
import json
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agenda import (
    AgendaItem,
    list_items as agenda_list,
    get_item as agenda_get,
    add_item as agenda_add,
    update_item as agenda_update,
    delete_item as agenda_delete,
    get_due_items,
    get_next_run,
)
from competitors import (
    Competitor,
    list_competitors,
    get_competitor,
    add_competitor,
    update_competitor,
    delete_competitor,
)
from sonja import get_sonja, create_sonja_ephemeral
from tools.rag_tool import rag_add_file, rag_remove_file, refresh_rag_tool


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
    display_label: str | None = None


class ChatResponse(BaseModel):
    response: str
    steps: list[StepItem] = Field(default_factory=list, description="Sonja denkstappen (tool-aanroepen)")


def _to_chat_response(response: str, steps: list) -> ChatResponse:
    return ChatResponse(
        response=response,
        steps=[
            StepItem(tool=s["tool"], summary=s.get("summary"), display_label=s.get("display_label"))
            for s in steps
        ],
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Stel een vraag aan Sonja. Optioneel: context = eerdere berichten in het gesprek."""
    sonja = get_sonja()
    response, steps = await sonja.chat_async(request.message, context=request.context)
    return _to_chat_response(response, steps)


async def _chat_stream_generator(message: str, context: str):
    """Yield SSE events: event step voor elke stap, daarna event done met response."""
    sonja = get_sonja()
    steps_list: list[dict] = []
    task = asyncio.create_task(
        sonja.chat_async_with_list(message, context, steps_list)
    )
    sent_count = 0
    while not task.done():
        await asyncio.sleep(0.2)
        while sent_count < len(steps_list):
            step = steps_list[sent_count]
            yield f"event: step\ndata: {json.dumps(step)}\n\n"
            sent_count += 1
    response = await task
    yield f"event: done\ndata: {json.dumps({'response': response})}\n\n"


async def _stream_prompt_generator(prompt: str):
    """Yield SSE events voor een willekeurige Sonja-prompt (geen chat-context). Gebruikt eigen Sonja-instantie, wordt na afloop verworpen."""
    sonja = create_sonja_ephemeral()
    steps_list: list[dict] = []
    task = asyncio.create_task(
        sonja.chat_async_with_list(prompt, "", steps_list)
    )
    sent_count = 0
    while not task.done():
        await asyncio.sleep(0.2)
        while sent_count < len(steps_list):
            step = steps_list[sent_count]
            yield f"event: step\ndata: {json.dumps(step)}\n\n"
            sent_count += 1
    response = await task
    yield f"event: done\ndata: {json.dumps({'response': response})}\n\n"


def _sse_headers():
    return {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Chat met Server-Sent Events: stappen komen binnen terwijl Sonja werkt, daarna het antwoord."""
    return StreamingResponse(
        _chat_stream_generator(request.message, context=request.context or ""),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


# --- Vergaderingen: extract actiepunten + opslaan in geheugen ---

class MeetingsExtractRequest(BaseModel):
    transcript: str = Field(description="Vergadertranscript om actiepunten en leerpunten uit te halen.")
    custom_prompt: str | None = Field(default=None, description="Optioneel: eigen prompt voor de extractie.")


def _meetings_prompt(transcript: str, custom_prompt: str | None) -> str:
    if custom_prompt and custom_prompt.strip():
        return custom_prompt.strip() + "\n\nTranscript:\n" + transcript
    return (
        "Uit onderstaand vergadertranscript: haal actiepunten, to-do's en leerpunten/kennis. "
        "Sla de leerpunten en relevante kennis op met write_to_memory. "
        "Roep write_to_memory zo min mogelijk aan: bundel alle leerpunten in één (of heel weinig) dense entry/entries — liever één aanroep met alles samengevat dan veel losse aanroepen. "
        "Geef daarna een kort overzicht van wat je hebt opgeslagen en de actiepunten.\n\n"
        "Transcript:\n" + transcript
    )


@app.post("/meetings/extract/stream")
async def meetings_extract_stream(request: MeetingsExtractRequest):
    """Vergadering extract met SSE: stappen dynamisch, daarna antwoord."""
    transcript = request.transcript or ""
    prompt = _meetings_prompt(transcript, request.custom_prompt)
    return StreamingResponse(
        _stream_prompt_generator(prompt),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


@app.post("/meetings/extract", response_model=ChatResponse)
async def meetings_extract(request: MeetingsExtractRequest):
    """Haal actiepunten, to-do's en kennis uit een transcript; leerpunten worden opgeslagen als herinnering in memory/."""
    transcript = request.transcript or ""
    prompt = _meetings_prompt(transcript, request.custom_prompt)
    sonja = create_sonja_ephemeral()
    response, steps = await sonja.chat_async(prompt, context="")
    return _to_chat_response(response, steps)


# --- Website-analyse ---

class AnalyzeWebsiteRequest(BaseModel):
    url: str = Field(description="URL van de te analyseren website (bijv. https://www.afas.nl).")
    custom_prompt: str | None = Field(default=None, description="Optioneel: eigen prompt voor de analyse.")


def _website_prompt(url: str, custom_prompt: str | None) -> str:
    if custom_prompt and custom_prompt.strip():
        return custom_prompt.strip() + "\n\nURL: " + url
    return (
        "Scrape de volgende URL met de scrape_website tool en analyseer de pagina op: "
        "SEO, contentkwaliteit, tone of voice en call-to-actions. Geef een bondige analyse in het Nederlands.\n\nURL: " + url
    )


@app.post("/analyze/website/stream")
async def analyze_website_stream(request: AnalyzeWebsiteRequest):
    """Website-analyse met SSE: stappen dynamisch, daarna antwoord."""
    url = (request.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is verplicht.")
    prompt = _website_prompt(url, request.custom_prompt)
    return StreamingResponse(
        _stream_prompt_generator(prompt),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


@app.post("/analyze/website", response_model=ChatResponse)
async def analyze_website(request: AnalyzeWebsiteRequest):
    """Scrape de URL en laat Sonja analyseren op SEO, content, tone of voice en CTA."""
    url = (request.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is verplicht.")
    prompt = _website_prompt(url, request.custom_prompt)
    sonja = create_sonja_ephemeral()
    response, steps = await sonja.chat_async(prompt, context="")
    return _to_chat_response(response, steps)


# --- Concurrenten-analyse ---

class AnalyzeCompetitorsRequest(BaseModel):
    competitor_names: list[str] = Field(description="Lijst met namen van concurrenten om te analyseren.")
    custom_prompt: str | None = Field(default=None, description="Optioneel: eigen prompt voor de analyse.")


def _competitors_prompt(names: list[str], custom_prompt: str | None) -> str:
    if custom_prompt and custom_prompt.strip():
        return custom_prompt.strip() + f"\n\nConcurrenten: {', '.join(names)}"
    return (
        f"Gebruik de spy_competitor_research tool voor elk van de volgende concurrenten: {', '.join(names)}.\n\n"
        "Voor elke concurrent:\n"
        "- Roep spy_competitor_research aan met de naam van de concurrent\n"
        "- Sla de belangrijkste bevindingen op\n\n"
        "Geef daarna per concurrent een samenvatting (recente ontwikkelingen, sterke punten, marktpositie) "
        "en sluit af met concrete actiepunten voor AFAS marketing op basis van de gecombineerde analyse."
        "Extra instructie/Focus op: Algemeen"
    )


@app.post("/analyze/competitors/stream")
async def analyze_competitors_stream(request: AnalyzeCompetitorsRequest):
    """Concurrenten-analyse met SSE: stappen dynamisch, daarna antwoord."""
    names = [n.strip() for n in (request.competitor_names or []) if n.strip()]
    if not names:
        raise HTTPException(status_code=400, detail="Minimaal één concurrent opgeven.")
    prompt = _competitors_prompt(names, request.custom_prompt)
    return StreamingResponse(
        _stream_prompt_generator(prompt),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


@app.post("/analyze/competitors", response_model=ChatResponse)
async def analyze_competitors(request: AnalyzeCompetitorsRequest):
    """Laat Sonja per opgegeven concurrent spy_competitor_research uitvoeren en geef een gecombineerd overzicht."""
    names = [n.strip() for n in (request.competitor_names or []) if n.strip()]
    if not names:
        raise HTTPException(status_code=400, detail="Minimaal één concurrent opgeven.")
    prompt = _competitors_prompt(names, request.custom_prompt)
    sonja = create_sonja_ephemeral()
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


# --- Nieuws (RSS-feeds uit data/news_feeds.json; standaardprompts uit data/news_prompts.json) ---

_DATA_DIR = Path(__file__).resolve().parent / "data"
_NEWS_FEEDS_FILE = _DATA_DIR / "news_feeds.json"
_NEWS_PROMPTS_FILE = _DATA_DIR / "news_prompts.json"
_NEWS_CACHE: dict = {"items": [], "last_updated": None}
_NEWS_CACHE_TTL_SEC = 120


def _default_news_feeds() -> list[str]:
    return [
        "https://feeds.nos.nl/nosnieuws",
        "https://www.nu.nl/rss",
        "https://www.ad.nl/nieuws/rss",
    ]


def _load_news_feeds() -> list[str]:
    if not _NEWS_FEEDS_FILE.is_file():
        return _default_news_feeds()
    try:
        data = json.loads(_NEWS_FEEDS_FILE.read_text(encoding="utf-8"))
        urls = data.get("urls")
        if isinstance(urls, list) and urls:
            return [u for u in urls if isinstance(u, str) and u.strip().startswith("http")]
        return _default_news_feeds()
    except Exception:
        return _default_news_feeds()


def _save_news_feeds(urls: list[str]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _NEWS_FEEDS_FILE.write_text(
        json.dumps({"urls": urls}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    global _NEWS_CACHE
    _NEWS_CACHE = {"items": [], "last_updated": None}


def _extract_image_url(entry) -> str | None:
    if getattr(entry, "enclosures", None):
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image/"):
                href = enc.get("href") or enc.get("url")
                if href:
                    return href
    if getattr(entry, "media_content", None) and len(entry.media_content) > 0:
        m = entry.media_content[0]
        if isinstance(m, dict) and m.get("type", "").startswith("image/"):
            return m.get("url")
    summary = (getattr(entry, "summary", None) or "") or (getattr(entry, "description", None) or "")
    if summary:
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary, re.I)
        if match:
            return match.group(1).strip()
    return None


def _fetch_news_items() -> list[dict]:
    urls = _load_news_feeds()
    items: list[dict] = []
    seen_links: set[str] = set()
    for feed_url in urls:
        try:
            parsed = feedparser.parse(
                feed_url,
                request_headers={"User-Agent": "Sonja/1.0"},
            )
            source = (parsed.feed.get("title") or feed_url).strip()[:80]
            for entry in getattr(parsed, "entries", [])[:30]:
                link = (entry.get("link") or "").strip()
                if not link or link in seen_links:
                    continue
                seen_links.add(link)
                title = (entry.get("title") or "").strip()
                summary = (entry.get("summary") or entry.get("description") or "")
                if hasattr(summary, "replace"):
                    summary = re.sub(r"<[^>]+>", " ", summary)
                    summary = re.sub(r"\s+", " ", summary).strip()[:400]
                else:
                    summary = ""
                published = entry.get("published_parsed") or entry.get("updated_parsed")
                published_at = ""
                if published:
                    try:
                        # feedparser gives UTC struct_time; timegm for UTC epoch seconds
                        ts = calendar.timegm(published)
                        published_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")
                    except Exception:
                        published_at = entry.get("published") or entry.get("updated") or ""
                image_url = _extract_image_url(entry)
                items.append({
                    "title": title or "Geen titel",
                    "url": link,
                    "summary": summary,
                    "source": source,
                    "published_at": published_at,
                    "image_url": image_url if image_url else None,
                })
        except Exception:
            continue
    items.sort(key=lambda x: x.get("published_at") or "", reverse=True)
    return items[:80]


_NEWS_TASK_PROMPTS_DEFAULT = {
    "inhaker": (
        "Maak een korte, pakkende inhaker: een social post (1-3 zinnen) waarmee AFAS op dit nieuws kan inhaken. "
        "Speels en herkenbaar, passend bij AFAS (Doen, Vertrouwen, Gek, Familie). Geen hashtags tenzij heel natuurlijk."
    ),
    "linkedin": (
        "Schrijf een LinkedIn-post (korte alinea's) die dit nieuws koppelt aan AFAS en onze doelgroep (HR, finance, ondernemers). "
        "Professioneel maar toegankelijk. Sluit af met een duidelijke gedachte of vraag. Geen overdreven hashtags."
    ),
    "afas_betekenis": (
        "Analyseer: wat betekent dit nieuws voor AFAS? Geef in 2-4 zinnen: kansen, risico's of positionering, "
        "en eventueel concrete actiepunten, aanbevelingen of standpunten voor AFAS marketing."
    ),
}


def _load_news_prompts() -> dict[str, str]:
    if not _NEWS_PROMPTS_FILE.is_file():
        return dict(_NEWS_TASK_PROMPTS_DEFAULT)
    try:
        data = json.loads(_NEWS_PROMPTS_FILE.read_text(encoding="utf-8"))
        out = dict(_NEWS_TASK_PROMPTS_DEFAULT)
        for key in ("inhaker", "linkedin", "afas_betekenis"):
            if key in data and isinstance(data[key], str) and data[key].strip():
                out[key] = data[key].strip()
        return out
    except Exception:
        return dict(_NEWS_TASK_PROMPTS_DEFAULT)


def _save_news_prompts(prompts: dict[str, str]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _NEWS_PROMPTS_FILE.write_text(
        json.dumps(prompts, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


class NewsFeedsResponse(BaseModel):
    urls: list[str] = Field(description="Lijst van RSS feed-URLs.")


class NewsFeedsUpdateRequest(BaseModel):
    urls: list[str] = Field(description="Nieuwe lijst van RSS feed-URLs.")


class NewsItemResponse(BaseModel):
    title: str
    url: str
    summary: str
    source: str
    published_at: str
    image_url: str | None = None


class NewsListResponse(BaseModel):
    items: list[NewsItemResponse] = Field(description="Nieuwsitems uit de geconfigureerde feeds.")
    last_updated: str | None = Field(default=None, description="ISO-timestamp van laatste fetch.")


class NewsPromptsResponse(BaseModel):
    inhaker: str = Field(description="Standaardprompt voor Inhaker-knop.")
    linkedin: str = Field(description="Standaardprompt voor LinkedIn-knop.")
    afas_betekenis: str = Field(description="Standaardprompt voor Betekenis voor AFAS-knop.")


class NewsPromptsUpdateRequest(BaseModel):
    inhaker: str | None = None
    linkedin: str | None = None
    afas_betekenis: str | None = None


@app.get("/news/prompts", response_model=NewsPromptsResponse)
def news_get_prompts():
    p = _load_news_prompts()
    return NewsPromptsResponse(
        inhaker=p.get("inhaker", _NEWS_TASK_PROMPTS_DEFAULT["inhaker"]),
        linkedin=p.get("linkedin", _NEWS_TASK_PROMPTS_DEFAULT["linkedin"]),
        afas_betekenis=p.get("afas_betekenis", _NEWS_TASK_PROMPTS_DEFAULT["afas_betekenis"]),
    )


@app.put("/news/prompts", response_model=NewsPromptsResponse)
def news_update_prompts(body: NewsPromptsUpdateRequest):
    current = _load_news_prompts()
    if body.inhaker is not None:
        current["inhaker"] = body.inhaker.strip()
    if body.linkedin is not None:
        current["linkedin"] = body.linkedin.strip()
    if body.afas_betekenis is not None:
        current["afas_betekenis"] = body.afas_betekenis.strip()
    _save_news_prompts(current)
    return NewsPromptsResponse(
        inhaker=current["inhaker"],
        linkedin=current["linkedin"],
        afas_betekenis=current["afas_betekenis"],
    )


@app.get("/news/feeds", response_model=NewsFeedsResponse)
def news_get_feeds():
    return NewsFeedsResponse(urls=_load_news_feeds())


@app.put("/news/feeds", response_model=NewsFeedsResponse)
def news_update_feeds(body: NewsFeedsUpdateRequest):
    urls = [u.strip() for u in (body.urls or []) if isinstance(u, str) and u.strip()]
    valid = [u for u in urls if u.startswith("http://") or u.startswith("https://")]
    if not valid and urls:
        raise HTTPException(status_code=400, detail="Alleen geldige http(s)-URLs toegestaan.")
    _save_news_feeds(valid if valid else _default_news_feeds())
    return NewsFeedsResponse(urls=_load_news_feeds())


@app.get("/news", response_model=NewsListResponse)
def news_list():
    global _NEWS_CACHE
    now = time.time()
    if (
        _NEWS_CACHE.get("items")
        and _NEWS_CACHE.get("last_updated") is not None
        and (now - _NEWS_CACHE["last_updated"]) < _NEWS_CACHE_TTL_SEC
    ):
        return NewsListResponse(
            items=[NewsItemResponse(**i) for i in _NEWS_CACHE["items"]],
            last_updated=datetime.utcfromtimestamp(_NEWS_CACHE["last_updated"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
        )
    items = _fetch_news_items()
    _NEWS_CACHE = {"items": items, "last_updated": now}
    return NewsListResponse(
        items=[NewsItemResponse(**i) for i in items],
        last_updated=datetime.utcfromtimestamp(now).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


class NewsGenerateRequest(BaseModel):
    news_item: dict = Field(description="Nieuwsitem: title, url, summary, source.")
    task: str = Field(description="inhaker | linkedin | afas_betekenis | custom")
    custom_prompt: str | None = Field(default=None, description="Bij task=custom: wat moet Sonja doen?")


class NewsGenerateResponse(BaseModel):
    content: str = Field(description="Door Sonja gegenereerde tekst.")


def _news_generate_prompt(body: NewsGenerateRequest) -> str:
    """Bouw de prompt voor nieuws-generatie (gedeeld door generate en generate/stream)."""
    item = body.news_item or {}
    title = (item.get("title") or "").strip()
    url = (item.get("url") or "").strip()
    summary = (item.get("summary") or "").strip()
    source = (item.get("source") or "").strip()
    task = (body.task or "").strip().lower()
    custom = (body.custom_prompt or "").strip()
    prompts = _load_news_prompts()
    if task in prompts:
        instruction = prompts[task]
    elif task == "custom":
        instruction = custom
    else:
        instruction = ""
    context = f"Nieuwsitem:\nTitel: {title}\nBron: {source}\nSamenvatting: {summary}\nURL: {url}"
    return (
        f"{context}\n\n"
        "De gebruiker vraagt het volgende:\n"
        f"{instruction}\n\n"
        "Gebruik vooral de titel en samenvatting hierboven; dat is meestal voldoende. "
        "Gebruik scrape_website of serper_search alleen als je echt meer context nodig hebt (bijv. concrete cijfers of citaten). "
        "Niet standaard het artikel scrapen — veel sites geven een privacy-/cookiegate terug. "
        "Geef alleen de gevraagde tekst terug in markdown waar passend, geen uitleg ervoor."
    )


@app.post("/news/generate/stream")
async def news_generate_stream(body: NewsGenerateRequest):
    """Nieuws genereren met SSE: stappen dynamisch, daarna content in event done."""
    item = body.news_item or {}
    if not (item.get("title") or "").strip() and not (item.get("url") or "").strip():
        raise HTTPException(status_code=400, detail="news_item moet ten minste title of url bevatten.")
    task = (body.task or "").strip().lower()
    if task == "custom" and not (body.custom_prompt or "").strip():
        raise HTTPException(status_code=400, detail="Bij task 'custom' is custom_prompt verplicht.")
    prompts = _load_news_prompts()
    if task not in prompts and task != "custom":
        raise HTTPException(
            status_code=400,
            detail="task moet zijn: inhaker, linkedin, afas_betekenis of custom.",
        )
    prompt = _news_generate_prompt(body)
    return StreamingResponse(
        _stream_prompt_generator(prompt),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


@app.post("/news/generate", response_model=NewsGenerateResponse)
async def news_generate(body: NewsGenerateRequest):
    item = body.news_item or {}
    title = (item.get("title") or "").strip()
    url = (item.get("url") or "").strip()
    task = (body.task or "").strip().lower()
    custom = (body.custom_prompt or "").strip()
    if not title and not url:
        raise HTTPException(status_code=400, detail="news_item moet ten minste title of url bevatten.")
    if task == "custom" and not custom:
        raise HTTPException(status_code=400, detail="Bij task 'custom' is custom_prompt verplicht.")
    prompts = _load_news_prompts()
    if task not in prompts and task != "custom":
        raise HTTPException(
            status_code=400,
            detail="task moet zijn: inhaker, linkedin, afas_betekenis of custom.",
        )
    prompt = _news_generate_prompt(body)
    sonja = create_sonja_ephemeral()
    response, _ = await sonja.chat_async(prompt, context="")
    return NewsGenerateResponse(content=(response or "").strip())


# --- Kennis (knowledge/) – voor frontend tabblad Kennis: lijst, open bestand, upload, verwijderen ---
# Herinneringen staan in memory/ als losse bestanden. In knowledge/ mag ook een bestand memory.md staan (gewoon een kennisbestand).

_KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"
_MEMORY_DIR = Path(__file__).resolve().parent / "memory"


def _get_knowledge_filenames() -> list[str]:
    """Lijst van .md en .txt bestandsnamen in knowledge/."""
    if not _KNOWLEDGE_DIR.is_dir():
        return []
    names = []
    for ext in ("*.md", "*.txt"):
        names.extend(f.name for f in _KNOWLEDGE_DIR.glob(ext) if f.is_file())
    return sorted(names)


def _get_memory_filenames() -> list[str]:
    """Lijst van .md bestandsnamen in memory/."""
    if not _MEMORY_DIR.is_dir():
        return []
    return sorted(f.name for f in _MEMORY_DIR.glob("*.md") if f.is_file())


def _safe_filename(name: str) -> bool:
    """Alleen basename, geen path traversal."""
    p = Path(name)
    return p.name == name and "/" not in name and "\\" not in name and ".." not in name


class KnowledgeListResponse(BaseModel):
    files: list[str] = Field(description="Bestandsnamen in knowledge/.")


class KnowledgeContentResponse(BaseModel):
    content: str = Field(description="Inhoud van het bestand.")


@app.get("/knowledge", response_model=KnowledgeListResponse)
def knowledge_list():
    """Lijst van alle bestandsnamen in knowledge/ (voor tabblad Kennis: klik om te openen)."""
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
    """Bewerk een bestand in knowledge/: schrijf inhoud weg en update RAG-index voor dit bestand."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _KNOWLEDGE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    path.write_text(body.content or "", encoding="utf-8")
    rag_add_file(path)
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
    rag_add_file(path)
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
    rag_add_file(path)
    return {"status": "ok", "filename": name}


@app.delete("/knowledge/{filename}")
def knowledge_delete(filename: str):
    """Verwijder een bestand uit knowledge/. RAG-index wordt voor dit bestand bijgewerkt."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _KNOWLEDGE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    rag_remove_file(path)
    path.unlink()
    return {"status": "ok", "filename": filename}


@app.post("/knowledge/refresh")
def knowledge_refresh():
    """Herbouw de RAG-index over knowledge/ en memory/. Vereist dat Qdrant draait (bijv. docker run -p 6333:6333 qdrant/qdrant)."""
    success, message = refresh_rag_tool()
    if not success:
        raise HTTPException(status_code=503, detail=message)
    return {"status": "ok", "message": message}


# --- Geheugen (memory/) – losse .md-bestanden per herinnering; alleen Sonja kan aanmaken ---

class MemoryListResponse(BaseModel):
    files: list[str] = Field(description="Bestandsnamen in memory/.")


class MemoryContentResponse(BaseModel):
    content: str = Field(description="Inhoud van het memory-bestand.")


class MemoryUpdateRequest(BaseModel):
    content: str = Field(description="Nieuwe inhoud van het bestand.")


@app.get("/memory", response_model=MemoryListResponse)
def memory_list():
    """Lijst van alle memory-bestanden (voor tabblad Geheugen)."""
    return MemoryListResponse(files=_get_memory_filenames())


@app.get("/memory/{filename}", response_model=MemoryContentResponse)
def memory_get_content(filename: str):
    """Inhoud van één bestand uit memory/."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _MEMORY_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    return MemoryContentResponse(content=path.read_text(encoding="utf-8", errors="replace"))


@app.put("/memory/{filename}")
def memory_update(filename: str, body: MemoryUpdateRequest):
    """Bewerk een memory-bestand. RAG-index wordt voor dit bestand bijgewerkt."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _MEMORY_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    path.write_text(body.content or "", encoding="utf-8")
    rag_add_file(path)
    return {"status": "ok", "filename": filename}


@app.delete("/memory/{filename}")
def memory_delete(filename: str):
    """Verwijder een memory-bestand. RAG-index wordt voor dit bestand bijgewerkt."""
    if not _safe_filename(filename):
        raise HTTPException(status_code=400, detail="Ongeldige bestandsnaam.")
    path = _MEMORY_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden.")
    rag_remove_file(path)
    path.unlink()
    return {"status": "ok", "filename": filename}


# --- Agenda CRUD ---

class AgendaItemCreate(BaseModel):
    title: str
    prompt: str
    type: str = Field(description="once of recurring")
    schedule: str = Field(description="ISO datetime (once) of cron (recurring)")


class AgendaItemUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    type: str | None = None
    schedule: str | None = None


class AgendaItemWithNextRun(AgendaItem):
    """Agenda-item met volgende geplande uitvoering (voor sortering in UI)."""
    next_run_at: str | None = None


@app.get("/agenda", response_model=list[AgendaItemWithNextRun])
def agenda_list_endpoint():
    """Lijst van alle agenda-items met next_run_at (volgende geplande uitvoering, Amsterdam)."""
    items = agenda_list()
    result = []
    for item in items:
        n = get_next_run(item)
        result.append(
            AgendaItemWithNextRun(
                **item.model_dump(),
                next_run_at=n.isoformat() if n else None,
            )
        )
    return result


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


# --- Scheduler: elke minuut due items; per item parallel een eigen Sonja-instantie (geen queue) ---

_agenda_running_ids: set[str] = set()
_agenda_running_lock = threading.Lock()


def _run_agenda_item(item_id: str) -> None:
    """Voert één agenda-item uit in een eigen Sonja-instantie. Na afloop: id uit _agenda_running_ids."""
    from zoneinfo import ZoneInfo
    item = agenda_get(item_id)
    if item is None:
        with _agenda_running_lock:
            _agenda_running_ids.discard(item_id)
        return
    now = datetime.now(ZoneInfo("Europe/Amsterdam"))
    print(f"[Agenda] Start taak: {item.title}")
    sonja = create_sonja_ephemeral()
    message = (
        f"Geplande taak: [{item.title}].\n\n"
        f"Voer de volgende opdracht uit: {item.prompt}\n\n"
        "Als in de opdracht staat dat je het resultaat per e-mail moet sturen (bijv. 'mail naar ...'), gebruik dan de send_email tool."
    )
    try:
        response, steps = sonja.chat(message)
        agenda_update(
            item.id,
            last_run_at=now.isoformat(),
            last_run_response=response or "",
            last_run_steps=steps,
        )
        print(f"[Agenda] Taak uitgevoerd: {item.title}")
    except Exception as e:
        print(f"[Agenda] Item {item.id} fout: {e}")
    finally:
        with _agenda_running_lock:
            _agenda_running_ids.discard(item.id)


def _scheduler_loop():
    """Elke 60 seconden: get_due_items(); voor elk item dat nog niet draait, start een thread met eigen Sonja."""
    time.sleep(5)
    while True:
        try:
            from zoneinfo import ZoneInfo
            now = datetime.now(ZoneInfo("Europe/Amsterdam"))
            due = get_due_items(now)
            for item in due:
                with _agenda_running_lock:
                    if item.id in _agenda_running_ids:
                        continue
                    _agenda_running_ids.add(item.id)
                t = threading.Thread(target=_run_agenda_item, args=(item.id,), daemon=True)
                t.start()
            if due:
                print(f"[Agenda] {len(due)} due item(s) gestart (om {now.strftime('%H:%M')} Amsterdam)")
        except Exception as e:
            print(f"Scheduler fout: {e}")
        time.sleep(60)


@app.on_event("startup")
def start_scheduler():
    threading.Thread(target=_scheduler_loop, daemon=True).start()


# --- Health ---

@app.get("/health")
def health():
    return {"status": "ok"}
