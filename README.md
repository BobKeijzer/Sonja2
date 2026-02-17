# Sonja – Digitale Marketeer

AI-gestuurde marketingassistent voor AFAS Software: CrewAI (Claude) als backend, Next.js als frontend.

## Tech stack

| Laag     | Technologie                                      |
| -------- | ------------------------------------------------ |
| Backend  | Python 3.11, FastAPI, CrewAI (Anthropic Claude) |
| Frontend | Next.js 15, React 19, TypeScript                 |
| UI       | Tailwind CSS, Shadcn/ui                          |
| Zoeken   | Serper API                                       |
| RAG      | Qdrant (Docker) + VoyageAI embeddings             |
| Nieuws   | RSS (feedparser), configuratie in `data/`        |
| Data     | JSON-bestanden; `knowledge/` en `memory/`        |

## Functionaliteiten

- **Dynamische stappenlijst (Sonja SSE)** – Denkstappen (tool-aanroepen) streamen real-time binnen op chat, vergaderingen, website, concurrenten en nieuws.
- **Chat** – Gesprekken met Sonja, chatgeschiedenis, denkstappen (tools) en dynamische avatars (denken/regelen tijdens wachten, blij → koffie na antwoord)
- **Agenda** – Taken en afspraken (eenmalig en terugkerend, cron), e-mail bij afgeronde taken
- **Vergaderingen** – Transcripties analyseren, actiepunten en leerpunten; herinneringen in `memory/`
- **Website-analyse** – Scrapen en analyseren van URLs (SEO, content, tone of voice)
- **Concurrentie** – Concurrenten beheren en onderzoeken (spy_competitor_research)
- **Nieuws** – RSS-feeds (o.a. NOS, Nu.nl, AD), gegenereerde inhakers, LinkedIn-posts en “betekenis voor AFAS”; eigen prompts en feeds instelbaar
- **Kennis** – Documenten in `knowledge/` (upload, nieuw, bewerken); Sonja gebruikt ze via RAG en read_file
- **Geheugen** – Herinneringen in `memory/` (één bestand per herinnering); alleen Sonja maakt ze aan via write_to_memory; bewerken/verwijderen in de UI
- **E-mail** – Notificaties via SMTP (o.a. Outlook) voor agenda en resultaten

## Projectstructuur

```
AfasSonja/
├── backend/           # FastAPI, CrewAI-agent, tools
│   ├── main.py        # API (poort 8000): chat, agenda, kennis, memory, nieuws, vergaderingen, website, concurrenten
│   ├── sonja.py       # Agent-definitie, tools, knowledge + memory in context
│   ├── tools/         # RAG, read_file, write_to_memory, Serper, agenda, e-mail, spy, etc.
│   ├── knowledge/     # Kennisbestanden (.md/.txt)
│   ├── memory/        # Herinneringen (losse .md per entry; alleen via write_to_memory)
│   └── data/          # agenda.json, competitors.json, news_feeds.json, news_prompts.json
├── frontend/          # Next.js App Router
│   ├── app/
│   ├── components/    # o.a. SonjaAvatar (mood), screens (chat, agenda, vergaderingen, website, concurrenten, nieuws, kennis, geheugen, cv, instellingen)
│   └── lib/           # API-client, types
├── docker-compose.yml
├── .env               # API-keys, zie hieronder
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
- `SERPER_API_KEY` – Zoeken (Serper)
- `VOYAGEAI_API_KEY` – RAG-embeddings  
- `QDRANT_URL` – optioneel (default: `http://localhost:6333`) – vectordb voor RAG
- `OPENAI_MODEL_NAME` – bijv. `anthropic/claude-sonnet-4-5-20250929`
- `API_PORT=8000`
- **E-mail (optioneel)** – voor send_email en geplande agenda-taken:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`

### RAG (vectordb)

Voor zoeken in kennis en herinneringen moet Qdrant draaien. Start in een aparte terminal:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Zonder Qdrant werkt RAG niet (zoekindex vernieuwen en rag_search in de chat).

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
docker compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

De frontend gebruikt de backend op `http://localhost:8000`. Zorg voor een `.env` in de root met de benodigde API-keys.
