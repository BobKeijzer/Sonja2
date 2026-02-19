"""
Serper tool: zoekresultaten en snippets via Google Search API.

Gebruik voor: zoeken op het web, snippets en links ophalen.
Niet voor: volledige pagina-inhoud; gebruik daarvoor scrape_website.
"""

import os
from crewai_tools import SerperDevTool

# Serper: search results + snippets (country/locale NL)
serper_search_tool = SerperDevTool(
    country="nl",
    locale="nl",
    n_results=5,
)
# Consistente toolnaam voor goal en step_display_label in sonja.py
serper_search_tool.name = "web_search"
