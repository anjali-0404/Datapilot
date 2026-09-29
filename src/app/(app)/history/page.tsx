"use client";

import * as React from "react";
import { History as HistoryIcon } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { TaskRow } from "@/components/dashboard/task-row";
import { EmptyState } from "@/components/layout/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TaskStatus } from "@/types";

const FILTERS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

export default function HistoryPage() {
  const tasks = useAppStore((s) => s.tasks);
  const fetchTasks = useAppStore((s) => s.fetchTasks);

  React.useEffect(() => {
    const load = () => fetchTasks().catch(() => {});
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [fetchTasks]);
  const [filter, setFilter] = React.useState<TaskStatus | "all">("all");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted">Every question you&apos;ve asked, with its pipeline status and results.</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskStatus | "all")}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-5 w-5" />}
          title="Nothing here yet"
          description="Once you ask a question, the run shows up here — completed, in progress, paused or cancelled."
          ctaLabel="Ask a question"
          ctaHref="/tasks/new"
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((task, i) => (
            <TaskRow key={task.id} task={task} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
