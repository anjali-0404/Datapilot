"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import type { WorkflowStage } from "@/types";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Plain-English answers to "what is the system doing right now?" — shown under
// each stage while the pipeline runs.
const STAGE_EXPLAINERS: Record<string, string> = {
  interpret: "AI reads your question and figures out what you're looking for, where, and which columns matter.",
  plan: "System picks the right sources for this specific question — not a fixed script, planned per request.",
  collect: "Gathering matching organizations and pulling their verified details.",
  validate: "Checking every website link, email format and field — bad rows get dropped with reasons.",
  deduplicate: "Comparing records pairwise so the same company never appears twice.",
  deliver: "Packaging the clean table: searchable, analyzable, exportable.",
};

export function PipelineStageRow({ stage, isLast }: { stage: WorkflowStage; isLast: boolean }) {
  const explainer = STAGE_EXPLAINERS[stage.id] ?? stage.description;
  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && (
        <span
          className={cn(
            "absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px",
            stage.status === "done" ? "bg-primary/40" : "bg-border"
          )}
        />
      )}

      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-surface"
        style={{
          borderColor: stage.status === "done" ? "var(--success)" : stage.status === "active" ? "var(--primary)" : "var(--border)",
        }}
      >
        {stage.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
        {stage.status === "active" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {stage.status === "pending" && <Circle className="h-3.5 w-3.5 text-muted-2" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className={cn("text-sm font-medium", stage.status === "pending" ? "text-muted-2" : "text-foreground")}>
            {stage.label}
          </h3>
          {stage.status === "active" && (
            <span className="mono-tabular text-xs text-primary">{stage.progress}%</span>
          )}
          {stage.status === "done" && <span className="text-xs text-success">Complete</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted">{explainer}</p>

        {stage.status === "active" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5">
            <Progress value={stage.progress} className="h-1" />
          </motion.div>
        )}

        {stage.logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2.5 space-y-1 overflow-hidden rounded-lg border border-border bg-surface-2/40 p-2.5"
          >
            {stage.logs.map((log, i) => (
              <p key={i} className="font-mono text-[11px] leading-relaxed text-muted">
                <span className="text-success">✓</span> {log}
              </p>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
