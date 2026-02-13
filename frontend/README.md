# Sonja Frontend

Next.js 15-app voor de Sonja-UI: chat, agenda, vergaderingen, website-analyse, concurrenten, nieuws, kennis, geheugen, CV en instellingen.

## Vereisten

- Node.js 18+
- pnpm
- Backend draait op poort 8000 (of zet `NEXT_PUBLIC_API_URL`)

## Lokaal

```bash
# vanuit repo-root
cd frontend
pnpm install
pnpm dev
```

App: http://localhost:3000. API-URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

## Docker

```bash
# vanuit frontend/
docker build -t sonja-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000 sonja-frontend
```

Of via root: `docker compose up` (start backend + frontend). De compose-setup zet `NEXT_PUBLIC_API_URL` zodat de browser de backend bereikt.

## Build

```bash
pnpm build
pnpm start
```

## Schermen

| Scherm         | Beschrijving |
| -------------- | ------------ |
| Chat           | Gesprek met Sonja, suggestiekaarten, denkstappen; tijdens wachten afwisselend “denken”/“regelen”, na antwoord blij → na 3s koffie |
| Agenda         | Taken (eenmalig/terugkerend), aanmaken/bewerken/verwijderen |
| Vergaderingen  | Transcript upload, actiepunten/leerpunten; tijdens analyse denken/regelen, daarna blij/koffie |
| Website        | URL-invoer, analyse; zelfde avatar-flow bij laden/resultaat |
| Concurrenten   | Lijst, toevoegen/verwijderen, analyse met geselecteerde; avatar-flow bij laden/resultaat |
| Nieuws         | RSS-lijst, feeds/prompts instellen, per item: Inhaker, LinkedIn, Betekenis AFAS, eigen prompt; resultaat in modal met blij/koffie |
| Kennis         | Documenten in knowledge/: upload, nieuw, openen, bewerken, verwijderen |
| Geheugen       | Herinneringen in memory/: lijst, openen, bewerken, verwijderen (alleen Sonja maakt nieuwe aan) |
| Sonja’s CV     | Profiel en vaardigheden |
| Instellingen   | o.a. donkere modus, denkstappen, suggestiekaarten |

## Componenten

- **SonjaAvatar** – Mood-avatars (blij, koffie, denken, regelen, boos, verdrietig) met vaste framing; gebruikt in sidebar, chat, CV en bij laden/resultaat op vergaderingen, website, concurrenten en nieuws.
- **ThinkingSteps** – Weergave van tool-aanroepen (denkstappen) bij chat en analyses.

## Env

| Variabele             | Beschrijving |
| --------------------- | ------------ |
| `NEXT_PUBLIC_API_URL` | Backend-URL (voor de browser), bijv. `http://localhost:8000` |
