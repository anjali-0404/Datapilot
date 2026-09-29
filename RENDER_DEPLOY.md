# Deploying DataPilot on Render (Web Service + Managed Postgres)

This guide deploys this repo as a **Render Web Service** (long-running Node)
backed by **Render Postgres**. Follow it top-to-bottom; the app only needs
these two Render resources.

> Why a Web Service and not a Static Site / Serverless function?
> `src/lib/server/pipeline-engine.ts` runs the Interpret -> Plan -> Collect ->
> Validate -> Deduplicate -> Deliver pipeline **in the Node process with timers**
> and writes progress to Postgres. That requires a long-running server
> (`next start`). Do **not** deploy this as a Static Site or serverless
> function without first replacing the engine with a queue + worker.

## 1. What you are creating

| Render resource | Settings |
|---|---|
| **PostgreSQL** | Any plan (Free is enough to evaluate), same region as the web service |
| **Web Service** | Runtime: **Node**, Branch: `main`, Build: `npm ci && npm run build`, Start: `npm start` |

No disk, no background worker, no cron job, and no Docker image are required.

## 2. Prerequisites

1. This repo pushed to GitHub (Render deploys from Git).
2. A Render account (a free account is enough to test).
3. Locally you need Node 20.9+ (Node 22 LTS recommended) — this matches what
   Render will run.

Useful local sanity check before you deploy:

```bash
npm install
cp .env.example .env      # set DATABASE_URL (and OPENROUTER_API_KEY for real LLM intent)
npm run db:init           # creates tables + seeds the connector catalog
npm run build && npm start
```

If that passes locally, Render will pass too.

## 3. Step 1 — Create the Render Postgres database

1. Render Dashboard -> **New + -> PostgreSQL**.
2. Settings:
   - **Name:** e.g. `datapilot-db`
   - **Region:** pick one region and reuse it for the web service
     (e.g. Oregon / Frankfurt — closest to you).
   - **PostgreSQL Version:** default (15+ is fine).
   - **Plan:** Free to evaluate, Starter+ for production.
3. Click **Create Database** and wait until status is **Available**.
4. Open the database page and copy the **Internal Database URL**
   (looks like `postgresql://datapilot:...@dpg-.../datapilot_xxxx`).
   You will paste this into the web service as `DATABASE_URL` in Step 5.

> Use the **Internal** URL when the web service and database are in the same
> Render region (faster + free internal traffic). Use the **External** URL
> only for connecting from your laptop / `psql`.

You do **not** need to run any SQL manually. Schema creation is handled in
Step 6 via `npm run db:init` (it executes `prisma/init.sql` idempotently).

## 4. Step 2 — Create the Web Service

1. Render Dashboard -> **New + -> Web Service**.
2. **Source:** connect GitHub and select `Datapilot` (branch `main`).
3. Configure exactly like this:

| Field | Value |
|---|---|
| **Name** | `datapilot` (or anything) |
| **Region** | **Same region as the Postgres DB** |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free is enough to evaluate; Starter ($7/mo+) if the build runs out of memory (see Section 8) |

4. Leave **Health Check Path** empty (defaults to `/`) — any page works,
   there is no dedicated `/healthz` route in this repo.
5. **Do not** add a persistent disk — everything is stored in Postgres.
6. Click **Create Web Service** — the first deploy will fail to connect to the
   DB until you add env vars in the next step. That is expected.

### Why these commands

- `package.json` already has the right scripts: `build -> next build`,
  `start -> next start`, `db:init -> node scripts/init-db.mjs` (loads `.env`
  locally, uses process env on Render — no `--env-file` flag needed).
- `npm ci` installs `devDependencies` too (Tailwind, TypeScript, Prisma CLI),
  which `next build` needs. Do **not** prune dev dependencies before building.
- Next.js automatically listens on Render's injected `$PORT`. You do not need
  to configure a port. Nothing in this repo reads `process.env.PORT`
  manually, which is correct for Next.

## 5. Step 3 — Set environment variables

On the Web Service page -> **Environment** -> add these:

| Key | Value | Required? |
|---|---|---|
| `DATABASE_URL` | The Postgres **Internal Database URL** from Step 1 | **Yes** |
| `NODE_VERSION` | `22.14.0` (or any 20.9+ / 22 LTS) | Strongly recommended — pins the runtime |
| `NEXT_PUBLIC_APP_URL` | `https://<your-service>.onrender.com` (update after first deploy, no trailing slash) | Recommended |
| `OPENROUTER_API_KEY` | Your OpenRouter key for real LLM intent extraction (`src/lib/server/ai.ts`) | Optional — app falls back to local NLP when empty |
| `AI_MODEL` | OpenRouter model id (default `x-ai/grok-4.1-fast:free`, free) | Optional |
| `AI_MODEL` already defaults to a free model — only change it if you want a specific OpenRouter model. No other keys needed. |

Notes:

- `.env*` files are git-ignored (see `.gitignore`), so these **must** be set
  in the Render dashboard — do not commit a `.env` file.
- `NEXT_PUBLIC_*` vars are inlined at **build time**. If you change
  `NEXT_PUBLIC_APP_URL` later, trigger a
  **Manual Deploy -> Clear build cache & deploy** so the new value is baked in.
- Render automatically sets `NODE_ENV=production` and `PORT` at runtime —
  do not override them.
- After saving env vars, Render auto-redeploys.

## 6. Step 4 — Initialize the database schema

The schema lives in two equivalent places: `prisma/schema.prisma` (reference)
and `prisma/init.sql` (what the app actually executes). `scripts/init-db.mjs`
is idempotent — it checks for the `Task` table and does nothing if the schema
already exists.

Pick **one** of these:

### Option A — Pre-Deploy Command (paid plans only)

