"""
Sonja – AI Marketing Coordinator Assistant (CrewAI Agent)

Eén agent met alle tools; geen Crew. Subagents (bijv. concurrentie-onderzoek) worden
als tools aangeroepen.

Huidige tools (tools/):
- serper_search_tool: zoekresultaten en snippets op het web (Serper)
- scrape_website_tool: scrape een URL voor volledige pagina-inhoud
- file_read_tool: lees een bestand uit knowledge/ (bestandsnaam) of memory/ (memory/bestandsnaam)
- write_to_memory_tool: maak een nieuwe herinnering aan in memory/ (titel + inhoud; bestandsnaam automatisch)
- rag_tool (rag_search): semantisch zoeken in knowledge/ en memory/
- spy_competitor_research_tool: roept research-subagent aan voor concurrentie-onderzoek
- send_email_tool: stuur e-mail naar opgegeven adressen (o.a. resultaat geplande taken)
- list_agenda_items_tool: toon alle agenda-items
- add_agenda_item_tool: voeg taak/afspraak toe (eenmalig of recurring)
- update_agenda_item_tool: werk agenda-item bij
- delete_agenda_item_tool: verwijder agenda-item

RAG: we gebruiken RagTool als tool (niet knowledge_sources op de Agent), zodat Sonja
expliciet zoekt wanneer nodig en de index na upload/verwijderen/write_to_memory ververst kan worden.

Denkstappen: tools worden gewrapped in RecordingTool zodat elke tool-aanroep wordt vastgelegd
voor de API-response (Sonja denkstappen in de frontend).
"""

from contextvars import ContextVar
from pathlib import Path
from datetime import datetime
from typing import Any

from crewai import Agent
from crewai.tools import BaseTool

from tools import (
    serper_search_tool,
    scrape_website_tool,
    file_read_tool,
    write_to_memory_tool,
    rag_tool,
    spy_competitor_research_tool,
    send_email_tool,
    add_agenda_item_tool,
    list_agenda_items_tool,
    update_agenda_item_tool,
    delete_agenda_item_tool,
)


def _make_recording_tool(inner_tool: Any, steps_ctx: ContextVar) -> BaseTool:
    """Wrap any tool (crewai BaseTool of crewai_tools) zodat elke _run in steps_ctx wordt gelogd."""
    inner = inner_tool
    ctx = steps_ctx
    tool_name = getattr(inner, "name", "unknown")
    tool_description = getattr(inner, "description", "")
    tool_schema = getattr(inner, "args_schema", None)

    class RecordingTool(BaseTool):
        name: str = tool_name
        description: str = tool_description
        args_schema: type = tool_schema

        def _run(self, **kwargs: Any) -> str:
            steps = ctx.get()
            if isinstance(steps, list):
                summary = ", ".join(f"{k}={str(v)[:60]}" for k, v in kwargs.items())[:200]
                steps.append({"tool": tool_name, "summary": summary or None})
            return inner._run(**kwargs)

    return RecordingTool()


_KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"
_MEMORY_DIR = Path(__file__).resolve().parent / "memory"
_WEEKDAYS_NL = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]


def _now_with_weekday() -> str:
    """Huidige datum en tijd met weekdag ervoor, bijv. Woensdag 2025-02-12 14:30:00."""
    dt = datetime.now()
    return f"{_WEEKDAYS_NL[dt.weekday()]} {dt.strftime('%Y-%m-%d %H:%M:%S')}"


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


