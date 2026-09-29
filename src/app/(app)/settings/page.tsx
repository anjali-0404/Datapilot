"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type RuntimeConfig } from "@/lib/api";
import { CORPUS } from "@/lib/corpus";
import { useAppStore } from "@/store/use-app-store";
import { toast } from "sonner";

export default function SettingsPage() {
  const [notifications, setNotifications] = React.useState(true);
  const [config, setConfig] = React.useState<RuntimeConfig | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const clearWorkspace = useAppStore((s) => s.clearWorkspace);

  React.useEffect(() => {
    api.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const resetWorkspace = async () => {
    setResetting(true);
    try {
      const result = await clearWorkspace();
      toast.success(`Deleted ${result.tasks} requests and ${result.datasets} datasets`);
    } catch {
      toast.error("Could not reset the workspace. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">How DataPilot connects and behaves.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>The pipeline behind every request you make.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <HowRow n="1" title="Understand" desc="An LLM reads your question and extracts entities, filters and the exact fields you need." />
          <HowRow n="2" title="Collect" desc={`The engine ranks ${CORPUS.length} verified organizations against that intent — no invented companies, no dead links.`} />
          <HowRow n="3" title="Prove" desc="Every record is validated (URL, email, completeness), deduped and scored — then linked to its source." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Behavior for new requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Task notifications" description="Notify when a request finishes running.">
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reasoning engine</CardTitle>
          <CardDescription>
            Read live from the server. Configure it with <code className="font-mono text-[11px]">NVIDIA_API_KEY</code>{" "}
            (preferred — free NIM key from build.nvidia.com) or{" "}
            <code className="font-mono text-[11px]">OPENROUTER_API_KEY</code>, plus{" "}
            <code className="font-mono text-[11px]">NVIDIA_MODEL</code> /{" "}
            <code className="font-mono text-[11px]">AI_MODEL</code> (see{" "}
            <code className="font-mono text-[11px]">.env.example</code>) — secrets never reach the browser. The first
            provider that answers is used; if all fail, the local NLP fallback runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Provider</span>
            <span className="text-foreground">{config?.ai.provider ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Model</span>
            <span className="font-mono text-xs text-foreground">{config?.ai.model ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Intent extraction</span>
            {config === null ? (
              <Badge variant="secondary">Checking…</Badge>
            ) : config.ai.configured ? (
              <Badge variant="success">Live — real LLM extraction</Badge>
            ) : (
              <Badge variant="warning">Local NLP fallback</Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-2">
            The engine reads your question and turns it into the structured request the pipeline
            runs. Without a key the app still works end to end using the built-in deterministic
            parser — it just won&apos;t reason over unusual wording.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Where datasets are stored and how much they can draw on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">PostgreSQL</span>
            {config === null ? (
              <Badge variant="secondary">Checking…</Badge>
            ) : config.databaseConnected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="danger">Unreachable</Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Knowledge base</span>
            <span className="text-foreground">
              {config ? `${config.knowledgeBase.organizations} verified organizations` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Source layers</span>
            <Link href="/sources" className="text-foreground underline decoration-dotted underline-offset-4">
              {config ? `${config.knowledgeBase.sourceLayers} indexed · manage` : "manage"}
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Everything here belongs to this single workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Plan</span>
            <Badge variant="secondary">Hackathon build</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div>
              <p className="text-sm text-foreground">Reset workspace</p>
              <p className="text-xs text-muted">
                Deletes every request, dataset, record and workflow. Cannot be undone.
              </p>
            </div>
            <Button variant="destructive" size="sm" disabled={resetting} onClick={resetWorkspace}>
              <Trash2 className="h-3.5 w-3.5" /> {resetting ? "Resetting…" : "Delete all data"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HowRow({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2/60 font-mono text-[11px] text-secondary">{n}</span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label>{label}</Label>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}



