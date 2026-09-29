"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ExtractedIntent } from "@/types";
import { CONNECTORS } from "@/lib/collection-engine";
import { Plug } from "lucide-react";

export function IntentCard({ intent, connectors }: { intent: ExtractedIntent | null; connectors: string[] }) {
  if (!intent) {
    return (
      <Card className="p-5">
        <p className="text-xs text-muted">AI is reading your question…</p>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <CardTitle>What the AI understood</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Field label="Looking for" value={intent.entityType} />
            <Field label="Where" value={intent.location ?? "Anywhere"} />
            <Field label="Parse confidence" value={`${Math.round(intent.confidence * 100)}%`} mono />
            <Field label="Fields to collect" value={`${intent.fields.length}`} mono />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-2">WILL COLLECT THESE COLUMNS</p>
            <div className="flex flex-wrap gap-1.5">
              {intent.fields.map((f) => (
                <Badge key={f} variant="secondary">{f}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-2">FILTERS APPLIED</p>
            <ul className="space-y-1">
              {intent.constraints.map((c) => (
                <li key={c} className="text-xs text-muted">• {c}</li>
              ))}
            </ul>
          </div>

          {connectors.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted-2">SOURCES BEING SEARCHED</p>
              <div className="space-y-1.5">
                {connectors.map((id) => {
                  const c = CONNECTORS.find((x) => x.id === id);
                  if (!c) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs text-foreground">
                      <Plug className="h-3 w-3 text-secondary" />
                      {c.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-2">{label}</p>
      <p className={`mt-0.5 text-foreground ${mono ? "mono-tabular" : ""}`}>{value}</p>
    </div>
  );
}
