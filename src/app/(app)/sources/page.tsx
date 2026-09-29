"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Globe, Building2, Newspaper, Users, Leaf, Briefcase, Plug, Info } from "lucide-react";
import { CONNECTORS, SOURCE_LAYER_NOTES } from "@/lib/collection-engine";
import { useAppStore } from "@/store/use-app-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  globe: Globe,
  building: Building2,
  newspaper: Newspaper,
  users: Users,
  leaf: Leaf,
  briefcase: Briefcase,
};

interface LayerView {
  id: string;
  name: string;
  type: string;
  status: string;
  reliability: number;
  recordsContributed: number;
}

export default function SourcesPage() {
  const apiSources = useAppStore((s) => s.sources);
  const fetchSources = useAppStore((s) => s.fetchSources);
  const updateSource = useAppStore((s) => s.updateSource);
  const [saving, setSaving] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchSources().catch(() => {});
  }, [fetchSources]);

  // Static metadata (icon, description) + live status/contributions from the DB.
  const layers: LayerView[] = React.useMemo(
    () =>
      CONNECTORS.map((c) => {
        const live = apiSources.find((s) => s.id === c.id);
        return {
          id: c.id,
          name: live?.name ?? c.name,
          type: live?.type ?? c.type,
          status: live?.status ?? c.status,
          reliability: live?.reliability ?? c.reliability,
          recordsContributed: live?.recordsContributed ?? 0,
        };
      }),
    [apiSources]
  );

  const activeCount = layers.filter((l) => l.status === "active").length;

  const toggle = async (id: string, active: boolean) => {
    setSaving(id);
    try {
      await updateSource(id, active);
      toast.success(active ? "Source switched on" : "Source switched off");
    } catch {
      toast.error("Could not update the source. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every record you get is drawn from one of these knowledge-base layers, and each row
            in a dataset keeps a link back to the layer it came from. Switch a layer off and new
            questions stop searching it.
          </p>
        </div>
        <Badge variant="success" className="shrink-0">{activeCount} of {layers.length} layers active</Badge>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p className="text-xs leading-relaxed text-muted">
          Planning happens per question: DataPilot picks the layers that match your question, so a
          sponsorship question and a hiring question search different sets. Records already
          collected keep the source they came from even if you switch a layer off later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {layers.map((layer, i) => {
          const meta = CONNECTORS.find((c) => c.id === layer.id);
          const Icon = ICONS[meta?.icon ?? "globe"] ?? Plug;
          const active = layer.status === "active";
          return (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2/70 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant={active ? "success" : "secondary"}>
                    {active ? "active" : "off"}
                  </Badge>
                </div>

                <h3 className="mt-3.5 text-sm font-medium text-foreground">{layer.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{SOURCE_LAYER_NOTES[layer.id]}</p>

                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <Row label="Records contributed" value={layer.recordsContributed.toString()} />
                  <Row label="Source quality" value={`${layer.reliability}%`} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted">
                    {saving === layer.id ? "Saving…" : active ? "Searched on new questions" : "Not searched"}
                  </span>
                  <Switch
                    checked={active}
                    disabled={saving === layer.id}
                    onCheckedChange={(checked) => toggle(layer.id, checked)}
                  />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="mono-tabular font-medium text-foreground">{value}</span>
    </div>
  );
}
