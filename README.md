# Sonja – Digitale Marketeer

AI-gestuurde marketingassistent voor AFAS Software: CrewAI (Claude) als backend, Next.js als frontend.

## Tech stack

| Laag      | Technologie                          |
|-----------|--------------------------------------|
| Backend   | Python 3.11, FastAPI, CrewAI (Anthropic Claude) |
| Frontend  | Next.js 15, React 19, TypeScript     |
| UI        | Tailwind CSS, Shadcn/ui               |
| Zoeken    | Serper API                            |
| RAG       | Chroma (lokaal), VoyageAI embeddings  |
| Data      | JSON-bestanden, knowledge/ als kennisbank |

## Functionaliteiten

- **Chat** – Gesprekken met Sonja, inclusief chatgeschiedenis en weergave van gebruikte tools
- **Agenda** – Taken en afspraken (eenmalig en terugkerend, cron)
- **Vergaderingen** – Transcripties analyseren, actiepunten extraheren
- **Website-analyse** – Scrapen en analyseren van URLs
- **Concurrentie** – Concurrenten beheren en onderzoeken
- **Kennisbank** – Geheugen (memory.md) en RAG-zoeken over knowledge/
- **E-mail** – Notificaties via SMTP (o.a. Outlook)

## Projectstructuur

```
AfasSonja/
├── backend/          # FastAPI, CrewAI-agent, tools
│   ├── main.py       # API (poort 8000)
│   ├── sonja.py      # Agent-definitie
│   ├── tools/        # RAG, zoeken, agenda, e-mail, etc.
│   ├── knowledge/    # Kennisbestanden + chroma_db (RAG)
│   └── data/         # Agenda, concurrenten (JSON)
├── frontend/         # Next.js App Router
│   ├── app/
│   ├── components/
│   └── lib/          # API-client, types
├── docker-compose.yml
├── .env              # API-keys, zie hieronder
└── README.md
```

## Lokaal starten

### Vereisten

- Python 3.11+
- Node.js 18+
- pnpm

### Environment

Maak een `.env` in de **root** en vul in (backend leest deze bij Docker via `env_file`):

- `ANTHROPIC_API_KEY` – Claude (CrewAI)
- `SERPER_API_KEY` – Google Search
- `VOYAGEAI_API_KEY` – RAG-embeddings
- `OPENAI_MODEL_NAME` – bijv. `anthropic/claude-sonnet-4-5-20250929`
- `API_PORT=8000`
- **E-mail (optioneel)** – nodig voor send_email-tool en resultaten geplande taken:
  - `SMTP_HOST` – bijv. `smtp-mail.outlook.com`
  - `SMTP_PORT` – meestal `587`
  - `SMTP_USER` – inlog-e-mailadres
  - `SMTP_PASSWORD` – wachtwoord (of app-wachtwoord)
  - `EMAIL_FROM` – afzenderadres (vaak gelijk aan `SMTP_USER`)

### Backend

```bash
cd backend
uv run uvicorn main:app --reload
```

Zie [backend/README.md](backend/README.md) voor details.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend: http://localhost:3000. Zie [frontend/README.md](frontend/README.md) voor details.

## Docker (beide in één keer)

Vanuit de **root**:

```bash
# Bouwen en starten
docker compose up --build

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

De frontend praat met de backend op `http://localhost:8000`. Zorg dat je een `.env` in de root hebt (of geef backend env via `docker compose`), anders ontbreken API-keys.

Zie [backend/README.md](backend/README.md) en [frontend/README.md](frontend/README.md) voor Docker-details per onderdeel.
