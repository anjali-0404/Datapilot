# DataPilot AI: Presenter's Guide

A briefing for whoever presents DataPilot to the hackathon judges. Read it once in full. On the day you'll mostly need the **demo script** (section 4) and **judge Q&A** (section 7).

---

## 1. The 30-second pitch

> "Anyone who has had to build a lead list, a sponsor list or a market map knows the routine: an afternoon of Googling, copying into a spreadsheet, then checking which rows are real. **DataPilot turns one plain-English question into a clean, validated dataset where every row links to its source.** You type something like *'Find sustainability-focused sponsors for a tech fest in Pune, with website and contact email'*. An LLM works out what you want, DataPilot builds a collection workflow for that question, gathers records from a curated knowledge base and, if you turn it on, the live web. It then validates and deduplicates the records and gives you the table plus an analyst brief that tells you which rows to trust and what the dataset *can't* answer."

One-line version: **Question in, source-backed dataset and an honest brief out.**

---

## 2. The problem

| Pain | What people do today |
|---|---|
| Building a list of companies, sponsors, investors or employers | Hours of manual search, copy and paste |
| Knowing whether a row is real | Open every link by hand |
| Scrapers and "AI search" tools | Fixed to one site, or return confident answers with no provenance (hallucinated emails, dead URLs) |

Students, early-stage founders, event organisers and small sales teams have this problem and can't pay for a data vendor.

## 3. The solution: what makes it different

1. **A workflow per question, not a fixed scraper.** Each question is parsed into structured intent (entity type, location, industry, the columns wanted, constraints), and the plan is built from that intent.
2. **Every record is traceable.** A row with no source URL is dropped. You can click through to every row's source.
3. **It's honest about gaps.** If you ask for a column the sources don't have (for example salary range), it ships **empty (`—`)**, never guessed. The brief names the column as a gap.
4. **Deterministic.** The pipeline uses no random numbers. The same question gives the same rows, scores and brief. Judges can rerun it and check.
5. **It delivers an answer, not just a table.** The analyst brief has a headline, the top matches, coverage for each column, a "what this dataset does not answer" list and a recommended next step, all computed from the rows it publishes.
6. **It keeps working when services fail.** The LLM falls back from NVIDIA NIM to OpenRouter to local NLP. Live crawling falls back to the curated corpus. The demo still runs if Wi-Fi or an API key fails.

---

## 4. Demo script (about 5 minutes)

> **Before you start:** run through the pre-demo checklist in section 8. Have the app open on `/dashboard`.

### Step 1: The landing page (20 s)
Open `/`. Point out the 3D data-network hero and the pipeline strip:
*Interpret → Plan → Collect → Validate → Deduplicate → Deliver.*
> "Every request runs through these six real stages. Let's do one live."

### Step 2: Ask a question (30 s)
Go to **New request** (`/tasks/new`), or press **Ctrl+K / ⌘K** and use the command palette. Click the **Sponsor outreach** example, or type:

> *Find sustainability-focused sponsor leads for a college technology festival in Pune. Include company name, website, industry, location and contact information.*

Leave Live Mode **off** for this first run. It's fast and fully deterministic. Submit.

### Step 3: Watch the pipeline (about 10 s, narrate it)
You land on `/tasks/[id]`, and each stage fills in live. What to say about each one:

- **Interpret:** "An LLM pulls out structured intent. The intent card shows location *Pune* as a hard filter and the exact columns I asked for. The log says which engine ran: NVIDIA NIM, OpenRouter, or offline NLP."
- **Plan:** "It picks which of the six knowledge-base layers to search for this question."
- **Collect:** "It ranks 49 verified organisations against the intent. These are real companies with real website URLs."
- **Validate:** "Rows that can't be traced to a source URL are dropped. Missing columns get flagged, not invented."
- **Deduplicate:** "Rows are matched on normalised name plus domain."
- **Deliver:** "It writes the dataset *and* the analyst brief."

### Step 4: Read the analyst brief (45 s). This is the strongest moment.
> "It doesn't just dump a table. The headline answers the question. It says how many rows are strong matches, which rows need checking, how full each column is, and what this dataset *doesn't* answer."

Point at the **gaps** list and the **recommendation**.

### Step 5: Prove provenance (30 s)
Open the dataset (`/datasets/[id]`). Click any **Website / Source** link, and it opens the real company site.
> "Every row links to where it came from. Nothing in here is made up."

Show **search, filter, sort**, the **Source** filter (one question is usually answered from four to six layers), the **analytics** tab, and **Export CSV / JSON**.

