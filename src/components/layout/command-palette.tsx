"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Database,
  Plug,
  Workflow,
  History,
  Settings,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { SAMPLE_PROMPT } from "@/lib/collection-engine";
import { toast } from "sonner";

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const submitPrompt = useAppStore((s) => s.submitPrompt);
  const router = useRouter();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  const runSample = async () => {
    setOpen(false);
    try {
      const id = await submitPrompt(SAMPLE_PROMPT);
      router.push(`/tasks/${id}`);
    } catch {
      toast.error("Could not start the sample request. Please try again.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm pt-[15vh]" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
        <Command
          className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl"
          shouldFilter
        >
          <div className="flex items-center border-b border-border px-3">
            <Command.Input
              autoFocus
              placeholder="Type a command or search…"
              className="h-12 w-full bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-2"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted">No results found.</Command.Empty>

            <Command.Group heading="Quick actions" className="px-2 py-1.5 text-[11px] font-medium text-muted-2 [&_[cmdk-group-heading]]:mb-1">
              <Item onSelect={runSample} icon={<Sparkles className="h-4 w-4 text-secondary" />}>
                Try a sample: sponsor outreach for a college tech fest
              </Item>
              <Item onSelect={() => go("/tasks/new")} icon={<PlusCircle className="h-4 w-4" />}>
                Ask a business question
              </Item>
            </Command.Group>

            <Command.Group heading="Navigate" className="px-2 py-1.5 text-[11px] font-medium text-muted-2 [&_[cmdk-group-heading]]:mb-1">
              <Item onSelect={() => go("/dashboard")} icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</Item>
              <Item onSelect={() => go("/datasets")} icon={<Database className="h-4 w-4" />}>Datasets</Item>
              <Item onSelect={() => go("/sources")} icon={<Plug className="h-4 w-4" />}>Sources</Item>
              <Item onSelect={() => go("/workflows")} icon={<Workflow className="h-4 w-4" />}>Workflows</Item>
              <Item onSelect={() => go("/history")} icon={<History className="h-4 w-4" />}>History</Item>
              <Item onSelect={() => go("/settings")} icon={<Settings className="h-4 w-4" />}>Settings</Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({
  children,
  icon,
  onSelect,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground data-[selected=true]:bg-surface-2 aria-selected:bg-surface-2"
    >
      {icon}
      {children}
    </Command.Item>
  );
}
