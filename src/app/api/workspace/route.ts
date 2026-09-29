import { NextResponse } from "next/server";
import * as repo from "@/lib/server/repository";

/** Empties the workspace: every request, dataset, record and workflow. */
export async function DELETE() {
  try {
    const result = await repo.clearWorkspace();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[DELETE /api/workspace]", err);
    return NextResponse.json({ error: "Failed to reset the workspace" }, { status: 500 });
  }
}