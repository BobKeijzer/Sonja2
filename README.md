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
| Data     | JSON-bestanden; `knowledge/`, `memory/`, `data/agenda.json`; `call_transcripts/` voor gesprekstranscripts (lokaal) |

### Call transcripts

De tool `get_call_transcripts` haalt klantgesprek-transcripts op uit de map `backend/call_transcripts/` (lokaal) of uit uploads in de app.

- **Zonder Docker:** Maak de map `backend/call_transcripts/` aan en zet daar `.txt`- of `.md`-bestanden met transcripts. Sonja leest ze via de tool.
- **Met Docker:** Gebruik in de app **Instellingen → Call transcripts** om bestanden te uploaden (geen host-map nodig).
- De map staat in `.gitignore` en komt niet op GitHub. Later: transcript-platform-API.

## Functionaliteiten

- **Dynamische stappenlijst (Sonja SSE)** – Denkstappen (tool-aanroepen) streamen real-time binnen op chat, vergaderingen, website, concurrenten en nieuws.
- **Chat** – Gesprekken met Sonja, chatgeschiedenis, denkstappen (tools) en dynamische avatars (denken/regelen tijdens wachten, blij → koffie na antwoord)
- **Agenda** – Eén lijst taken (eenmalig en terugkerend, cron). Scheduler voert due items uit; per item wordt laatste run (datum, denkstappen, antwoord) op het item bewaard. Klik op een taak om uit te klappen. E-mail kan in de prompt (bijv. “mail het resultaat naar …”). Taken worden niet automatisch verwijderd; alleen de gebruiker kan verwijderen. Sonja kan via agenda-tools items aanmaken, aanpassen en verwijderen.
- **Vergaderingen** – Transcripties analyseren, actiepunten en leerpunten; herinneringen in `memory/`
- **Website-analyse** – Scrapen en analyseren van URLs (SEO, content, tone of voice)
- **Concurrentie** – Concurrenten beheren en onderzoeken (spy_competitor_research)
- **Nieuws** – RSS-feeds (o.a. NOS, Nu.nl, AD), gegenereerde inhakers, LinkedIn-posts en “betekenis voor AFAS”; eigen prompts en feeds instelbaar
- **Kennis** – Documenten in `knowledge/` (upload, nieuw, bewerken); Sonja gebruikt ze via RAG en read_file
- **Geheugen** – Herinneringen in `memory/` (één bestand per herinnering); alleen Sonja maakt ze aan via write_to_memory; bewerken/verwijderen in de UI
- **E-mail** – Notificaties via SMTP (bijv. Gmail met app password) voor agenda en resultaten

## Sonja-instanties

- **Chat** gebruikt één vaste Sonja-instantie (`get_sonja()`), zodat chatgeschiedenis en context behouden blijven.
- **Agenda-runs, vergaderingen, website-analyse, concurrenten, nieuws** gebruiken per aanroep/run een eigen instantie (`create_sonja_ephemeral()`), die na afloop wordt verworpen. Zo kunnen o.a. meerdere agenda-taken parallel lopen zonder de chat te blokkeren.

## Projectstructuur

```
AfasSonja/
├── backend/           # FastAPI, CrewAI-agent, tools
│   ├── main.py        # API (poort 8000): chat, agenda, kennis, memory, nieuws, vergaderingen, website, concurrenten
│   ├── sonja.py       # Agent: get_sonja() (chat-singleton), create_sonja_ephemeral() (agenda-run, vergaderingen, website, …)
│   ├── tools/         # RAG, read_file, write_to_memory, Serper, agenda, e-mail, spy, etc.
│   ├── knowledge/     # Kennisbestanden (.md/.txt)
│   ├── memory/        # Herinneringen (losse .md per entry; alleen via write_to_memory)
│   ├── call_transcripts/  # .txt/.md met transcripts (lokaal; niet op GitHub; zie sectie Call transcripts)
│   └── data/          # agenda.json (taken + last_run_*), competitors.json, news_feeds.json, news_prompts.json
├── frontend/          # Next.js App Router
│   ├── app/
│   ├── components/    # o.a. SonjaAvatar (mood), screens (chat, agenda, vergaderingen, website, concurrenten, nieuws, kennis, geheugen, cv, instellingen)
│   └── lib/           # API-client, types
├── docker-compose.yml
├── .env               # API-keys, zie hieronder
└── README.md
```

