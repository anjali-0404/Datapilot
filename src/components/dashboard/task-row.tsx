"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { TaskStatusBadge } from "@/components/dashboard/task-status-badge";
import { useAppStore } from "@/store/use-app-store";
import type { DataTask } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { Database, ArrowUpRight, Trash2 } from "lucide-react";

export function TaskRow({ task, index = 0 }: { task: DataTask; index?: number }) {
  const activeStage = task.stages.find((s) => s.status === "active");
  const doneCount = task.stages.filter((s) => s.status === "done").length;
  const deleteTask = useAppStore((s) => s.deleteTask);

  const remove = async () => {
    try {
      await deleteTask(task.id);
      toast.success("Request deleted");
    } catch {
      toast.error("Could not delete the request. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card className="group relative p-4 transition-colors hover:border-border-strong hover:bg-surface/90">
        <Link href={`/tasks/${task.id}`} className="absolute inset-0 rounded-xl" aria-label="Open request" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <span className="text-xs text-muted-2">{formatRelativeTime(task.createdAt)}</span>
            </div>
            <p className="mt-2 line-clamp-1 text-sm text-foreground">{task.prompt}</p>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-2">
                  <span>
                    {task.status === "completed"
                      ? "Workflow complete"
                      : activeStage
                      ? `${activeStage.label}…`
                      : `${doneCount}/6 stages`}
                  </span>
                  <span className="mono-tabular">{task.progress}%</span>
                </div>
                <Progress value={task.progress} className="h-1" />
              </div>
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 flex-col items-end gap-1 text-right">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mono-tabular">
              <Database className="h-3.5 w-3.5 text-muted" />
              {task.recordsFound}
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
              <ConfirmButton
                label=""
                confirmLabel="Delete request?"
                onConfirm={remove}
                icon={<Trash2 className="h-3.5 w-3.5" />}
                variant="ghost"
                size="sm"
                className="px-2 text-muted-2 hover:text-danger"
              />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
