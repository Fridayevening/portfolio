# NewBoy — Architecture and Operations

This document contains stable technical context. Current progress, blockers, and the next action belong in `HANDOFF.md`; active ownership belongs in `TASKS.md`.

## Product

NewBoy is Yanfei's personal portfolio presented as an interactive Windows 95-style desktop. It includes windows, a start menu, a virtual file system, notes, games, market data, news, and image-processing tools.

## Repository layout

```text
Yanfeiportfolio/
├── frontend/              # Next.js application on port 3030
├── server/                # NestJS API on port 3031 with /v1 prefix
│   └── python/            # Frozen copies of Hotaru and laser scripts
├── docs/                  # Architecture, decisions, and task handoffs
├── AGENTS.md              # Shared instructions for coding agents
├── HANDOFF.md             # Current integration snapshot
├── TASKS.md               # Work ownership and status
└── MIGRATION-PLAN.md      # Proposed portfolio-content migration
```

## Technology stack

| Layer | Technology | Current baseline |
|---|---|---|
| Frontend | Next.js App Router, React, Tailwind CSS, three.js, jsnes | Next.js 16.3.4, React 19.2.8 |
| Backend | NestJS, MongoDB native driver, `@nestjs/schedule`, undici | NestJS 12, MongoDB driver 7.6 |
| Database | Local MongoDB database `newboy` | MongoDB 8.0.32 |
| Processing | Pillow, NumPy, PyAV | Python 3.12 compatible |
| Package management | npm and pip | Node.js 24 LTS required |

## Runtime topology

```text
Browser
  └── Next.js :3030
        └── NestJS :3031/v1
              ├── MongoDB 127.0.0.1:27017/newboy
              ├── Market and news providers
              └── Python image and video processes
```

## Local setup

1. Use Node.js 24 LTS. Node.js 23 is incompatible with the current Nest CLI toolchain.
2. Run MongoDB on `127.0.0.1:27017`.
3. Run `npm install` in both `server/` and `frontend/`.
4. Copy `server/.env.example` to `server/.env` and provide a private `OWNER_TOKEN` of at least eight characters.
5. Run `npm run python:setup` in `server/` before starting the backend when Hotaru support is required.
6. Never commit local environment files.

Development commands:

```bash
cd server && npm run dev
cd frontend && npm run dev
```

Health and integration checks:

```bash
curl http://127.0.0.1:3031/v1/health
curl http://127.0.0.1:3031/v1/market/quotes
curl http://127.0.0.1:3031/v1/news/today
curl http://127.0.0.1:3031/v1/hotaru/ping
```

## Backend modules

| Module | Responsibility |
|---|---|
| `health` | Service health endpoint |
| `auth` | Owner-token unlock with fail-closed behavior |
| `articles` | Article CRUD and visibility |
| `files` | Virtual file system, trash, copy, move, and restore |
| `news` | Concurrent news ingestion and optional AI curation |
| `market` | CoinGecko watchlist, five-minute polling, and SSE |
| `preferences` | Persistent UI preferences |
| `hotaru` | Python image and video processing orchestration |
| `lab` | Laser-card rendering; Blender is optional and not installed locally |

The API uses the global `/v1` prefix and validation pipes. MongoDB connections are lazy, IDs use base36, and a three-second database timeout becomes a 503 response.

## Internationalization

The frontend uses a lightweight in-house language system without locale routes.

- `frontend/src/lib/i18n/dict.ts` is the dictionary. Chinese defines the key set; English is constrained by `keyof typeof zh`, so missing translations fail type checking.
- `LanguageProvider` and `useI18n()` expose `lang`, `setLang`, and `t`.
- The `nb-lang` cookie persists `zh` or `en`. The root layout reads it for SSR.
- Static window definitions use `titleKey`; runtime portfolio windows provide `titleByLang` so open title bars and taskbar entries switch immediately.
- Symbol metadata includes English names and is selected through `symName()`.
- The English UI has been checked for Chinese SSR residue.

Backend errors use `server/src/i18n.ts`, `lang.middleware.ts`, `LocalizedError`, and request-scoped language state. Background jobs persist translation keys and translate them when their status is read.

SSE market alerts send structured fields instead of prebuilt Chinese sentences because browser `EventSource` cannot attach the custom language header. The frontend formats those fields in the active language.

Chinese-only news is filtered from English editions. Curated bilingual news selects the matching fields at render time.

## Data-integrity rules

- Market and news failures preserve the last valid data. They never generate plausible-looking replacements.
- Portfolio claims and metrics must have reviewable evidence before publication.
- Draft or `needs-review` portfolio content must not enter the public site.
- `server/python/hotaru.py` is a frozen integration copy; synchronize it from its upstream source rather than editing it independently.

## Known operational constraints

1. An undici `ProxyAgent` connection through a local HTTP proxy can fail during the first TLS connection to a cold domain. Market JSON requests retry network errors three times with short delays; rate limits remain the engine's responsibility.
2. News still uses the older single retry after three seconds and may miss transient failures.
3. The backend fixes the Python executable path at startup. If the virtual environment is created later, restart the backend.
4. `MARKET_PROXY_URL` defaults to direct access. Configure an optional local HTTP proxy through environment variables when required.
5. The laser-card lab requires Blender. Its absence does not affect the rest of the product.
6. Frontend public media is approximately 42 MB. It fits the current Vercel Hobby source-upload limit, but the 23 MB audio file should be monitored for bandwidth usage.
7. The backend requires a persistent runtime because market SSE uses long-lived connections; it is not suitable for a purely serverless deployment.

## Deployment outline

Production preparation is implemented; no external environment has been created. The selected topology is:

1. Vercel hosts the Next.js frontend from `frontend/`.
2. Render hosts the NestJS API from `server/Dockerfile`; automatic deploys are disabled.
3. MongoDB Atlas hosts the `newboy` database.
4. Render secrets provide `MONGODB_URI`, `OWNER_TOKEN` and `CORS_ORIGINS`; Vercel provides build-time `NEXT_PUBLIC_API_URL`.
5. The container includes the Hotaru Python environment. Blender is deliberately absent, so the optional laser-card lab reports unavailable without affecting the rest of the site.
6. The first release treats runtime uploads and processing artifacts as ephemeral. A paid persistent disk or object storage is required before promising durable uploaded images.

See `docs/DEPLOYMENT.md` for staging, production, verification and rollback steps.

Any deployment, public release, or production configuration change requires Yanfei's explicit approval.
