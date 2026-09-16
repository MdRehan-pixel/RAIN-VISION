# RAIN VISION

**Pan-India Heavy Rainfall & Inundation Early Warning System**

RAIN VISION is a functional Smart India Hackathon 2026 prototype command center for combining public weather/model signals, GIS context, deterministic data fusion, prototype inundation scoring, geofenced browser alerts, and offline resilience. It is a decision-support prototype, not an official government warning system.

## SIH problem statement

“AI/ML-Based Integrated heavy rainfall Early Warning and Inundation Prediction System using Satellite, Radar, observational Weather and numerical weather prediction model data.”

## What is implemented

- Native browser GPS with explicit Bengaluru demo fallback, search via Open-Meteo geocoding, and exact map-click coordinates
- Open-Meteo current/hourly forecast and public ECMWF model attempt through FastAPI; RainViewer radar metadata when technically available
- Real OpenStreetMap Leaflet map, monitoring radius, surrounding weather points, and live-mode pan-India city markers
- Prototype AI/data-fusion risk engine and rainfall-driven inundation estimate with transparent factors and disclaimers
- Local registration, masked recipient display, geofenced high/extreme warnings, browser Notification API alerts, cooldown/de-duplication
- Twilio Programmable Messaging adapter with automatic live HIGH/EXTREME sends, test alerts, idempotency, signed status callbacks, and Mongo delivery-state persistence
- Automatic online/offline detection, localStorage cache, cached refresh survival, automatic live recovery, and jury demo network failure
- Accelerated emergency scenario, analytics trends, provenance ledger, future SMS/edge/LoRa architecture labels, and responsive settings

## Architecture

```text
GPS / search / map click
          ↓ exact active coordinates
FastAPI /api forecast + geocode + spatial + pan-india + radar
          ↓ Open-Meteo / ECMWF attempt / RainViewer metadata
Deterministic prototype fusion + inundation engine
          ↓
Leaflet GIS · alerts · browser notifications · Twilio SMS · localStorage cache
          ↓ network loss → latest known data + local alert engine
```

The frontend uses TanStack Query and the typed relative `/api` fetch layer. Backend routes are mounted under the template `api_router`. MongoDB remains available through the template shared handle; this MVP keeps registration/cache client-local to avoid unnecessary persistence infrastructure.

## Data sources and honest status

| Source | Purpose | Status |
|---|---|---|
| Open-Meteo | Current and hourly weather, geocoding | LIVE when upstream responds |
| ECMWF IFS via Open-Meteo | NWP/model signal | LIVE when accepted, otherwise Open-Meteo auto model |
| RainViewer | Dynamic radar metadata | LIVE or UNAVAILABLE; not satellite and not India-wide |
| OpenStreetMap | Map tiles | LIVE public map tiles with attribution |
| SatelliteAdapter | Cloud/satellite signal | SIMULATED demo adapter; no ISRO claim |
| Risk engine | Weighted prototype fusion | ACTIVE; requires historical calibration |
| Cache/offline | Last successful weather/risk/snapshot | FALLBACK when disconnected |
| Twilio Programmable Messaging | SMS submission and signed delivery callbacks | CONFIGURED when credentials/sender exist; provider states only |
| Cellular / LoRa edge | Communication-blackout architecture | FUTURE; no hardware is claimed |

## Risk and inundation methodology

Live risk is deterministic and never uses random numbers. It normalizes rainfall intensity, precipitation probability, forecast accumulation, NWP-derived signal, cloud/radar signal, and a clearly labeled vulnerability proxy into a 0–100 score using weights of 30/20/20/15/5/10 percent. Categories are LOW 0–29, MODERATE 30–49, HIGH 50–69, and EXTREME 70–100.

The inundation layer uses current intensity, short/24-hour accumulation, probability, and vulnerability proxy. It does not fabricate DEM, drainage measurements, river levels, flood depths, or validated street-level boundaries.

## Installation and run

The Emergent pod runs the existing services under supervisor. For a manual run:

