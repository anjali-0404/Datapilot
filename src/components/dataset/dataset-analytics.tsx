"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types";

const PIE_COLORS = ["#6d5bfa", "#17b6d4", "#b968f0", "#2cd696", "#f6ad3c", "#f3556a"];

export function DatasetAnalytics({ dataset }: { dataset: Dataset }) {
  const sourceBreakdown = React.useMemo(() => {
    const map = new Map<string, number>();
    dataset.records.forEach((r) => map.set(r.sourceName, (map.get(r.sourceName) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [dataset.records]);

  const confidenceBuckets = React.useMemo(() => {
    const buckets = [
      { name: "90-100%", min: 0.9, max: 1.01, count: 0 },
      { name: "80-89%", min: 0.8, max: 0.9, count: 0 },
      { name: "70-79%", min: 0.7, max: 0.8, count: 0 },
      { name: "<70%", min: 0, max: 0.7, count: 0 },
    ];
    dataset.records.forEach((r) => {
      const bucket = buckets.find((b) => r.confidence >= b.min && r.confidence < b.max);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [dataset.records]);

  const avgConfidence = React.useMemo(() => {
    if (dataset.records.length === 0) return 0;
    return Math.round((dataset.records.reduce((s, r) => s + r.confidence, 0) / dataset.records.length) * 100);
  }, [dataset.records]);

  const flaggedCount = dataset.records.filter((r) => r.flagged).length;
  const strongCount = dataset.records.filter((r) => r.confidence >= 0.85).length;

  // Per-column fill rate — the honest answer to "how much of my question did
  // this dataset actually answer?", which an average confidence number hides.
  const columnCoverage = React.useMemo(() => {
    const filled = (v: unknown) => {
      const s = String(v ?? "").trim();
      return s !== "" && s !== "—";
    };
    return dataset.columns.map((field) => {
      const count = dataset.records.filter((r) => filled(r.fields[field])).length;
      const pct = dataset.records.length > 0 ? Math.round((count / dataset.records.length) * 100) : 0;
      return { field, pct };
    });
  }, [dataset]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-1">
        <p className="text-xs font-medium text-muted">Summary</p>
        <div className="mt-4 space-y-4">
          <Metric label="Average confidence" value={`${avgConfidence}%`} />
          <Metric label="Strong matches (85%+)" value={`${strongCount}`} />
          <Metric label="Sources queried" value={`${dataset.sourcesUsed.length}`} />
          <Metric label="Flagged for review" value={`${flaggedCount}`} accent={flaggedCount > 0 ? "warning" : undefined} />
        </div>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Confidence distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-56 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={confidenceBuckets}>
              <XAxis dataKey="name" tick={{ fill: "#8b90ab", fontSize: 11 }} axisLine={{ stroke: "#202441" }} tickLine={false} />
              <YAxis tick={{ fill: "#8b90ab", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: "#0e1019", border: "1px solid #202441", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#f2f3f8" }}
                cursor={{ fill: "rgba(109,91,250,0.08)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {confidenceBuckets.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Records by source</CardTitle>
        </CardHeader>
        <CardContent className="h-56 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sourceBreakdown}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
              >
                {sourceBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0e1019", border: "1px solid #202441", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#f2f3f8" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="-mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {sourceBreakdown.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.name}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="p-5 lg:col-span-3">
        <p className="text-xs font-medium text-muted">Column coverage — how completely each requested column is filled</p>
        <div className="mt-4 space-y-3">
          {columnCoverage.map((c) => (
            <div key={c.field} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs text-muted">{c.field}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    c.pct >= 90 ? "bg-success" : c.pct >= 60 ? "bg-primary" : "bg-warning"
                  )}
                  style={{ width: `${c.pct}%` }}
                />
              </div>
              <span className={cn(
                "mono-tabular w-12 shrink-0 text-right text-xs",
                c.pct >= 90 ? "text-success" : c.pct >= 60 ? "text-muted" : "text-warning"
              )}>
                {c.pct}%
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`mono-tabular text-sm font-medium ${accent === "warning" ? "text-warning" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