### Step 6: Show that the user controls the sources (45 s)
Go to **Sources** (`/sources`) and switch off one layer, such as *CSR / Sustainability DB*. Go back to the task page and click **Rerun**, or use **Clone & run** on `/workflows`.
> "The plan and the results both shrink, and the log lists exactly which layers it searched. What you see in a run is always what actually answered it."

Switch the layer back on afterwards.

### Step 7 (optional, only if the crawler is up): Live Mode (60 s)
On `/tasks/new`, turn on **Live Mode** and pick **News & Articles** and/or **Social & Discussions**. Ask, for example:

> *Find fintech startups in Bangalore with website and industry.*

> "Now it crawls the open web as well: RSS feeds, BBC, Hacker News, Reddit, GitHub, app stores, Trustpilot. The Collect log shows how many rows came from the curated corpus and how many from the live web, for each platform, including any crawler that failed. Live rows are fitted to the columns I asked for. If the company is in our verified corpus, its website and industry are filled from there."

⚠️ A live crawl takes **30–90 seconds**. Start it, then talk over it or switch to Q&A while it runs. If the crawler is unreachable, the run still finishes from the corpus, and the log says *"Live crawl unavailable, collected from the corpus instead."* That counts as a feature: say so.

### Step 8: Close (15 s)
> "One question, about ten seconds, a dataset you can trust row by row, and a brief that says where it falls short. That's DataPilot."

---

## 5. How it works (architecture)

```
                ┌──────────────────────── Next.js 16 app (Node) ─────────────────────────┐
 Browser ──►    │  UI (React 19, Tailwind, Framer Motion, R3F 3D, Recharts, cmdk)        │
 polls          │        │                                                               │
 /api/tasks/:id │  REST API routes (src/app/api/*)                                       │
                │        │                                                               │
                │  Pipeline engine (src/lib/server/pipeline-engine.ts)                   │
                │   Interpret ─► Plan ─► Collect ─► Validate ─► Deduplicate ─► Deliver   │
                │      │                  │   │                                  │       │
                │  LLM intent         corpus  live (optional)              analyst brief │
                │  NIM → OpenRouter   49 orgs │                                          │
                │  → local NLP        6 layers│                                          │
                └──────────┬──────────────────┼──────────────────────────────────────────┘
                           │                  │ HTTP POST /crawl
                     PostgreSQL               ▼
              (tasks, stages, intent,   Python FastAPI crawler-service
               datasets, records,       9 collectors: RSS (14 feeds), BBC, The Hacker News,
               sources, workflows)      Reddit, Hacker News, Trustpilot, Google Play,
                                        App Store, GitHub (aiohttp + Playwright)
```

**Key files, if a judge asks to see code:**

| What | Where |
|---|---|
| Six-stage pipeline | `src/lib/server/pipeline-engine.ts` |
| LLM intent extraction and fallback chain | `src/lib/server/ai.ts` |
| Corpus ranking, validation, dedupe, confidence | `src/lib/collect.ts` |
| The 49 verified organisations | `src/lib/corpus.ts` |
| Analyst brief | `src/lib/insights.ts` |
| Mapping live records onto the requested columns | `src/lib/crawler-client.ts` |
| Crawler orchestration | `crawler-service/orchestrator.py` |
| Database layer (raw `pg`) | `src/lib/server/repository.ts`, `prisma/init.sql` |

**Tech stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Framer Motion, React Three Fiber, Zustand, Recharts, cmdk · PostgreSQL via `pg` · Python 3.12, FastAPI, aiohttp, Playwright, feedparser · NVIDIA NIM (Llama 3.1 70B) and OpenRouter · deployed on Render (web service, crawler service, managed Postgres via `render.yaml`).

### How a confidence score is computed
Confidence is based on evidence, with no randomness. For corpus rows it combines the relevance score against the intent (keyword, tag, location and entity-type matches) with how many of the requested columns the row fills. For live rows it combines the crawler's confidence hint, column completeness and whether the row has a real `http(s)` source URL. Rows below 70% or with a validation warning are **flagged for review**.

---

## 6. What is real, and the honest limits

Judges reward candour. Say these before you're asked.