## Lokaal starten

**Lokaal (zonder Docker):** Volg de stappen hieronder. Agenda, kennis, geheugen en transcripts worden op je schijf opgeslagen in `backend/data/`, `backend/knowledge/`, `backend/memory/` en `backend/call_transcripts/` en blijven bewaard.

**Docker:** Zie de sectie [Docker](#docker-beide-in-eén-keer) verderop. Werkt direct met `docker compose up --build`, maar er zijn geen volumes: alle data (agenda, kennis, geheugen, geüploade transcripts) staat alleen in de container en is **niet persistent** — na `docker compose down` is die data weg. Handig om snel te testen; voor blijvende data kun je lokaal draaien.

### Vereisten

- Python 3.11+
- **uv** – Python package manager (als je die nog niet hebt: [install uv](https://docs.astral.sh/uv/getting-started/installation/), bijv. `curl -LsSf https://astral.sh/uv/install.sh | sh` of `pip install uv`)
- Node.js 18+
- npm

### Environment

Maak een `.env` in de **root** en vul in (backend leest deze bij Docker via `env_file`):

- `ANTHROPIC_API_KEY` – Claude (CrewAI)
- `SERPER_API_KEY` – Zoeken (Serper)
- `VOYAGEAI_API_KEY` – RAG-embeddings  
- `QDRANT_URL` – optioneel (default: `http://localhost:6333`) – vectordb voor RAG
- `OPENAI_MODEL_NAME` – bijv. `anthropic/claude-sonnet-4-5-20250929`
- `API_PORT=8000`
- **E-mail (optioneel)** – voor de send_email tool (SMTP):
  - `SMTP_HOST` – bijv. `smtp.gmail.com`
  - `SMTP_PORT` – `465` (SSL) of `587` (TLS)
  - `SMTP_USER` – je e-mailadres, bijv. `jouw@gmail.com`
  - `SMTP_PASSWORD` – wachtwoord; **voor Gmail: gebruik een [App Password](https://support.google.com/accounts/answer/185833)** (niet je gewone wachtwoord)
  - `EMAIL_FROM` – afzenderweergave, bijv. `Sonja AFAS <jouw@gmail.com>`

  Voorbeeld voor Gmail:
  ```env
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=465
  SMTP_USER=jouw@gmail.com
  SMTP_PASSWORD=xxxx xxxx xxxx xxxx
  EMAIL_FROM=Sonja AFAS <jouw@gmail.com>
  ```
  (Vervang `xxxx xxxx xxxx xxxx` door je 16-tekens app password van Google.)

### RAG (vectordb)

Voor zoeken in kennis en herinneringen moet Qdrant draaien. Start in een aparte terminal:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Zonder Qdrant werkt RAG niet (zoekindex vernieuwen en rag_search in de chat).

### Backend

Installeer eerst de dependencies (vanuit de **root** van het project):

```bash
uv pip install -r backend/requirements.txt
```

Start daarna de server:

```bash
cd backend
uv run uvicorn main:app --reload
```

Zie [backend/README.md](backend/README.md) voor details.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000. Zie [frontend/README.md](frontend/README.md) voor details.

## Docker (beide in één keer)

Vanuit de **root**:

```bash
docker compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# Qdrant (RAG): meegestart op http://localhost:6333
```

Docker Compose start **backend**, **frontend** en **Qdrant** (vectordb voor RAG). De backend krijgt automatisch `QDRANT_URL=http://qdrant:6333`, zodat kennis aanmaken/uploaden en RAG-zoeken werken. Je hoeft Qdrant niet apart te starten.

- **Geen persistente data:** Er worden geen volumes gemount. Agenda, kennis, geheugen en geüploade transcripts staan alleen in de container en zijn **weg na `docker compose down`**. Geschikt om snel te proberen; voor blijvende data: lokaal draaien (zie [Lokaal starten](#lokaal-starten)).
- **Call transcripts:** Met Docker kun je in de app **Instellingen → Call transcripts** bestanden uploaden; die blijven zolang de container draait.
- Zorg voor een `.env` in de root met de benodigde API-keys. De frontend praat met de backend op `http://localhost:8000`.
