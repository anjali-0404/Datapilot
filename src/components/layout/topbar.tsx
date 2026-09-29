"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, PlusCircle, Database, Plug, Settings, LogOut, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const sources = useAppStore((s) => s.sources);
  const fetchSources = useAppStore((s) => s.fetchSources);
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  const router = useRouter();

  React.useEffect(() => {
    fetchSources().catch(() => {});
  }, [fetchSources]);

  const activeSources = sources.filter((s) => s.status === "active").length;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/60 px-5 backdrop-blur-sm">
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex w-72 items-center gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search or run a command…</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-2">
          {isMac ? "⌘" : "Ctrl"}K
        </kbd>
      </button>

      <div className="flex items-center gap-3">
        <Link
          href="/sources"
          className="hidden text-xs text-muted transition-colors hover:text-foreground sm:inline"
        >
          {activeSources > 0 ? `${activeSources} source layers active` : "Source layers"}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-[linear-gradient(135deg,#6d5bfa,#17b6d4)] text-white">DP</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              DataPilot workspace
              <span className="mt-0.5 block text-[11px] font-normal text-muted-2">
                Single-user build — no sign-in configured
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
              <LayoutDashboard className="h-4 w-4" /> Mission control
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/tasks/new")}>
              <PlusCircle className="h-4 w-4" /> Ask a question
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/datasets")}>
              <Database className="h-4 w-4" /> Datasets
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/sources")}>
              <Plug className="h-4 w-4" /> Sources
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <Trash2 className="h-4 w-4 text-danger" /> Delete all data…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/")}>
              <LogOut className="h-4 w-4" /> Exit to landing page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