```bash
cd /app/backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload
cd /app/frontend && yarn dev
```

`backend/.env` contains `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, optional `APP_URL`, and the server-only Twilio variables below. The frontend calls relative `/api` paths through Vite’s proxy. Never expose the Twilio Auth Token through Vite or React.

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...            # or TWILIO_MESSAGING_SERVICE_SID=MG...
TWILIO_STATUS_CALLBACK_URL=https://your-public-host/api/sms/status-callback
TWILIO_VALIDATE_SIGNATURE=true
TWILIO_AUTO_SEND=true
```

Twilio trial accounts may send only to verified recipients and may prepend trial text. A provider `QUEUED` or `SENT` state is not displayed as `DELIVERED`; final delivery comes from the signed callback.

## Three-minute jury demonstration

1. Open Dashboard and allow GPS, or explicitly show the Bengaluru demo fallback.
2. Show exact coordinates, live/fallback weather, current rain, hourly forecast, NWP status, fusion factors, inundation score, and nearby points.
3. Open Live Risk Map, search Bengaluru then Mumbai, and click a new point to demonstrate coordinate consistency.
4. Register a local recipient in Settings and enable browser alerts.
5. Start Emergency Demo: normal → moderate → high → extreme → geofenced warning.
6. Show Alerts, register an E.164 recipient, submit a clearly labeled provider test alert, and watch Twilio-confirmed status without claiming delivery early.
7. Simulate network failure or use the browser offline event. Show automatic offline mode, cache age, and local alert engine.
8. Restore connectivity and show automatic live refresh.

## Limitations and future scope

This zero-budget MVP does not claim official IMD/ISRO access, scientific accuracy, production readiness, validated flood depth, LoRa hardware, cellular fallback, historical ML calibration, or government warning authority. SMS delivery is claimed only when Twilio’s signed callback says `delivered`; trial restrictions, carrier filtering, destination verification, and account balance can still prevent delivery.

## Template implementation notes

The remaining sections document the FastAPI + MongoDB / Vite + React template conventions: every endpoint is under `/api`, frontend calls use `src/lib/api.ts`, Pydantic models mirror TypeScript interfaces manually, TanStack Query handles data access, and `cd frontend && yarn typecheck` is the required frontend typecheck command.

## Layout

```
farm-ts/
  backend/   FastAPI + motor (async MongoDB) + Pydantic v2 — python, /root/.venv
  frontend/  Vite + React 19 + Tailwind v4 + shadcn/ui (TypeScript strict)
  tests/     Playwright e2e workspace (pre-scaffolded)
```

## Running

Two separate processes, managed by supervisor in the pod (see "Pod conventions"
below); to run them by hand from two terminals instead:

```bash
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload   # http://localhost:8001
cd frontend && yarn dev                                                # http://localhost:3000
```

## The `/api` proxy convention

Every backend route lives under `/api` (the backend mounts one
`APIRouter(prefix="/api")`), and the frontend dev server
(`frontend/vite.config.ts`) proxies `/api/*` to `http://localhost:8001`. So
frontend code always calls a **relative** path — `apiGet("/status")` →
`/api/status` — and never an absolute backend URL. The same code works in dev
(via the Vite proxy) and in production (once both are served behind a single
origin).

## Backend

FastAPI, async throughout. `python` is the app venv interpreter
(`/root/.venv/bin/python`); backend deps are pip-installed from
`backend/requirements.txt`.

- **Entry point**: `backend/server.py` — creates `app = FastAPI()`, creates
  `api_router = APIRouter(prefix="/api")`, registers routes **on the router**,
  and calls `app.include_router(api_router)` at the bottom. CORS middleware is
  added from `CORS_ORIGINS`. Never hang a route directly off `app` — it would
  land outside `/api` and the Vite proxy would not reach it.