def _build_sonja_agent(steps_ctx: ContextVar | None = None) -> Agent:
    all_tools = [
        serper_search_tool,
        scrape_website_tool,
        file_read_tool,
        write_to_memory_tool,
        rag_tool,
        spy_competitor_research_tool,
        send_email_tool,
        add_agenda_item_tool,
        list_agenda_items_tool,
        update_agenda_item_tool,
        delete_agenda_item_tool,
    ]
    if steps_ctx is not None:
        wrapped = []
        for t in all_tools:
            # Alle tools met _run wrappen (crewai BaseTool én crewai_tools zoals SerperDevTool, ScrapeWebsiteTool)
            if callable(getattr(t, "_run", None)) and getattr(t, "name", None):
                wrapped.append(_make_recording_tool(t, steps_ctx))
            else:
                wrapped.append(t)
        all_tools = wrapped
    return Agent(
        role="Digitale Marketeer · AFAS Software",
        goal=(
            "Je bent Sonja, jullie digitale collega: help met content, concurrentie-analyse en alles wat marketing betreft. "
            "Stel altijd eerst vragen om te begrijpen wat iemand wil (begrijpen > aannames); daarna pas aan de slag. "
            "Deel proactief inzichten en trends waar relevant — net als bij de koffieautomaat. "
            "Gebruik de juiste tools: serper_search en scrape_website voor web, read_file voor bestanden in knowledge/ of memory/ (gebruik memory/bestandsnaam voor herinneringen), rag_search voor semantisch zoeken in knowledge en herinneringen, "
            "write_to_memory om een nieuwe herinnering aan te maken (titel + inhoud; één bestand per herinnering in memory/), spy_competitor_research voor concurrentie-onderzoek, "
            "list_agenda_items / add_agenda_item / update_agenda_item / delete_agenda_item voor de agenda, send_email voor resultaten. "
            "Leer van feedback: sla het op met write_to_memory (één aanroep met titel en inhoud). "
            "Roep write_to_memory zo min mogelijk aan: bundel in één dense entry per herinnering. "
            "Wees behulpzaam, informeel waar het past, en antwoord in het Nederlands. Een grapje mag — dat hoort bij AFAS (Doen, Vertrouwen, Gek, Familie)."
        ),
        backstory=(
            "Je bent Sonja, de digitale marketeer van AFAS. Persoonlijkheid: proactief (deel spontaan inzichten), nieuwsgierig (vragen vóór je iets aanneemt), "
            "sociaal (informeel, humor, aandacht voor de persoon — Familie), leergierig (feedback opslaan en beter worden). "
            "Hoe je werkt: (1) Eerst vragen stellen — wat wil iemand bereiken, voor wie? (2) Met die context aan de slag; Doen, niet lullen. "
            "(3) Feedback en leerpunten opslaan als herinnering met write_to_memory (titel + inhoud; één bestand per herinnering). "
            "Tools: read_file voor knowledge/ of memory/ (memory/bestandsnaam), rag_search voor knowledge en herinneringen, write_to_memory om een nieuw bestand in memory/ aan te maken. "
            "Agenda: list_agenda_items, add_agenda_item, update_agenda_item, delete_agenda_item; bij geplande taken send_email voor het resultaat. "
            "Subagents roep je aan via tools (bijv. spy_competitor_research). Antwoord altijd in het Nederlands."
        ),
        tools=all_tools,
        verbose=True,
        allow_delegation=False,
    )


def _build_prompt(message: str, context: str) -> str:
    """Bouwt de prompt met datum, knowledge-hint en optioneel chatcontext."""
    prompt = message
    if context and context.strip():
        prompt = (
            f"Chatgeschiedenis (eerdere berichten in dit gesprek):\n\n{context.strip()}\n\n"
            f"Nieuw bericht van de gebruiker: {message}"
        )
    now = _now_with_weekday()
    knowledge_files = _get_knowledge_filenames()
    memory_files = _get_memory_filenames()
    context_lines = [f"[Huidige datum en tijd: {now}.]"]
    if knowledge_files:
        context_lines.append(
            f"[Kennis: er zijn knowledge-bestanden beschikbaar (bestanden: {', '.join(knowledge_files)}). "
            "Gebruik read_file met de bestandsnaam of rag_search om semantisch te zoeken.]"
        )
    if memory_files:
        context_lines.append(
            f"[Geheugen: er zijn herinneringen beschikbaar (bestanden: {', '.join(memory_files)}). "
            "Gebruik read_file met memory/bestandsnaam om een herinnering te lezen, of rag_search om semantisch te zoeken.]"
        )
    return "\n\n".join(context_lines) + "\n\n" + prompt


class SonjaAssistant:
    """Sonja: één CrewAI-agent met alle tools (search, scrape, knowledge, memory, RAG, agenda, e-mail, spy); geen Crew."""

    def __init__(self):
        self._steps_ctx: ContextVar = ContextVar("sonja_steps", default=[])
        self.agent = _build_sonja_agent(steps_ctx=self._steps_ctx)

    def chat(self, message: str, context: str = "") -> tuple[str, list[dict]]:
        """Eén bericht naar Sonja; optioneel eerdere context. Retourneert (antwoord, denkstappen)."""
        steps_list: list[dict] = []
        token = self._steps_ctx.set(steps_list)
        try:
            prompt = _build_prompt(message, context)
            result = self.agent.kickoff(messages=prompt)
            response = result.raw if hasattr(result, "raw") else str(result)
            return response, list(steps_list)
        finally:
            self._steps_ctx.reset(token)

    async def chat_async(self, message: str, context: str = "") -> tuple[str, list[dict]]:
        """Async variant voor gebruik vanuit FastAPI. Retourneert (antwoord, denkstappen)."""
        steps_list: list[dict] = []
        token = self._steps_ctx.set(steps_list)
        try:
            prompt = _build_prompt(message, context)
            result = await self.agent.kickoff_async(messages=prompt)
            response = result.raw if hasattr(result, "raw") else str(result)
            return response, list(steps_list)
        finally:
            self._steps_ctx.reset(token)


_sonja_instance: SonjaAssistant | None = None


def get_sonja() -> SonjaAssistant:
    """Singleton Sonja-instantie."""
    global _sonja_instance
    if _sonja_instance is None:
        _sonja_instance = SonjaAssistant()
    return _sonja_instance
