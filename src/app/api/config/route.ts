import { NextResponse } from "next/server";
import { describeAI } from "@/lib/server/ai";
import * as repo from "@/lib/server/repository";
import { CORPUS } from "@/lib/corpus";
import { CONNECTORS } from "@/lib/collection-engine";

/**
 * Read-only runtime status for the Settings page: which reasoning engine is
 * active, whether the database is reachable and how big the knowledge base is.
 * Never exposes secrets — only whether the key is configured.
 */
export async function GET() {
  try {
    const databaseConnected = await repo.pingDatabase();
    return NextResponse.json({
      ai: describeAI(),
      databaseConnected,
      knowledgeBase: { organizations: CORPUS.length, sourceLayers: CONNECTORS.length },
    });
  } catch (err) {
    console.error("[GET /api/config]", err);
    return NextResponse.json({ error: "Failed to read configuration" }, { status: 500 });
  }
}