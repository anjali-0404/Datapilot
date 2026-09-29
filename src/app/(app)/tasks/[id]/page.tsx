"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Pause,
  Play,
  XCircle,
  RotateCcw,
  ArrowLeft,
  PartyPopper,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { DataTask, Dataset } from "@/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/dashboard/task-status-badge";
import { PipelineStageRow } from "@/components/workflow/pipeline-stage";
import { IntentCard } from "@/components/workflow/intent-card";
import { ResultsPreviewTable } from "@/components/workflow/results-preview-table";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const deleteTask = useAppStore((s) => s.deleteTask);
  const [task, setTask] = React.useState<DataTask | null>(null);
  const [dataset, setDataset] = React.useState<Dataset | null>(null);
  const [missing, setMissing] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  // Poll the backend while the task is running; the server persists every
  // stage update to PostgreSQL, so this also works after a page refresh.
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const t = await api.getTask(id);
        if (cancelled) return;
        setTask(t);
        setMissing(false);
        if (t.status === "running" || t.status === "queued") {
          timer = setTimeout(load, 700);
        }
      } catch {
        if (!cancelled) setMissing(true);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, reloadKey]);

  const datasetId = task?.datasetId ?? null;
  React.useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    api
      .getDataset(datasetId)
      .then((d) => !cancelled && setDataset(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const act = async (fn: () => Promise<unknown>, errorMessage: string) => {
    try {
      await fn();
      setReloadKey((k) => k + 1);
    } catch {
      toast.error(errorMessage);
    }
  };
  const pauseTask = (tid: string) => act(() => api.pauseTask(tid), "Could not pause the task");
  const resumeTask = (tid: string) => act(() => api.resumeTask(tid), "Could not resume the task");
  const cancelTask = (tid: string) => act(() => api.cancelTask(tid), "Could not cancel the task");

  if (!task && !missing) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted">Loading request…</div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted">This request doesn&apos;t exist.</p>
        <Button variant="gradient" className="mt-4" asChild>
          <Link href="/tasks/new">Ask a new question</Link>
        </Button>
      </div>
    );
  }

  const handleRerun = async () => {
    try {
      const newId = await api.rerunTask(task.id);
      router.push(`/tasks/${newId}`);
    } catch {
      toast.error("Could not rerun this request");
    }
  };

  const removeTask = async () => {
    try {
      await deleteTask(task.id);
      toast.success("Request deleted");
      router.push("/history");
    } catch {
      toast.error("Could not delete the request. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to mission control
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <span className="text-xs text-muted-2">{formatRelativeTime(task.createdAt)}</span>
              <span className="font-mono text-[11px] text-muted-2">{task.id}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-foreground">{task.prompt}</p>
          </div>

          <div className="flex shrink-0 gap-2">
            {task.status === "running" && (
              <Button variant="outline" size="sm" onClick={() => pauseTask(task.id)}>
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            )}
            {task.status === "paused" && (
              <Button variant="outline" size="sm" onClick={() => resumeTask(task.id)}>
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            )}
            {(task.status === "running" || task.status === "paused" || task.status === "queued") && (
              <Button variant="destructive" size="sm" onClick={() => cancelTask(task.id)}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleRerun}>
              <RotateCcw className="h-3.5 w-3.5" /> Rerun
            </Button>
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete request?"
              onConfirm={removeTask}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline progress</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {task.stages.map((stage, i) => (
                <PipelineStageRow key={stage.id} stage={stage} isLast={i === task.stages.length - 1} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <IntentCard intent={task.intent} connectors={task.connectors} />

          {task.recordsFound > 0 && (
            <Card className="p-5">
              <p className="mb-3 text-xs font-medium text-muted">Collected so far</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="mono-tabular text-lg font-semibold text-foreground">{task.recordsFound}</p>
                  <p className="text-[11px] text-muted-2">records verified</p>
                </div>
                <div>
                  <p className="mono-tabular text-lg font-semibold text-foreground">{task.duplicatesRemoved}</p>
                  <p className="text-[11px] text-muted-2">duplicates removed</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {task.status === "completed" && dataset && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PartyPopper className="h-4 w-4 text-success" />
                <CardTitle>Dataset ready to use</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResultsPreviewTable dataset={dataset} />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
