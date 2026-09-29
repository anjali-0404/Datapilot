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
cp .env.example .env      # set DATABASE_URL (and OPENROUTER_API_KEY for real LLM intent)
npm run db:init           # creates tables + seeds the connector catalog
npm run dev               # http://localhost:3000
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
  Collect ranks a curated corpus (`src/lib/corpus.ts`, 24 real orgs with real website URLs)
  against the intent; Deduplicate uses a normalized name+domain key. All deterministic — no
  random numbers anywhere in the pipeline.
- **Sources** (`/sources`): the six knowledge-base layers each org is indexed under. A layer can
  be switched off (`PATCH /api/sources`); the Plan and Collect stages then search only the
  enabled layers, so the sources listed in a run are always the ones that really answered it.
- **Validation** (`src/lib/collect.ts`): a record is dropped only if it has no name or cannot be
  traced to a source URL. A column the knowledge base cannot fill is left empty (`—`), reported
  once in the stage log, and the row is flagged for review rather than silently discarded.
- **Intent extraction** (`src/lib/server/ai.ts`): calls OpenRouter chat-completions when
  `OPENROUTER_API_KEY` (or legacy `AI_API_KEY`) is set — default model `x-ai/grok-4.1-fast:free`
  costs nothing; otherwise (or on any failure) it falls back to deterministic local NLP.
  `GET /api/config` reports which engine is live, without exposing any secret.

### What is real

| Part | Status |
|---|---|
| PostgreSQL storage, REST API, task control (pause/resume/cancel/rerun) | Real |
| Live progress, dataset explorer, analytics, CSV/JSON export | Real, reading from the DB |
| Delete request / dataset, reset workspace, source on-off switches | Real, writes to PostgreSQL |
| Intent extraction | Real LLM via OpenRouter if `OPENROUTER_API_KEY` is set, else deterministic local NLP (offline-safe) |
| **Data collection** | **Real**: curated corpus of 24 verified orgs (real names, real URLs), ranked per question |
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
   The engine scores the 24 verified organizations against your keywords, the location you
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

- Every record links to its verified source URL — click any Website/Source link to confirm.
- Same prompt → same results (fully deterministic, no randomness). Try the sponsor, fintech,
  and investor examples on `/tasks/new` to see different rankings.
- Open a dataset and use the **Source** filter: a single question is normally answered from
  four to six different layers, and each row names the one it came from.
- Switch a layer off in `/sources`, then run the same question again — the plan and the
  records both shrink, and the pipeline log says which layers were searched.
- Ask to see the Validate/Deduplicate stage logs: they show the real checks, not canned text.
- The command palette (`⌘K`) is the fastest way to trigger the full flow.
- The 3D visualization is intentionally lightweight (capped particle/node counts, no
  post-processing) to stay performant on modest hardware while presenting.
