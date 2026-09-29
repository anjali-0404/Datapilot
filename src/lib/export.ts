import type { Dataset } from "@/types";

export function exportDatasetAsJSON(dataset: Dataset) {
  const payload = dataset.records.map((r) => ({
    id: r.id,
    ...r.fields,
    confidence: r.confidence,
    source: r.sourceName,
    sourceUrl: r.sourceUrl,
    collectedAt: r.collectedAt,
    // Never silently dropped: a reviewer needs to see which rows were flagged.
    flagged: r.flagged ?? false,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${slug(dataset.name)}.json`);
}

export function exportDatasetAsCSV(dataset: Dataset) {
  const headers = [...dataset.columns, "confidence", "source", "sourceUrl", "collectedAt", "flagged"];
  const rows = dataset.records.map((r) => {
    const cells = dataset.columns.map((c) => csvCell(r.fields[c]));
    return [
      ...cells,
      r.confidence.toString(),
      csvCell(r.sourceName),
      csvCell(r.sourceUrl),
      r.collectedAt,
      r.flagged ? "true" : "false",
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  downloadBlob(blob, `${slug(dataset.name)}.csv`);
}

function csvCell(value: string | number | undefined) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "dataset";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
