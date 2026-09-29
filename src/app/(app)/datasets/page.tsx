"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Database, ArrowUpRight, PlusCircle } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { formatRelativeTime } from "@/lib/utils";

export default function DatasetsPage() {
  const datasets = useAppStore((s) => s.datasets);
  const fetchDatasets = useAppStore((s) => s.fetchDatasets);

  React.useEffect(() => {
    fetchDatasets().catch(() => {});
  }, [fetchDatasets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
          <p className="mt-1 text-sm text-muted">
            The output of every question you&apos;ve asked — searchable, source-linked and ready
            to export.
          </p>
        </div>
        <Button variant="gradient" asChild>
          <Link href="/tasks/new"><PlusCircle className="h-4 w-4" /> New request</Link>
        </Button>
      </div>

      {datasets.length === 0 ? (
        <EmptyState
          icon={<Database className="h-5 w-5" />}
          title="No datasets yet"
          description="Ask a business question and the results land here as a clean table — with the source behind every row."
          ctaLabel="Ask your first question"
          ctaHref="/tasks/new"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((ds, i) => (
            <motion.div key={ds.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/datasets/${ds.id}`}>
                <Card className="group h-full p-5 transition-colors hover:border-border-strong hover:bg-surface/90">
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2/70 text-secondary">
                      <Database className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <h3 className="mt-3.5 line-clamp-1 text-sm font-medium text-foreground">{ds.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{ds.prompt}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="mono-tabular text-xs text-foreground">{ds.recordCount ?? ds.records.length} records</span>
                    <span className="text-[11px] text-muted-2">{formatRelativeTime(ds.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ds.columns.slice(0, 3).map((c) => (
                      <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                    ))}
                    {ds.columns.length > 3 && <Badge variant="secondary" className="text-[10px]">+{ds.columns.length - 3}</Badge>}
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