- **The route pattern** (copy `status` in `server.py`):
  1. a Pydantic model per request body and per response
     (`StatusCheckCreate` / `StatusCheck`);
  2. an `async def` handler decorated with
     `@api_router.post("/status", response_model=StatusCheck)`;
  3. `await` the motor call inside it.
  FastAPI validates the request against the Pydantic model before your handler
  runs — a malformed body never reaches your code, it gets an automatic `422`
  with a `{"detail": [...]}` body.
- **Growing the backend**: as `server.py` gets crowded, move models to
  `backend/models/` and routers to `backend/routers/` (one module per resource,
  each exporting its own `APIRouter`, mounted from `server.py` via
  `api_router.include_router(...)` or `app.include_router(...)` with the `/api`
  prefix preserved).
- **MongoDB**: import the shared handle — `from lib.db import client, db`
  (`backend/lib/db.py` self-loads `.env` before reading env). Use it from
  `server.py`, every router, and standalone scripts like `seed.py`; never
  construct another `AsyncIOMotorClient`. Collections are attributes:
  `await db.status_checks.insert_one(...)`, `await db.status_checks.find().to_list(1000)`.
  Motor connects lazily, so importing `server` never blocks on Mongo. `pymongo`
  is installed too if you need a sync client in a script.
- **Ids**: documents use a string `id` (`uuid4`) field, not Mongo's `ObjectId`
  — `ObjectId` is not JSON-serializable and leaks into response bodies. Keep the
  `uuid4` default-factory pattern from `StatusCheck`.
- **Config**: `backend/.env` — `MONGO_URL` (connection string), `DB_NAME`
  (database name), `CORS_ORIGINS`. `server.py` loads it with `python-dotenv`
  above its local imports, and `lib/db.py` self-loads it so standalone scripts
  inherit it too. The pod runs `mongod` locally, so `MONGO_URL` points at
  `localhost`. Add new secrets/config here; read them with `os.environ`.
- **Dates**: `backend/lib/dates.py` — `today_iso(tz=None)`. The pod clock is
  UTC; anchor "today" server-side with this, never with client-side date math.
- **Interactive check**: `cd /app/backend && python -c 'import server'` catches
  syntax/import errors without waiting for the supervisor log.

## Frontend

- Vite + React 19 + TypeScript strict, dev server on port `3000`.
- Tailwind CSS v4 (via the `@tailwindcss/vite` plugin — no separate
  `tailwind.config.js` needed) + shadcn/ui, initialized with the `base-nova`
  style and `neutral` base color, `@` path alias (`@/*` → `src/*`) wired in both
  `tsconfig.app.json`/`tsconfig.json` and `vite.config.ts`.
- `react-router-dom` and `motion` are preinstalled — don't re-add them. `src/App.tsx`
  is the `<Routes>` table and nothing else; screens live in `src/pages/*.tsx` and are
  imported as `@/pages/<Name>`. `src/pages/Home.tsx` ships as the worked example. Add
  a `<Route>` for every page you write, in the same edit that creates the page — a
  page with no route is unreachable, and any URL without a matching `<Route>` renders a
  **blank page** — `<Routes>` matches nothing and mounts nothing.
- Components installed under `src/components/ui/`: button, card, input, label,
  select, dialog, sheet, tabs, badge, calendar, sonner, textarea, table, popover,
  dropdown-menu, checkbox. Add more with `npx shadcn@latest add <component>`.
- `src/lib/api.ts` — the typed fetch layer: `apiGet<T>`, `apiPost<T>`,
  `apiPut<T>`, `apiPatch<T>`, `apiDelete<T>`, all relative to base `/api`,
  throwing `ApiError` (with `status` and the parsed body) on any non-2xx.
  **Nothing infers across the Python boundary** — you declare the response type
  yourself as a TS interface mirroring the endpoint's Pydantic model, and keeping
  the two in sync is a manual discipline. When you change a Pydantic model,
  change its TS interface in the same edit.