| Real | Limit |
|---|---|
| PostgreSQL persistence; state survives a refresh or restart | No user accounts; it's a single-workspace build |
| LLM intent extraction (NIM / OpenRouter) with offline fallback | The curated corpus is **49 organisations**, focused on India, sustainability, fintech and tech |
| Live crawling of 9 platforms | Live crawling is slower (30–90 s) and depends on public sites and rate limits (GitHub, Reddit) |
| Validation, dedupe and confidence are real and deterministic | The pipeline runs in the Node process, which is fine for a demo. In production it would be a job queue and workers, so a task interrupted by a server restart has to be rerun |
| Pause / resume / cancel / rerun and source on/off all change the DB | Columns the sources don't hold (salary, role title) ship **empty**. That's deliberate |

**What to say:** "We chose being trustworthy over looking impressive. An empty cell you know is empty beats a confident wrong email."

---

## 7. Likely judge questions

**"Isn't this just a wrapper around ChatGPT?"**
No. The LLM does one job: turning the question into structured intent. Collection, ranking, validation, dedupe, confidence and the brief are all deterministic code. If you remove every API key, the app still works with local NLP. The LLM never writes a single data value.

**"Where does the data come from?"**
Two places. (1) A curated corpus of 49 real organisations with official websites, indexed under six knowledge-base layers. (2) Optionally, live crawls of news, reviews, social and dev platforms. Every row carries its source URL and source name.

**"How do you prevent hallucination?"**
The LLM never produces data. A column is filled only from structured evidence: corpus records or crawler metadata. Otherwise it's `—`. Rows without a source URL are dropped in the Validate stage.

**"How does it scale?"**
Corpus ranking is in-memory and instant. Live crawling is a separate Python microservice that can scale on its own. The main change for production is replacing the in-process timers with a Postgres-backed job queue and workers. The DB schema already stores all task and stage state.

**"Why is the same question giving the same answer? Is it hard-coded?"**
It's deterministic by design: no randomness, and record IDs are derived from content. Change the question (location, sector, columns) or toggle a source layer and the ranking changes. Try the three examples on `/tasks/new` to show different results.

**"What did you build vs. use off the shelf?"**
We built the pipeline engine, the ranking, validation, dedupe and confidence logic, the analyst brief, the crawler orchestrator and the 9 collectors, and the whole UI. Off the shelf: the frameworks (Next.js, FastAPI), the UI primitives (Radix), and hosted LLM APIs for intent only.

**"Who is the user and what's next?"**
Student fest organisers, early founders and small sales or BD teams. Next steps: a larger and self-updating corpus, user accounts and shared workspaces, scheduled re-runs that alert when a dataset changes, and enriching rows from the companies' own websites.

**"What happens if the crawler or the LLM goes down mid-demo?"**
Both fall back without interrupting the run, and the stage log says so. That's by design.

---

## 8. Pre-demo checklist

Do this **at least 30 minutes before** you present.

- [ ] Open the deployed URL (or `npm run dev` → <http://localhost:3000>). On Render's **free plan the service sleeps**: open the site, and also the crawler's `/health` URL, 2–3 minutes early to wake both.
- [ ] Open **Settings** and confirm *Database: connected*, then check which LLM engine shows as live.
- [ ] Run the **Sponsor outreach** example once, so the dashboard isn't empty and you know it works.
- [ ] If you plan to show Live Mode, hit the crawler: `GET <crawler-url>/health` should return `"status": "healthy"` and 9 enabled platforms. Run one live request in advance.
- [ ] All source layers are **on** in `/sources`.
- [ ] Browser zoom at 100–110%, notifications off, a second tab open on a finished dataset as a backup.
- [ ] **Fallback plan:** if the network dies, run locally with no API keys and Live Mode off. Everything except live crawling still works offline (Postgres is local).

### Running locally (backup)
```bash
npm install
cp .env.example .env          # set DATABASE_URL; NVIDIA_API_KEY / OPENROUTER_API_KEY optional
npm run db:init               # creates tables + seeds sources
npm run dev                   # http://localhost:3000

# optional: live crawler
cd crawler-service
python -m venv .venv && .venv\Scripts\activate      # (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt && playwright install chromium
uvicorn main:app --port 8001
```

Self-checks you can show a technical judge:
```bash
npx tsx scripts/verify-output-quality.ts   # 24 checks: confidence, honesty, column projection, brief
npx tsx scripts/verify-llm-fallback.ts     # LLM provider priority + fallback chain
```

---

## 9. Numbers to remember

- **6** pipeline stages · about **10 s** end to end in corpus mode
- **49** verified organisations · **6** knowledge-base layers
- **9** live collectors across **4** categories (news, reviews, social, dev); RSS covers **14** feeds
- **3**-level LLM fallback: NVIDIA NIM → OpenRouter → local NLP
- **0** random numbers in the pipeline: same question, same answer
- **100%** of published rows link to a source URL
