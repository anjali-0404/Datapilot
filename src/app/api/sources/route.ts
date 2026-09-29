import { NextResponse } from "next/server";
import * as repo from "@/lib/server/repository";

export async function GET() {
  try {
    const sources = await repo.listSources();
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("[GET /api/sources]", err);
    return NextResponse.json({ error: "Failed to list sources" }, { status: 500 });
  }
}

/** Switch a source layer on/off for future questions. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; status?: string };
    if (!body.id || (body.status !== "active" && body.status !== "idle")) {
      return NextResponse.json({ error: "id and status ('active' | 'idle') are required" }, { status: 400 });
    }

    const updated = await repo.setSourceStatus(body.id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "Unknown source layer" }, { status: 404 });
    }

    const sources = await repo.listSources();
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("[PATCH /api/sources]", err);
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }
}
