"use client";

import { ArrowRight, AlertTriangle, CheckCircle2, Info, Sparkles, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AnalystBrief, BriefTone } from "@/lib/insights";

const TONE_ICON: Record<BriefTone, React.ReactNode> = {
  good: <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />,
  info: <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />,
  warn: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />,
};

export function AnalystBriefCard({ brief }: { brief: AnalystBrief }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>Analyst brief</CardTitle>
        </div>
        <p className="text-xs text-muted">
          Written from the rows below — every sentence traces back to records in this table.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <p className="text-base font-semibold leading-snug text-foreground">{brief.headline}</p>
          <div className="mt-2 space-y-1.5">
            {brief.narrative.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {brief.stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
              <p className="mono-tabular text-lg font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-2">{s.label}</p>
            </div>
          ))}
        </div>

        {brief.findings.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">What stands out</p>
            <ul className="space-y-1.5">
              {brief.findings.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted">
                  {TONE_ICON[f.tone]}
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.topMatches.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Top matches</p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {brief.topMatches.map((m, i) => (
                <li key={`${m.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="mono-tabular w-5 shrink-0 text-xs text-muted-2">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-2">{m.reason}</p>
                  </div>
                  <Badge
                    variant={m.confidence > 0.85 ? "success" : m.confidence > 0.7 ? "warning" : "danger"}
                  >
                    {Math.round(m.confidence * 100)}%
                  </Badge>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-primary transition-colors hover:text-primary/80"
                    title="Open source"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Column coverage</p>
          <div className="space-y-2">
            {brief.coverage.map((c) => (
              <div key={c.field} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-muted">{c.field}</span>
                <Progress value={c.pct} className="h-1.5 flex-1" />
                <span
                  className={cn(
                    "mono-tabular w-10 shrink-0 text-right text-xs",
                    c.pct >= 90 ? "text-success" : c.pct >= 60 ? "text-muted" : "text-warning"
                  )}
                >
                  {c.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {brief.gaps.length > 0 && (
          <div className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> What this dataset does not answer
            </p>
            <ul className="space-y-1">
              {brief.gaps.map((g, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted">
                  · {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">{brief.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
