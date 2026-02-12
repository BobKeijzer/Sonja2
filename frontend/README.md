# Sonja Frontend

Next.js 15-app voor de Sonja-UI: chat, agenda, vergaderingen, kennisbank, concurrentie, website-analyse.

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

Of via root: `docker compose up` (start backend + frontend). De compose-setup zet `NEXT_PUBLIC_API_URL` zodat de browser de backend op localhost:8000 bereikt.

## Build

```bash
pnpm build
pnpm start
```

## Env

| Variabele | Beschrijving |
|-----------|--------------|
| `NEXT_PUBLIC_API_URL` | Backend-URL (voor de browser), bijv. `http://localhost:8000` |
