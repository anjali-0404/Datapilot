-- DataPilot AI — database schema
--
-- This mirrors prisma/schema.prisma exactly. In a normal environment with full
-- internet access you would run `npx prisma migrate dev` instead of this file —
-- Prisma's migration engine downloads a small binary from binaries.prisma.sh on
-- first run, which this build environment's network allowlist blocks. This SQL
-- was written by hand from the same schema so the running app has a real,
-- correctly-shaped Postgres database in the meantime.

CREATE TYPE "TaskStatus" AS ENUM ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled');
CREATE TYPE "StageStatus" AS ENUM ('pending', 'active', 'done', 'error');
CREATE TYPE "ConnectorType" AS ENUM ('api', 'web', 'file', 'database');

CREATE TABLE "Connector" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type "ConnectorType" NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  reliability INT NOT NULL DEFAULT 90,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Task" (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  status "TaskStatus" NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  "recordsFound" INT NOT NULL DEFAULT 0,
  "duplicatesRemoved" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Task_status_idx" ON "Task" (status);
CREATE INDEX "Task_createdAt_idx" ON "Task" ("createdAt");

CREATE TABLE "Intent" (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL UNIQUE REFERENCES "Task"(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  location TEXT,
  industry TEXT,
  fields TEXT[] NOT NULL,
  constraints TEXT[] NOT NULL,
  confidence DOUBLE PRECISION NOT NULL
);

CREATE TABLE "Stage" (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "stageId" TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  status "StageStatus" NOT NULL DEFAULT 'pending',
  progress INT NOT NULL DEFAULT 0,
  logs TEXT[] NOT NULL DEFAULT '{}',
  "order" INT NOT NULL,
  "durationMs" INT
);
CREATE INDEX "Stage_taskId_idx" ON "Stage" ("taskId");

CREATE TABLE "TaskConnector" (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "connectorId" TEXT NOT NULL REFERENCES "Connector"(id),
  UNIQUE ("taskId", "connectorId")
);

CREATE TABLE "Dataset" (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL UNIQUE REFERENCES "Task"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  columns TEXT[] NOT NULL,
  "sourcesUsed" TEXT[] NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Dataset_createdAt_idx" ON "Dataset" ("createdAt");

CREATE TABLE "Record" (
  id TEXT PRIMARY KEY,
  "datasetId" TEXT NOT NULL REFERENCES "Dataset"(id) ON DELETE CASCADE,
  fields JSONB NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  flagged BOOLEAN NOT NULL DEFAULT false,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "connectorId" TEXT REFERENCES "Connector"(id),
  "collectedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Record_datasetId_idx" ON "Record" ("datasetId");
CREATE INDEX "Record_confidence_idx" ON "Record" (confidence);

CREATE TABLE "Workflow" (
  id TEXT PRIMARY KEY,
  "taskId" TEXT UNIQUE REFERENCES "Task"(id),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  stages TEXT[] NOT NULL,
  connectors TEXT[] NOT NULL,
  "usageCount" INT NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Workflow_createdAt_idx" ON "Workflow" ("createdAt");

-- Seed the connector catalog (mirrors src/lib/collection-engine.ts CONNECTORS)
INSERT INTO "Connector" (id, name, type, status, reliability) VALUES
  ('web-search', 'Curated Web Index', 'web', 'active', 92),
  ('company-registry', 'Company Directory', 'api', 'active', 97),
  ('news-feed', 'Ecosystem Feed', 'api', 'active', 88),
  ('social-directory', 'Public Directory', 'web', 'active', 79),
  ('csr-database', 'CSR / Sustainability DB', 'database', 'active', 94),
  ('job-boards', 'Startup & Tech Index', 'api', 'active', 90);
