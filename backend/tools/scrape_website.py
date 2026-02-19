"""
ScrapeWebsite tool: scrape de inhoud van een webpagina op basis van URL.

Gebruik wanneer je meer informatie nodig hebt van een specifieke pagina
(bijv. na een Serper-zoekopdracht, wanneer een URL relevant lijkt).
"""

from crewai_tools import ScrapeWebsiteTool

scrape_website_tool = ScrapeWebsiteTool()
# Consistente toolnaam voor goal en step_display_label in sonja.py
scrape_website_tool.name = "scrape_website"