- `src/pages/Home.tsx` is a minimal example of the wiring: TanStack Query's `useQuery`
  with `apiGet<StatusCheck[]>("/status")` as the `queryFn`. It is a **non-blocking
  connectivity probe**, not a proof of the round trip — the result is deliberately
  discarded so the splash renders identically with no backend. `apiGet<T>` does no
  runtime validation either; `T` is your assertion, not a check. See the
  static-preview rule in `TEMPLATE.md` §4 for why no page may be gated on a fetch.

## TypeScript

`frontend/tsconfig.app.json` / `tsconfig.node.json` have `strict: true`. In the
pod:

```bash
cd frontend && yarn typecheck
```

— plain `tsc --noEmit` run from `frontend/` checks ZERO files (root tsconfig uses
project references with `"files": []`) and exits 0 even with type errors. Always
use `-b` for the frontend. Lint with `cd frontend && yarn lint` (oxlint).

## Data fetching

TanStack Query is wired: `QueryClientProvider` in `src/main.tsx`, `useQuery` demo
in `src/pages/Home.tsx` (see above). Use `useQuery`/`useMutation`, not
fetch-in-`useEffect`.

## Completion gate (tier 1)

When the build is complete, run tier 1 once, all in the same turn: a curl smoke
over the key `/api` endpoints (assert status AND a response field, plus one
negative case), `cd frontend && yarn typecheck`, and ONE happy-path browser pass
through the core user journey. Clean on all three → finish; any failure is a real
bug — fix it, re-run the failed check, and escalate to the testing subagent.
No routine typecheck/lint/smoke passes during the build — tier 1 runs exactly once.


## Testing

Two lanes.

**Backend (pytest)** — specs in `backend/tests/` as `test_*.py`, run with:

```bash
cd /app/backend && pytest
```

`backend/pytest.ini` is canonical: `addopts = -n 2 --dist loadscope` (pytest-xdist,
already parallel — do not pass your own `-n`) and `asyncio_mode = auto` (so
`async def test_...` needs no marker). Serial is `-n 0`, **never**
`-p no:xdist` (that errors, because `addopts` still passes `-n`/`--dist`).
`backend/tests/conftest.py` is pre-scaffolded — a sync `client` fixture
(`httpx.Client` rooted at `/api`), an async `aclient`, and an `api_url()` helper,
all pointed at `BACKEND_URL` (default `http://localhost:8001`). Tests hit the
live uvicorn process, so the app under test is the one the browser sees. Add
app-specific fixtures below the marker; do not re-create the file.

**Frontend (Playwright)** — `/app/tests/` is pre-scaffolded:
`playwright.config.ts` (canonical — edit the marked lines only),
`fixtures/helpers.ts`, and a `package.json` that resolves
`@playwright/test@1.62.0` (node_modules baked into the image). Write specs into
`tests/e2e/`. Do NOT re-create the config/helpers or install/upgrade playwright —
matching Chromium browsers live at `/pw-browsers`.

The backend lane is pytest: this template's backend is Python, so `vitest` does
not apply to it.

## Pod conventions

This template runs under supervisord in the Emergent agent pod — supersedes any
local-run instructions above.

- Backend, frontend, and `mongod` are each a supervisor program. After code or
  config changes, restart and wait for readiness:

  ```bash
  sudo supervisorctl restart frontend backend
  until curl -sf -o /dev/null http://localhost:3000; do sleep 2; done
  ```

- Status, only after a restart you triggered:
  `sudo supervisorctl status frontend backend`. Logs:
  `/var/log/supervisor/backend.err.log`, `backend.out.log`,
  `frontend.err.log`.
- App in a browser: the pod's preview URL (frontend, port `3000`). Backend API
  directly at port `8001`.
- `mongod` runs locally in the pod (`--bind_ip_all`); `MONGO_URL` in
  `backend/.env` points at `localhost`, no separate Mongo container.
- Both dev servers hot-reload on file edits (uvicorn `--reload` for the backend,
  Vite HMR for the frontend); no rebuild step needed for normal iteration. A
  restart is still needed after changing `.env`, `requirements.txt`, or
  `vite.config.ts`.
