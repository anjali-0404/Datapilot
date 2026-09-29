"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Download,
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { Dataset } from "@/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordDetailDialog } from "@/components/dataset/record-detail-dialog";
import { DatasetAnalytics } from "@/components/dataset/dataset-analytics";
import { exportDatasetAsCSV, exportDatasetAsJSON } from "@/lib/export";
import type { SourceRecord } from "@/types";
import { formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 8;

export default function DatasetExplorerPage() {
  const params = useParams<{ id: string }>();
  const datasetId = params.id;
  const router = useRouter();
  const deleteDataset = useAppStore((s) => s.deleteDataset);
  const [dataset, setDataset] = React.useState<Dataset | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api
      .getDataset(datasetId)
      .then((d) => !cancelled && setDataset(d))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const [search, setSearch] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<string>("confidence");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [selectedRecord, setSelectedRecord] = React.useState<SourceRecord | null>(null);

  const filtered = React.useMemo(() => {
    if (!dataset) return [];
    let records = dataset.records;

    if (sourceFilter !== "all") {
      records = records.filter((r) => r.sourceName === sourceFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      records = records.filter((r) =>
        Object.values(r.fields).some((v) => String(v).toLowerCase().includes(q))
      );
    }

    records = [...records].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "confidence") {
        av = a.confidence;
        bv = b.confidence;
      } else if (sortKey === "collectedAt") {
        av = a.collectedAt;
        bv = b.collectedAt;
      } else {
        av = String(a.fields[sortKey] ?? "");
        bv = String(b.fields[sortKey] ?? "");
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return records;
  }, [dataset, search, sourceFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [prevFilters, setPrevFilters] = React.useState({ search, sourceFilter });
  if (prevFilters.search !== search || prevFilters.sourceFilter !== sourceFilter) {
    setPrevFilters({ search, sourceFilter });
    setPage(1);
  }

  if (!dataset && !missing) {
    return <div className="flex items-center justify-center py-24 text-sm text-muted">Loading dataset…</div>;
  }

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted">This dataset doesn&apos;t exist.</p>
        <Button variant="gradient" className="mt-4" asChild>
          <Link href="/tasks/new">Run a new task</Link>
        </Button>
      </div>
    );
  }

  const sources = Array.from(new Set(dataset.records.map((r) => r.sourceName)));

  const removeDataset = async () => {
    try {
      await deleteDataset(dataset.id);
      toast.success("Dataset deleted");
      router.push("/datasets");
    } catch {
      toast.error("Could not delete the dataset. Please try again.");
    }
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/datasets" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to datasets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{dataset.name}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">{dataset.prompt}</p>
            <p className="mt-2 text-xs text-muted-2">
              {dataset.records.length} records · created {formatRelativeTime(dataset.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label="Delete dataset"
              confirmLabel="Delete permanently?"
              onConfirm={removeDataset}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              size="default"
              className="h-9"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gradient">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportDatasetAsCSV(dataset)}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportDatasetAsJSON(dataset)}>
                  <FileJson className="h-3.5 w-3.5" /> Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
              <Input
                placeholder="Search records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filtered.length} matching</Badge>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-surface-2/40 text-muted-2">
                  <tr>
                    {dataset.columns.map((c) => (
                      <SortableHeader key={c} label={c} active={sortKey === c} dir={sortDir} onClick={() => toggleSort(c)} />
                    ))}
                    <SortableHeader label="Confidence" active={sortKey === "confidence"} dir={sortDir} onClick={() => toggleSort("confidence")} />
                    <th className="px-4 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRecords.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      className="cursor-pointer transition-colors hover:bg-surface-2/30"
                    >
                      {dataset.columns.map((c) => (
                        <td key={c} className="whitespace-nowrap px-4 py-2.5 text-foreground">
                          {String(r.fields[c] ?? "—")}
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <Badge variant={r.confidence > 0.85 ? "success" : r.confidence > 0.7 ? "warning" : "danger"}>
                          {Math.round(r.confidence * 100)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {r.sourceName} <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {pageRecords.length === 0 && (
                    <tr>
                      <td colSpan={dataset.columns.length + 2} className="px-4 py-10 text-center text-sm text-muted">
                        No records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-2">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <DatasetAnalytics dataset={dataset} />
        </TabsContent>
      </Tabs>

      <RecordDetailDialog record={selectedRecord} open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)} />
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 font-medium">
      <button onClick={onClick} className="flex items-center gap-1 transition-colors hover:text-foreground">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "text-primary" : "text-muted-2"}`} />
        {active && <span className="text-[10px] text-primary">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
