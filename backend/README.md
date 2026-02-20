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
- **tools/** – o.a. `rag_tool` (Qdrant + Voyage, indexeert knowledge/ en memory/), `file_read` (knowledge/ of memory/), `write_to_memory` (nieuwe herinnering in memory/), Serper, agenda, e-mail, spy_competitor_research, `get_call_transcripts` (transcripts uit call_transcripts/)
- **knowledge/** – Kennisbestanden (.md/.txt); RAG-index en bestandenlijst voor frontend
- **memory/** – Herinneringen (één .md per entry, naam o.a. `DD-MM-YYYY_HH-MM_slug.md`); alleen aanmaak via write_to_memory; frontend kan lijst, openen, bewerken, verwijderen
- **call_transcripts/** – Optioneel; niet in git. Zet hier .txt/.md met klantgesprek-transcripts om `get_call_transcripts` te testen (zie hoofd-README).
- **data/** – `agenda.json` (agenda-items, per item o.a. `last_run_at`, `last_run_response`, `last_run_steps`), `competitors.json`, `news_feeds.json`, `news_prompts.json`

### Sonja-instanties (sonja.py)

- **get_sonja()** – Eén singleton voor de **chat**: blijft bestaan, chatcontext blijft beschikbaar.
- **create_sonja_ephemeral()** – Nieuwe instantie voor eenmalig gebruik; wordt nergens bewaard en door Python opgeruimd na afloop. Gebruikt door:
  - **Agenda**: elke due-run krijgt een eigen Sonja (parallel mogelijk).
  - **Vergaderingen, website-analyse, concurrenten, nieuws**: per request een eigen instantie.

### Agenda

- **Opslag**: `data/agenda.json`. Items hebben o.a. `title`, `prompt`, `type` (once/recurring), `schedule` (ISO of cron), `last_run_at`, `last_run_response`, `last_run_steps`.
- **Scheduler**: Elke minuut `get_due_items()` (tijdzone Europe/Amsterdam); voor elk due item start een thread met een eigen ephemeral Sonja. Na de run wordt op het item `last_run_at`, `last_run_response` en `last_run_steps` gezet. Taken worden nooit automatisch verwijderd.
- **Sonja** heeft de tools `list_agenda_items`, `add_agenda_item`, `update_agenda_item`, `delete_agenda_item` om vanuit chat de agenda te beheren.
- **Frontend**: Eén lijst, gesorteerd op laatste run (of aanmaak); klik op een taak om uit te klappen en laatste run (datum, denkstappen, antwoord) te zien.

### API-overzicht

| Gebied      | Endpoints |
| ----------- | --------- |
| Chat        | `POST /chat/stream` |
| Agenda      | `GET/POST /agenda`, `GET/PUT/DELETE /agenda/{id}` |
| Kennis      | `GET /knowledge`, `GET/PUT/DELETE /knowledge/{filename}`, `POST /knowledge/upload`, `POST /knowledge/create`, `POST /knowledge/refresh` |
| Geheugen    | `GET /memory`, `GET/PUT/DELETE /memory/{filename}` |
| Call transcripts | `GET /call_transcripts`, `POST /call_transcripts/upload` |
| Nieuws      | `GET /news`, `GET/PUT /news/feeds`, `GET/PUT /news/prompts`, `POST /news/generate/stream` |
| Vergaderingen | `POST /meetings/extract/stream` |
| Website     | `POST /analyze/website/stream` |
| Concurrenten | `GET/POST/PATCH/DELETE /competitors`, `POST /analyze/competitors/stream` |

## Env (samenvatting)

| Variabele           | Verplicht | Beschrijving        |
| ------------------- | --------- | ------------------- |
| `ANTHROPIC_API_KEY` | ja        | Claude (CrewAI)     |
| `VOYAGEAI_API_KEY`  | ja        | RAG-embeddings      |
| `SERPER_API_KEY`    | ja        | Zoeken              |
| `OPENAI_MODEL_NAME` | ja        | Modelnaam voor CrewAI |
| `API_PORT`          | nee       | Poort (default 8000) |

**E-mail (optioneel)** – voor de send_email tool (SMTP):

| Variabele       | Beschrijving |
| --------------- | ------------ |
| `SMTP_HOST`     | SMTP-server, bijv. `smtp.gmail.com` of `smtp-mail.outlook.com` |
| `SMTP_PORT`     | `465` (SSL) of `587` (TLS) |
| `SMTP_USER`     | Inlog-e-mail (bijv. `jouw@gmail.com`) |
| `SMTP_PASSWORD` | Wachtwoord. **Gmail: gebruik een [App Password](https://support.google.com/accounts/answer/185833)** (16 tekens), niet je gewone wachtwoord |
| `EMAIL_FROM`    | Afzenderweergave, bijv. `Sonja AFAS <jouw@gmail.com>` |

Voorbeeld voor Gmail (app password in Google-account onder Beveiliging → Wachtwoorden voor apps):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=jouw@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
EMAIL_FROM=Sonja AFAS <jouw@gmail.com>
```
