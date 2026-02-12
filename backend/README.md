# Sonja Backend

FastAPI-server voor de Sonja-agent (CrewAI + Claude). Bevat chat, agenda, kennisbank (RAG), vergaderingen, website-analyse, concurrentie en e-mail.

## Vereisten

- Python 3.11+
- `.env` in projectroot met o.a. `ANTHROPIC_API_KEY`, `SERPER_API_KEY`, `VOYAGEAI_API_KEY`

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

## Belangrijke paden

- `main.py` – FastAPI-app, CORS, routes
- `sonja.py` – CrewAI-agent en tools
- `tools/` – o.a. RAG (Chroma + Voyage), Serper, agenda, e-mail
- `knowledge/` – kennisbestanden; `chroma_db/` wordt hier aangemaakt voor RAG
- `data/` – `agenda.json`, `competitors.json`

## Env (samenvatting)

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `ANTHROPIC_API_KEY` | ja | Claude (CrewAI) |
| `VOYAGEAI_API_KEY` | ja | RAG-embeddings |
| `SERPER_API_KEY` | ja | Zoeken |
| `OPENAI_MODEL_NAME` | ja | Modelnaam voor CrewAI |
| `API_PORT` | nee | Poort (default 8000) |

**E-mail (optioneel)** – nodig voor de send_email-tool en e-mailresultaten van geplande agenda-taken:

| Variabele | Beschrijving |
|-----------|--------------|
| `SMTP_HOST` | SMTP-server, bijv. `smtp-mail.outlook.com` (Outlook) of `smtp.gmail.com` |
| `SMTP_PORT` | Poort (meestal `587`) |
| `SMTP_USER` | Inlog-e-mailadres |
| `SMTP_PASSWORD` | Wachtwoord of app-wachtwoord |
| `EMAIL_FROM` | Afzenderadres (vaak hetzelfde als `SMTP_USER`) |
