"use client";

import { create } from "zustand";
import type { DataTask, Dataset, WorkflowTemplate } from "@/types";
import { api, type SourceStat } from "@/lib/api";

// Thin client cache over the real backend (/api/*, backed by PostgreSQL).
// All state of record lives on the server; this store only caches the list
// views and holds UI state such as the command palette.
interface AppState {
  tasks: DataTask[];
  datasets: Dataset[];
  workflows: WorkflowTemplate[];
  sources: SourceStat[];
  loaded: { tasks: boolean; datasets: boolean; workflows: boolean; sources: boolean };
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  fetchTasks: () => Promise<void>;
  fetchDatasets: () => Promise<void>;
  fetchWorkflows: () => Promise<void>;
  fetchSources: () => Promise<void>;
  updateSource: (id: string, active: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  clearWorkspace: () => Promise<{ tasks: number; datasets: number }>;
  submitPrompt: (prompt: string) => Promise<string>;
}

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  datasets: [],
  workflows: [],
  sources: [],
  loaded: { tasks: false, datasets: false, workflows: false, sources: false },
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  fetchTasks: async () => {
    const tasks = await api.listTasks();
    set((s) => ({ tasks, loaded: { ...s.loaded, tasks: true } }));
  },
  fetchDatasets: async () => {
    const datasets = await api.listDatasets();
    set((s) => ({ datasets, loaded: { ...s.loaded, datasets: true } }));
  },
  fetchWorkflows: async () => {
    const workflows = await api.listWorkflows();
    set((s) => ({ workflows, loaded: { ...s.loaded, workflows: true } }));
  },
  fetchSources: async () => {
    const sources = await api.listSources();
    set((s) => ({ sources, loaded: { ...s.loaded, sources: true } }));
  },
  updateSource: async (id, active) => {
    const sources = await api.updateSource(id, active ? "active" : "idle");
    set((s) => ({ sources, loaded: { ...s.loaded, sources: true } }));
  },
  deleteTask: async (id) => {
    await api.deleteTask(id);
    const [tasks, datasets, workflows] = await Promise.all([
      api.listTasks(),
      api.listDatasets(),
      api.listWorkflows(),
    ]);
    set({ tasks, datasets, workflows });
  },
  deleteDataset: async (id) => {
    await api.deleteDataset(id);
    const [tasks, datasets] = await Promise.all([api.listTasks(), api.listDatasets()]);
    set({ tasks, datasets });
  },
  clearWorkspace: async () => {
    const result = await api.clearWorkspace();
    set({ tasks: [], datasets: [], workflows: [] });
    return result;
  },
  submitPrompt: (prompt) => api.createTask(prompt),
}));
