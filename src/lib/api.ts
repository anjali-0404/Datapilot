import type { DataTask, Dataset, WorkflowTemplate } from "@/types";

export interface SourceStat {
  id: string;
  name: string;
  type: string;
  status: string;
  reliability: number;
  recordsContributed: number;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    throw new ApiError(`Request to ${url} failed`, res.status);
  }
  return (await res.json()) as T;
}

const post = <T>(url: string, body?: unknown) =>
  request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const patch = <T>(url: string, body: unknown) =>
  request<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const del = <T>(url: string) => request<T>(url, { method: "DELETE" });

export interface RuntimeConfig {
  ai: { configured: boolean; provider: string; model: string };
  databaseConnected: boolean;
  knowledgeBase: { organizations: number; sourceLayers: number };
}

export const api = {
  listTasks: () => request<{ tasks: DataTask[] }>("/api/tasks").then((r) => r.tasks),
  getTask: (id: string) => request<{ task: DataTask }>(`/api/tasks/${id}`).then((r) => r.task),
  createTask: (prompt: string) => post<{ id: string }>("/api/tasks", { prompt }).then((r) => r.id),
  pauseTask: (id: string) => post(`/api/tasks/${id}/pause`),
  resumeTask: (id: string) => post(`/api/tasks/${id}/resume`),
  cancelTask: (id: string) => post(`/api/tasks/${id}/cancel`),
  rerunTask: (id: string) => post<{ id: string }>(`/api/tasks/${id}/rerun`).then((r) => r.id),
  deleteTask: (id: string) => del(`/api/tasks/${id}`),
  listDatasets: () => request<{ datasets: Dataset[] }>("/api/datasets").then((r) => r.datasets),
  getDataset: (id: string) => request<{ dataset: Dataset }>(`/api/datasets/${id}`).then((r) => r.dataset),
  deleteDataset: (id: string) => del(`/api/datasets/${id}`),
  listWorkflows: () => request<{ workflows: WorkflowTemplate[] }>("/api/workflows").then((r) => r.workflows),
  listSources: () => request<{ sources: SourceStat[] }>("/api/sources").then((r) => r.sources),
  updateSource: (id: string, status: "active" | "idle") =>
    patch<{ sources: SourceStat[] }>("/api/sources", { id, status }).then((r) => r.sources),
  getConfig: () => request<RuntimeConfig>("/api/config"),
  clearWorkspace: () => del<{ tasks: number; datasets: number }>("/api/workspace"),
};
