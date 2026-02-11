"""
spy_competitor_research: wrapt een CrewAI-agent die concurrentie-onderzoek doet.

Sonja roept deze tool aan om een concurrent te laten onderzoeken (web search).
De agent roept SerperDevTool precies 2× aan, daarna genereert hij een samenvatting.
"""

from datetime import datetime
from typing import Type

from crewai import Agent
from crewai.tools import BaseTool
from crewai_tools import SerperDevTool
from pydantic import BaseModel, Field


class SpyCompetitorResearchInput(BaseModel):
    """Input voor de spy_competitor_research tool."""
    competitor_name: str = Field(description="Naam van de concurrent of het bedrijf om te onderzoeken.")
    custom_instructions: str = Field(
        default="",
        description="Optioneel: specifieke focus of vragen voor het onderzoek.",
    )


class SpyCompetitorResearchTool(BaseTool):
    """
    Tool die een CrewAI-agent aanroept voor concurrentie-onderzoek.
    De agent gebruikt web search (Serper) en retourneert een samenvatting.
    """
    name: str = "spy_competitor_research"
    description: str = (
        "Laat een gespecialiseerde research-agent een concurrent of bedrijf onderzoeken via het web. "
        "Geef de naam van de concurrent op (bijv. Exact, Visma, Unit4). Optioneel: custom_instructions voor focus. "
        "Retourneert een korte samenvatting met bevindingen en bronnen."
    )
    args_schema: Type[BaseModel] = SpyCompetitorResearchInput

    def _run(self, competitor_name: str, custom_instructions: str = "") -> str:
        search_tool = SerperDevTool(country="nl", locale="nl", n_results=5)
        researcher = Agent(
            role="Competitive Intelligence Researcher",
            goal=(
                "Voer precies 2 zoekopdrachten uit met SerperDevTool, dan een samenvatting in het Nederlands. "
                "Geen meer, geen minder: exact 2× SerperDevTool aanroepen."
            ),
            backstory=(
                "Je bent een gespecialiseerde research-agent die als tool wordt aangeroepen door Sonja, "
                "de AI Marketing Coordinator van AFAS. Sonja helpt marketeers van AFAS; jij ondersteunt haar "
                "door concurrentie-onderzoek te doen. Je bent dus een subagent: je draait binnen de spy_competitor_research-tool "
                "en levert jouw resultaat terug aan Sonja, die het aan de gebruiker presenteert. "
                "Je hebt één tool: SerperDevTool (web search). Je moet die precies 2 keer gebruiken "
                "met de zoekqueries die in de opdracht staan. Daarna schrijf je een korte, heldere samenvatting "
                "in het Nederlands met bevindingen en bronnen (URLs), geschikt voor AFAS-marketeers."
            ),
            tools=[search_tool],
            verbose=False,
            allow_delegation=False,
        )
        today = datetime.now().strftime("%d-%m-%Y")
        search1_query = competitor_name.strip()
        search2_query = f"{competitor_name.strip()} laatste nieuws {today}"
        prompt = f"""Onderzoek de concurrent: {competitor_name}.

Je MOET SerperDevTool precies 2 keer aanroepen:

1. Eerste zoekopdracht – algemene informatie over de concurrent.
   Search query: "{search1_query}"
   (gebruik exact deze zoekterm)

2. Tweede zoekopdracht – laatste nieuws over de concurrent (vandaag = {today}).
   Search query: "{search2_query}"
   (gebruik exact deze zoekterm)

Na deze 2 zoekopdrachten: schrijf een korte samenvatting in het Nederlands met de belangrijkste bevindingen en alle bronnen (URLs). Voer geen derde zoekopdracht uit."""
        if (custom_instructions or "").strip():
            prompt += f"\n\nExtra instructies: {custom_instructions.strip()}"
        try:
            result = researcher.kickoff(prompt)
            return result.raw if hasattr(result, "raw") else str(result)
        except Exception as e:
            return f"Fout bij onderzoek: {e}"


spy_competitor_research_tool = SpyCompetitorResearchTool()
