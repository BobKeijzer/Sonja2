# Sonja - Digitale Marketeer

AI-gestuurde marketing assistent voor AFAS Software, gebouwd met CrewAI (Claude) als backend en Next.js als frontend.

## Tech Stack

| Laag | Technologie |
|------|-------------|
| Backend | Python, FastAPI, CrewAI (Anthropic Claude) |
| Frontend | Next.js 15, React 19, TypeScript |
| UI | Tailwind CSS, Shadcn/ui |
| Zoeken | Serper API (Google Search) |
| Embeddings | VoyageAI |
| Data opslag | JSON bestanden |

## Functionaliteiten

- **Chat** - Gesprekken voeren met Sonja, inclusief weergave van gebruikte tools (thinking steps)
- **Agenda** - Taken en afspraken beheren, met ondersteuning voor eenmalige en terugkerende items (cron)
- **Vergaderingen** - Transcripties analyseren en actiepunten extraheren
- **Website-analyse** - Websites scrapen en analyseren
- **Concurrentie-analyse** - Concurrenten bijhouden en onderzoeken
- **Kennisbank** - Persistent geheugen en RAG-zoeken over kennisbestanden
- **E-mail** - Notificaties versturen via SMTP (Outlook)

## Projectstructuur

```
backend/
  main.py          # FastAPI server (poort 8000)
  sonja.py         # CrewAI Agent definitie
  agenda.py        # Agendabeheer
  competitors.py   # Concurrentenbeheer
  tools/           # AI agent tools (zoeken, scrapen, RAG, e-mail, etc.)
  knowledge/       # Kennisbank bestanden
  data/            # JSON opslag (agenda, concurrenten)

frontend/
  app/             # Next.js App Router
  components/
    screens/       # Feature schermen (chat, agenda, meetings, etc.)
    ui/            # Shadcn/ui componenten
  lib/             # API client, types, utilities
```

## Starten

### Vereisten

- Python 3.x
- Node.js
- pnpm

### Environment variabelen

Maak een `.env` bestand in de root met:

```
ANTHROPIC_API_KEY=
SERPER_API_KEY=
VOYAGEAI_API_KEY=
OPENAI_MODEL_NAME=
API_PORT=8000
SMTP_SERVER=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
```

### Backend

```bash
cd backend
uv run uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```
