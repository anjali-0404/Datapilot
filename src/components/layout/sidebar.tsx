"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Database,
  Plug,
  Workflow,
  History,
  Settings,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CORPUS } from "@/lib/corpus";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks/new", label: "New Task", icon: PlusCircle },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/sources", label: "Sources", icon: Plug },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[linear-gradient(135deg,#6d5bfa,#17b6d4)]">
          <Radar className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">DataPilot AI</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "text-foreground" : "text-muted hover:text-foreground hover:bg-surface-2/50"
              )}
            >
              {active && (
                <span className="absolute inset-0 rounded-md bg-surface-2 border border-border-strong" />
              )}
              <Icon className={cn("relative h-4 w-4", active && "text-primary")} />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-slow" />
            System operational
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            {CORPUS.length} verified organizations indexed. Every record links to its source.
          </p>
        </div>
      </div>
    </aside>
  );
}
