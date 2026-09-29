"use client";

import Link from "next/link";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/60 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[linear-gradient(135deg,#6d5bfa,#17b6d4)]">
            <Radar className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">DataPilot AI</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#features" className="transition-colors hover:text-foreground">Capabilities</a>
          <a href="#preview" className="transition-colors hover:text-foreground">Product</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Mission control</Link>
          </Button>
          <Button variant="gradient" size="sm" asChild>
            <Link href="/tasks/new">Build a dataset</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
