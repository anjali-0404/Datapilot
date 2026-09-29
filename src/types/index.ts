export type StageId =
  | "interpret"
  | "plan"
  | "collect"
  | "validate"
  | "deduplicate"
  | "deliver";

export type StageStatus = "pending" | "active" | "done" | "error";

export interface WorkflowStage {
  id: StageId;
  label: string;
  description: string;
  status: StageStatus;
  progress: number; // 0-100
  logs: string[];
  durationMs?: number;
}

export type TaskStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface ExtractedIntent {
  goal: string;
  entityType: string;
  location?: string;
  industry?: string;
  fields: string[];
  constraints: string[];
  confidence: number;
}

export interface Connector {
  id: string;
  name: string;
  type: "api" | "web" | "file" | "database";
  status: "active" | "syncing" | "idle" | "error";
  recordsContributed: number;
  reliability: number;
  icon: string;
}

export interface SourceRecord {
  id: string;
  taskId: string;
  fields: Record<string, string | number>;
  confidence: number;
  sourceName: string;
  sourceUrl: string;
  collectedAt: string;
  flagged?: boolean;
}

export interface DataTask {
  id: string;
  prompt: string;
  createdAt: string;
  status: TaskStatus;
  intent: ExtractedIntent | null;
  stages: WorkflowStage[];
  connectors: string[];
  recordsFound: number;
  duplicatesRemoved: number;
  datasetId: string | null;
  progress: number;
}

export interface Dataset {
  id: string;
  taskId: string;
  name: string;
  prompt: string;
  createdAt: string;
  columns: string[];
  records: SourceRecord[];
  sourcesUsed: string[];
  recordCount?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  prompt: string;
  usageCount: number;
  createdAt: string;
  stages: StageId[];
  connectors: string[];
}
