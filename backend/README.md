# Sonja Backend

FastAPI-server voor de Sonja-agent (CrewAI + Claude). Bevat chat, agenda, kennis (`knowledge/`), geheugen (`memory/`), RAG, vergaderingen, website-analyse, concurrentie, nieuws (RSS + genereren) en e-mail.

## Vereisten

- Python 3.11+
- `.env` in projectroot met o.a. `ANTHROPIC_API_KEY`, `SERPER_API_KEY`, `VOYAGEAI_API_KEY`, `OPENAI_MODEL_NAME`

## Lokaal

```bash
# vanuit repo-root
cd backend
uv run uvicorn main:app --reload
```

API: http://localhost:8000 (of `API_PORT` uit `.env`). Docs: http://localhost:8000/docs.

## Docker

```bash
# vanuit backend/
docker build -t sonja-backend .
docker run -p 8000:8000 --env-file ../.env sonja-backend
```

Of via root: `docker compose up` (start backend + frontend).

## Belangrijke paden en API

- **main.py** – FastAPI-app, CORS, alle routes
- **sonja.py** – CrewAI-agent, tools, context uit knowledge + memory
- **tools/** – o.a. `rag_tool` (Chroma + Voyage, indexeert knowledge/ en memory/), `file_read` (knowledge/ of memory/), `write_to_memory` (nieuwe herinnering in memory/), Serper, agenda, e-mail, spy_competitor_research
- **knowledge/** – Kennisbestanden (.md/.txt); RAG-index en bestandenlijst voor frontend
- **memory/** – Herinneringen (één .md per entry, naam o.a. `DD-MM-YYYY_HH-MM_slug.md`); alleen aanmaak via write_to_memory; frontend kan lijst, openen, bewerken, verwijderen
- **data/** – `agenda.json`, `competitors.json`, `news_feeds.json` (RSS-URL’s), `news_prompts.json` (standaardprompts voor inhaker/LinkedIn/betekenis AFAS)

### API-overzicht

| Gebied      | Endpoints |
| ----------- | --------- |
| Chat        | `POST /chat` |
| Agenda      | `GET/POST /agenda`, `GET/PUT/DELETE /agenda/{id}` |
| Kennis      | `GET /knowledge`, `GET/PUT/DELETE /knowledge/{filename}`, `POST /knowledge/upload`, `POST /knowledge/create`, `POST /knowledge/refresh` |
| Geheugen    | `GET /memory`, `GET/PUT/DELETE /memory/{filename}` |
| Nieuws      | `GET /news`, `GET/PUT /news/feeds`, `GET/PUT /news/prompts`, `POST /news/generate` |
| Vergaderingen | `POST /meetings/extract` |
| Website     | `POST /analyze/website` |
| Concurrenten | `GET/POST/PATCH/DELETE /competitors`, `POST /analyze/competitors` |

## Env (samenvatting)

| Variabele           | Verplicht | Beschrijving        |
| ------------------- | --------- | ------------------- |
| `ANTHROPIC_API_KEY` | ja        | Claude (CrewAI)     |
| `VOYAGEAI_API_KEY`  | ja        | RAG-embeddings      |
| `SERPER_API_KEY`    | ja        | Zoeken              |
| `OPENAI_MODEL_NAME` | ja        | Modelnaam voor CrewAI |
| `API_PORT`          | nee       | Poort (default 8000) |

**E-mail (optioneel)** – voor send_email en agenda-resultaten:

| Variabele      | Beschrijving |
| -------------- | ------------ |
| `SMTP_HOST`    | bijv. smtp-mail.outlook.com |
| `SMTP_PORT`    | Meestal 587  |
| `SMTP_USER`    | Inlog-e-mail |
| `SMTP_PASSWORD`| Wachtwoord of app-wachtwoord |
| `EMAIL_FROM`   | Afzender (vaak = SMTP_USER) |
