// Creates the DataPilot tables in the database at DATABASE_URL (idempotent).
// Usage: npm run db:init
//
// Loads .env for local dev if present; on hosts like Render there is no
// .env file and DATABASE_URL comes from the process environment instead.
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

// Minimal .env loader (KEY=value, ignores blanks/comments, strips quotes).
// Render/hosted env vars already in process.env always win.
try {
  const envPath = new URL("../.env", import.meta.url);
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
      let value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
} catch {
  // No .env file — fall through to process environment (Render, CI, etc.)
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const needsSSL = /sslmode=require|render\.com|dpg-/.test(url);
const client = new pg.Client({
  connectionString: url,
  ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});
await client.connect();
try {
  const { rows } = await client.query(`SELECT to_regclass('public."Task"') AS t`);
  if (rows[0].t) {
    console.log("Schema already exists - nothing to do.");
  } else {
    await client.query(readFileSync(new URL("../prisma/init.sql", import.meta.url), "utf8"));
    console.log("Schema created and connector catalog seeded.");
  }
} finally {
  await client.end();
}
