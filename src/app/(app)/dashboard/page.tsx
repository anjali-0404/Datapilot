"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import { ListChecks, Database, Plug, FolderOpen, PlusCircle, ArrowRight } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskRow } from "@/components/dashboard/task-row";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { CONNECTORS, SAMPLE_PROMPT } from "@/lib/collection-engine";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const tasks = useAppStore((s) => s.tasks);
  const datasets = useAppStore((s) => s.datasets);
  const fetchTasks = useAppStore((s) => s.fetchTasks);
  const fetchDatasets = useAppStore((s) => s.fetchDatasets);
  const submitPrompt = useAppStore((s) => s.submitPrompt);
  const router = useRouter();

  React.useEffect(() => {
    const load = () => {
      fetchTasks().catch(() => {});
      fetchDatasets().catch(() => {});
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchDatasets]);

  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "queued" || t.status === "paused").length;
  const recordsCollected = tasks.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.recordsFound, 0);
  const sourcesCount = CONNECTORS.length;

  const runSample = async () => {
    try {
      const id = await submitPrompt(SAMPLE_PROMPT);
      router.push(`/tasks/${id}`);
    } catch {
      toast.error("Could not start the sample request. Please try again.");
    }
  };

  const pipelineSteps = [
    { n: "01", title: "Describe", desc: "State the business need in plain English." },
    { n: "02", title: "AI interprets", desc: "LLM extracts entities, filters & fields." },
    { n: "03", title: "System collects", desc: "Ranks verified sources, validates, dedupes." },
    { n: "04", title: "You act", desc: "Explore, export CSV/JSON, contact leads." },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mission control</h1>
          <p className="mt-1 text-sm text-muted">Turn business questions into decision-ready datasets.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runSample}>
            <ArrowRight className="h-4 w-4" /> Try a sample request
          </Button>
          <Button variant="gradient" asChild>
            <Link href="/tasks/new">
              <PlusCircle className="h-4 w-4" /> New request
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active requests" value={activeTasks} icon={<ListChecks className="h-4 w-4" />} accent="primary" />
        <StatCard label="Verified records" value={recordsCollected} icon={<Database className="h-4 w-4" />} accent="secondary" />
        <StatCard label="Sources indexed" value={sourcesCount} icon={<Plug className="h-4 w-4" />} accent="success" />
        <StatCard label="Datasets ready" value={datasets.length} icon={<FolderOpen className="h-4 w-4" />} accent="accent" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pipelineSteps.map((s) => (
          <div key={s.n} className="rounded-xl border border-border bg-surface/50 p-4">
            <p className="font-mono text-[11px] text-muted-2">{s.n}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{s.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{s.desc}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent requests</h2>
          {tasks.length > 0 && (
            <Link href="/history" className="text-xs text-muted transition-colors hover:text-foreground">
              View all
            </Link>
          )}
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No requests yet"
            description="Ask a business question in plain English — e.g. sponsor leads, market scan, hiring intel — and watch the system build the dataset live."
            ctaLabel="Ask your first question"
            ctaHref="/tasks/new"
          />
        ) : (
          <div className="space-y-2.5">
            {tasks.slice(0, 6).map((task, i) => (
              <TaskRow key={task.id} task={task} index={i} />
            ))}
          </div>
        )}
      </div>

      {tasks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-2"
        >
          Tip: press <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px]">⌘K</kbd> anywhere to jump between pages or launch a sample request.
        </motion.div>
      )}
    </div>
  );
}
