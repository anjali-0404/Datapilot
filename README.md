# DataPilot AI

An AI-powered data intelligence platform: turn a plain-English business question into a
clean, validated, source-backed dataset you can actually act on.

Turn a plain-English business question into a clean, validated, source-backed dataset:

```
Question → AI Intent → Dynamic Workflow → Source Collection → Validation → Deduplication → Dataset → Analytics → Export
```

DataPilot is a **dynamic workflow builder**, not a fixed scraper — every question is parsed
into structured intent, and a task-specific collection workflow is generated and executed
live, with full source provenance on every record.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + hand-built shadcn/ui-style component library
- **Framer Motion** for page/element animation
- **React Three Fiber** + **Drei** + **Three.js** for the 3D data-network hero visualization
- **Zustand** for client state (caches API data across app views)
- **Recharts** for dataset analytics
- **cmdk** for the command palette (`⌘K` / `Ctrl+K`)
- **PostgreSQL** via `pg`, with the schema documented in `prisma/schema.prisma`

## Running it

Requires Node 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env      # set DATABASE_URL (and NVIDIA_API_KEY or OPENROUTER_API_KEY for real LLM intent)
npm run db:init           # creates tables + seeds the connector catalog
npm run dev               # http://localhost:3000
```

Optional, for **Live Mode** (live web crawling) — the Next.js app works without it:

```bash
cd crawler-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --port 8001   # or set CRAWLER_SERVICE_URL in .env
```

Production check: `npm run build && npm start`.

## How the backend works

- **API routes** (`src/app/api/*`): `POST/GET /api/tasks`, `GET/DELETE /api/tasks/:id`,
  `POST /api/tasks/:id/{pause,resume,cancel,rerun}`, `GET/DELETE /api/datasets/:id`,
  `GET /api/workflows`, `GET/PATCH /api/sources`, `GET /api/config`,
  `DELETE /api/workspace` (delete everything).
- **Persistence**: every task, stage update, intent, connector choice, dataset and record is
  stored in PostgreSQL (`src/lib/server/repository.ts`). State survives page refreshes and
  server restarts; the UI polls `/api/tasks/:id` for live progress.
- **Pipeline engine** (`src/lib/server/pipeline-engine.ts`): runs Interpret, Plan, Collect,
  Validate, Deduplicate, Deliver in the Node process, writing progress to the DB at each step.
  Collect ranks a curated corpus (`src/lib/corpus.ts`, 49 real orgs with real website URLs)
  against the intent; Deduplicate uses a normalized name+domain key. All deterministic — no
  random numbers anywhere in the pipeline.
- **Analyst brief** (`src/lib/insights.ts`): the Deliver stage writes the answer, not just the
  table — a headline, the top matches, per-column coverage, an explicit "what this dataset does
  not answer" list and a recommended next step. It is a pure function over the rows being
  published, so every sentence traces back to records in the dataset and the same dataset always
  produces the same brief.
- **Live Mode** (`crawler-service/`): an optional FastAPI microservice that crawls the open web
  (RSS/BBC/The Hacker News, Reddit, Hacker News, Trustpilot, Google Play, App Store, GitHub).
  `/tasks/new` → *Live Mode* selects categories; the Collect stage then runs **hybrid**
  collection (corpus + live) and merges/dedupes the two. Live rows are projected onto exactly
  the columns you asked for and enriched from the corpus when the company is known. If the
  crawler is unreachable, the run falls back to the corpus and says so in the stage log.
- **Sources** (`/sources`): the six knowledge-base layers each org is indexed under. A layer can
  be switched off (`PATCH /api/sources`); the Plan and Collect stages then search only the
  enabled layers, so the sources listed in a run are always the ones that really answered it.
- **Validation** (`src/lib/collect.ts`): a record is dropped only if it has no name or cannot be
  traced to a source URL. A column the knowledge base cannot fill is left empty (`—`), reported
  once in the stage log, and the row is flagged for review rather than silently discarded.
- **Intent extraction** (`src/lib/server/ai.ts`): calls NVIDIA NIM chat-completions when
  `NVIDIA_API_KEY` is set (free key from build.nvidia.com, default `meta/llama-3.1-70b-instruct`),
  then OpenRouter (`OPENROUTER_API_KEY`/`AI_API_KEY`, default `x-ai/grok-4.1-fast:free`) as
  fallback — so one rate-limited free tier never blocks a request. `LLM_PROVIDER` pins the
  order. If every provider fails (or no key is set) it falls back to deterministic local NLP.
  `GET /api/config` reports which engine is live, without exposing any secret.

### What is real

| Part | Status |
|---|---|
| PostgreSQL storage, REST API, task control (pause/resume/cancel/rerun) | Real |
| Live progress, dataset explorer, analytics, CSV/JSON export | Real, reading from the DB |
| Delete request / dataset, reset workspace, source on-off switches | Real, writes to PostgreSQL |
| Intent extraction | Real LLM via NVIDIA NIM (preferred, `NVIDIA_API_KEY`) or OpenRouter (`OPENROUTER_API_KEY`), else deterministic local NLP (offline-safe) |
| **Data collection** | **Real**: curated corpus of 49 verified orgs (real names, real URLs), ranked per question |
| **Analyst brief** | **Real + deterministic**: headline, top matches, coverage, gaps and next step computed from the delivered rows |
| **Live web crawling** | **Real, optional**: Python crawler service; hybrid corpus+live merge with automatic fallback if it is down |
| **Validation / dedupe / confidence** | **Real + deterministic**: source-URL and email checks, normalized-key dedupe, evidence-based scores |
| Accounts / sign-in | Not built — it is a single-workspace build, so the avatar menu has navigation and data controls rather than a fake login |

### Known limitations

- The pipeline runs in the server process's memory (timers). It works with `next dev` /
  `next start` or any long-running Node host; on serverless platforms replace it with a job
  queue/worker. A task interrupted by a server restart stays in `running`; rerun it.
- The schema exists both as `prisma/schema.prisma` and as hand-written `prisma/init.sql`
  (the runtime uses `pg` directly). With normal internet access `npx prisma migrate dev`
  also works against the same schema.

## What you can ask

Write the question the way you would brief a colleague. Three things drive the answer:

1. **The subject** — sponsorship leads, fintech companies, climate investors, tech employers.
   The engine scores the 49 verified organizations against your keywords, the location you
   mention and the entity type it detects.
2. **The location** — say "Pune", "Mumbai", "Bangalore" and it is applied as a hard filter
   (and shown in the intent card before collection starts).
3. **The columns** — the dataset's columns *are* your request. Name them in the question and
   they become columns: company name, website, industry, location, contact email, phone.
   Anything else you ask for (salary bands, role titles) is delivered as an empty column and
   reported in the Validate log, because the knowledge base does not hold it.

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page with 3D hero, pipeline explainer, features |
| `/dashboard` | Stats overview + recent requests |
| `/tasks/new` | Ask a business question + example requests |
| `/tasks/[id]` | Live pipeline execution, intent, sources, results preview, delete |
| `/datasets` | All generated datasets |
| `/datasets/[id]` | Dataset Explorer — search/filter/sort/paginate, analytics, export, delete |
| `/sources` | Switch source layers on/off, see what each has contributed |
| `/workflows` | Generated workflows — clone & rerun |
| `/history` | All requests, filterable by status, with delete |
| `/settings` | Live engine status, database status, source layers, workspace reset |

## Notes for judges

- Every record links to its source URL — click any Website/Source link to confirm where it came from.
- Read the **Analyst brief** first: headline, top matches, column coverage, and an honest
  "what this dataset does not answer" list — then check the table against it.
- Same prompt → same results (fully deterministic, no randomness). Try the sponsor, fintech,
  and investor examples on `/tasks/new` to see different rankings.
- Open a dataset and use the **Source** filter: a single question is normally answered from
  four to six different layers, and each row names the one it came from.
- Switch a layer off in `/sources`, then run the same question again — the plan and the
  records both shrink, and the pipeline log says which layers were searched.
- Ask to see the Validate/Deduplicate stage logs: they show the real checks, not canned text.
- Turn on **Live Mode** on `/tasks/new`, pick a category, and watch Collect report corpus vs
  live counts per platform — including any crawler that failed.
- The command palette (`⌘K`) is the fastest way to trigger the full flow.
- The 3D visualization is intentionally lightweight (capped particle/node counts, no
  post-processing) to stay performant on modest hardware while presenting.
