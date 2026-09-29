"use client";

import { motion } from "framer-motion";
import { Brain, ListTree, Radar as RadarIcon, ShieldCheck, Copy, PackageCheck } from "lucide-react";

const STAGES = [
  { icon: Brain, label: "Interpret", desc: "Grok 4.1 turns your sentence into structured intent — what you want, where, and which columns matter." },
  { icon: ListTree, label: "Plan", desc: "The engine picks which sources this specific question needs. Different question, different plan." },
  { icon: RadarIcon, label: "Collect", desc: "Gathering matching organizations and pulling their real details — names, sites, locations, contacts." },
  { icon: ShieldCheck, label: "Validate", desc: "Every row needs a name and a traceable source URL. Anything that can't be traced is dropped with a reason shown." },
  { icon: Copy, label: "Deduplicate", desc: "Records are matched on a normalized name + domain key, so the same organization never shows up twice." },
  { icon: PackageCheck, label: "Deliver", desc: "You get an analyst brief — headline, top matches, coverage, gaps — plus a table where every row cites its source." },
];

export function PipelineSection() {
  return (
    <section id="how-it-works" className="relative border-b border-border py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Six stages between a question and a dataset
          </h2>
          <p className="mt-4 text-muted">
            This isn&apos;t a scraper with fixed steps. The AI re-reads your question each time
            and decides what to collect, then the engine proves the result is clean before you
            ever see it.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage, i) => (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative bg-surface/70 p-6"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2/70 text-secondary">
                <stage.icon className="h-4.5 w-4.5" />
              </div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-2">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">{stage.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