> Not available on free-tier services. Use Option B, or the Blueprint default
> (init folded into the start command) instead.

Web Service -> **Settings -> Pre-Deploy Command**, set:

```
npm run db:init
```

Save, then **Manual Deploy -> Deploy latest commit**. Render runs this after a
successful build but before the new version goes live, so tables + the 7-row
connector seed always exist.

### Option B — One-off Shell (simplest for the first deploy)

Web Service -> **Shell** tab (service must be running), then run:

```bash
npm run db:init
# expected: "Schema created and connector catalog seeded."
# on re-runs: "Schema already exists - nothing to do."
```

> The script reads `.env` for local dev itself, and on Render there is no
> `.env` file — `pg` reads `DATABASE_URL` straight from the process
> environment, so it works as long as the env var is set. It also enables SSL
> automatically for Render-style URLs.

Verify with `psql` (Database page -> **Connect -> External Connection**):

```sql
\dt              -- Task, Intent, Stage, TaskConnector, Dataset, "Record", Connector, Workflow
SELECT count(*) FROM "Connector";  -- expect 7
```

## 7. Step 5 — Verify the deployment

1. Wait for the deploy log to show `Compiled successfully` -> pre-deploy
   `npm run db:init` (if set) -> `started server on 0.0.0.0:$PORT`.
2. Open `https://<your-service>.onrender.com/` — landing page with the 3D hero.
3. Go to **Tasks -> New**, submit a prompt, and watch the live pipeline on
   `/tasks/[id]` (the UI polls `GET /api/tasks/:id`).
4. Check the database: `SELECT count(*) FROM "Task";` should grow.

### Optional hardening

- **Custom domain:** Web Service -> **Settings -> Custom Domains** -> add your
  domain, then update `NEXT_PUBLIC_APP_URL` and redeploy.
- **Auto-deploy:** keep **Auto-Deploy on push to `main`** enabled.
- **Stay on one instance.** The pipeline engine keeps task timers in process
  memory. Do **not** scale past 1 instance, and note that a task stuck in
  `running` across a restart must be rerun (see README Known limitations).

## 8. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `DATABASE_URL is not set` in logs | Env var missing on the web service. Add it under **Environment** and redeploy. |
| `ECONNREFUSED localhost:5432` | A local `.env` value leaked in, or `DATABASE_URL` is empty. Confirm the service env var is the Render Internal URL. |
| Build fails / wrong Node version | Set `NODE_VERSION=22.14.0` in service env vars and redeploy. |
| Build runs out of memory (Free 512 MB) | `puppeteer` (~300 MB download) is in `dependencies` but **never imported** by `src/` — removing it slims install + build dramatically. Otherwise move to Starter. |
| `relation "Task" does not exist` | Schema never initialized. Run Option A or B from Section 6. |
| Page loads but tasks never progress | The free instance may have slept mid-task, or the service restarted. Free web services sleep after inactivity — upgrade to Starter (no sleep) for reliable pipelines, then rerun the task. |
| `NEXT_PUBLIC_APP_URL` change had no effect | It is baked at build time — use **Clear build cache & deploy** after changing any `NEXT_PUBLIC_*` var. |
| Prisma `migrate` errors about `binaries.prisma.sh` | Expected on restricted networks. Do not use `prisma migrate` here — the runtime uses `pg` directly and `npm run db:init` (`prisma/init.sql`) is the supported path. |

## 9. `render.yaml` Blueprint — committed, ready to use

`render.yaml` is already committed at the repo root, so you can deploy in one
click: Dashboard -> **New + -> Blueprint** -> point at this repo. It creates
the DB + service together, with the DB init (`npm run db:init`) folded into
the **start command**. The file content:

```yaml
services:
  - type: web
    name: datapilot
    env: node
    branch: main
    buildCommand: npm ci && npm run build
    startCommand: npm run db:init && npm start   # idempotent: creates tables + seeds connectors
    healthCheckPath: /
    plan: free                                   # bump to starter for no-sleep + more RAM
    envVars:
      - key: NODE_VERSION
        value: 22.14.0
      - key: DATABASE_URL
        fromDatabase:
          name: datapilot-db
          property: connectionString    # internal URL, same region
      - key: NEXT_PUBLIC_APP_URL
        value: https://datapilot.onrender.com  # edit to your real URL
      - key: OPENROUTER_API_KEY
        sync: false                     # OpenRouter key, prompts for a secret at apply time
      - key: AI_MODEL
        value: x-ai/grok-4.1-fast:free

databases:
  - name: datapilot-db
    plan: free
```

> `preDeployCommand` needs a paid instance type, so it is intentionally
> **not** in the free-tier Blueprint. Running the idempotent init in the
> start command achieves the same result (this mirrors Render's own
> remix-postgres example). If you later upgrade to Starter, you can move
> `npm run db:init` to `preDeployCommand` instead.

> After applying the Blueprint, set `OPENROUTER_API_KEY` (if used) and correct
> `NEXT_PUBLIC_APP_URL` in the dashboard, then redeploy once.

## 10. Deploy checklist (copy/paste into your PR)

- [ ] Postgres created in region R; Internal URL copied
- [ ] Web Service created from `main`, same region R
- [ ] Build `npm ci && npm run build`, Start `npm start`
- [ ] Env vars set: `DATABASE_URL`, `NODE_VERSION=22.14.0`, `NEXT_PUBLIC_APP_URL`, `OPENROUTER_API_KEY` (+ optional `AI_MODEL`)
- [ ] Pre-deploy `npm run db:init` set (or ran once via Shell)
- [ ] `Connector` table has 7 rows; landing page loads; test task completes
- [ ] Single instance (no autoscale > 1); Starter plan if you need no-sleep


