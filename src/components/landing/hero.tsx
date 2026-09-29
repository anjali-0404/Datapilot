"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const DataNetworkScene = dynamic(
  () => import("@/components/three/data-network-scene").then((m) => m.DataNetworkScene),
  { ssr: false }
);

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <div className="grid-fade pointer-events-none absolute inset-0" />
      <div className="absolute inset-0 -z-10 opacity-90">
        <DataNetworkScene className="h-full w-full" />
      </div>

      <div className="relative mx-auto flex min-h-[86vh] max-w-7xl flex-col justify-center px-6 pt-24 pb-16 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/70 px-3 py-1 text-xs text-muted glass">
            <Sparkles className="h-3.5 w-3.5 text-secondary" />
            Built with Grok 4.1 via OpenRouter
          </div>

          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Ask a business question.
            <br />
            <span className="text-gradient">Get a dataset you can act on.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Sponsors to email. Companies to sell to. Roles to apply for. Say what you need in
            plain English — DataPilot decides which sources to search, collects the records,
            verifies every link, removes duplicates, and hands you a clean table with the
            source behind each row.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="gradient" asChild>
              <Link href="/tasks/new">
                Build my dataset <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">See mission control</Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-muted-2">
            <PipelineChip label="Your question" />
            <Chevron />
            <PipelineChip label="Grok 4.1 reads it" />
            <Chevron />
            <PipelineChip label="Sources planned" />
            <Chevron />
            <PipelineChip label="Records verified" />
            <Chevron />
            <PipelineChip label="Duplicates merged" />
            <Chevron />
            <PipelineChip label="Dataset ready" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PipelineChip({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-border bg-surface/60 px-2.5 py-1 font-mono text-[11px] tracking-wide text-muted">
      {label}
    </span>
  );
}

function Chevron() {
  return <span className="text-muted-2">/</span>;
}
