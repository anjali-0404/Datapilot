"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Workflow as WorkflowIcon, Copy, PlusCircle } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { formatRelativeTime } from "@/lib/utils";
import { STAGE_META } from "@/lib/collection-engine";

export default function WorkflowsPage() {
  const workflows = useAppStore((s) => s.workflows);
  const fetchWorkflows = useAppStore((s) => s.fetchWorkflows);
  const submitPrompt = useAppStore((s) => s.submitPrompt);
  const router = useRouter();

  React.useEffect(() => {
    fetchWorkflows().catch(() => {});
  }, [fetchWorkflows]);

  const clone = async (prompt: string) => {
    try {
      const id = await submitPrompt(prompt);
      router.push(`/tasks/${id}`);
    } catch {
      toast.error("Could not start the workflow. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-muted">Past questions you can clone and run again with one click.</p>
        </div>
        <Button variant="gradient" asChild>
          <Link href="/tasks/new"><PlusCircle className="h-4 w-4" /> New request</Link>
        </Button>
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon className="h-5 w-5" />}
          title="No workflows yet"
          description="Ask a question and the pipeline it generated is saved here, ready to reuse."
          ctaLabel="Ask a question"
          ctaHref="/tasks/new"
        />
      ) : (
        <div className="space-y-3">
          {workflows.map((wf, i) => (
            <motion.div key={wf.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <WorkflowIcon className="h-3.5 w-3.5 text-primary" />
                      <h3 className="text-sm font-medium text-foreground">{wf.name}</h3>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs text-muted">{wf.prompt}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {wf.stages.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{STAGE_META[s].label}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[11px] text-muted-2">{formatRelativeTime(wf.createdAt)}</span>
                    <Button variant="outline" size="sm" onClick={() => clone(wf.prompt)}>
                      <Copy className="h-3.5 w-3.5" /> Clone & run
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
