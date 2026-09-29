"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Dataset } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ResultsPreviewTable({ dataset }: { dataset: Dataset }) {
  const columns = dataset.columns.slice(0, 4);
  const rows = dataset.records.slice(0, 6);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/40 px-4 py-2.5">
        <p className="text-xs font-medium text-foreground">
          {dataset.records.length} source-linked records · {dataset.sourcesUsed.length} source layer{dataset.sourcesUsed.length === 1 ? "" : "s"} · every row opens its source
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/datasets/${dataset.id}`}>
            Open full dataset <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-2/20 text-muted-2">
            <tr>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-2 font-medium">{c}</th>
              ))}
              <th className="whitespace-nowrap px-4 py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-surface-2/30">
                {columns.map((c) => (
                  <td key={c} className="whitespace-nowrap px-4 py-2.5 text-foreground">
                    {String(r.fields[c] ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={r.confidence > 0.85 ? "success" : r.confidence > 0.7 ? "warning" : "danger"} title={r.confidence > 0.85 ? "Strong match: relevant + complete" : r.confidence > 0.7 ? "Good match: relevant, minor gaps" : "Weak match: check before using"}>
                      {Math.round(r.confidence * 100)}%
                    </Badge>
                    {r.flagged && (
                      <Badge variant="warning" title="Flagged during validation or topped up without a relevance match — check before acting on this row">
                        review
                      </Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
