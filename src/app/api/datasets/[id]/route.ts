import { NextResponse } from "next/server";
import * as repo from "@/lib/server/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dataset = await repo.getDataset(id);
    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }
    return NextResponse.json({ dataset });
  } catch (err) {
    console.error("[GET /api/datasets/:id]", err);
    return NextResponse.json({ error: "Failed to load dataset" }, { status: 500 });
  }
}

/** Deletes the dataset and its records. The request it came from stays in History. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await repo.deleteDataset(id);
    if (!deleted) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/datasets/:id]", err);
    return NextResponse.json({ error: "Failed to delete dataset" }, { status: 500 });
  }
}
