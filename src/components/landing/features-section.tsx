"use client";

import { motion } from "framer-motion";
import {
  MessageSquareText,
  Workflow,
  Plug,
  ActivitySquare,
  ShieldCheck,
  Link2,
  Table2,
  BarChart3,
  Download,
  PlayCircle,
  History,
  SearchCheck,
} from "lucide-react";

const FEATURES = [
  { icon: MessageSquareText, title: "Plain-English intake", desc: "Brief it like you'd brief a colleague — no query language, no filter builder, no CSV schema to write first." },
  { icon: Workflow, title: "Per-question planning", desc: "Each request gets its own workflow. A hiring question and a sponsorship question are planned differently." },
  { icon: Plug, title: "Verified source layer", desc: "A curated knowledge base of real organizations with their official websites — nothing invented." },
  { icon: ActivitySquare, title: "Watch it happen", desc: "Every stage reports progress and logs live, so nothing is hidden behind a spinner." },
  { icon: ShieldCheck, title: "Validation with reasons", desc: "Broken links, malformed emails and incomplete rows are dropped — and the reason is logged, not hidden." },
  { icon: Link2, title: "Full provenance", desc: "Open any row and see exactly which source it came from. Verifiable, not vibes." },
  { icon: Table2, title: "Dataset Explorer", desc: "Search, filter, sort and page through request-specific columns that the AI defined for you." },
  { icon: BarChart3, title: "Built-in analytics", desc: "Match-quality distribution, source contribution and field coverage, visualized on arrival." },
  { icon: Download, title: "CSV / JSON export", desc: "Drop the table straight into a spreadsheet, a CRM import or your pitch deck." },
  { icon: PlayCircle, title: "Task controls", desc: "Pause, resume, cancel or rerun a request mid-flight if you want to change the question." },
  { icon: History, title: "Reusable workflows", desc: "Reopen any past question, clone it and run it again with one click." },
  { icon: SearchCheck, title: "Source inspector", desc: "See which sources were used and how many records each one actually contributed." },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-b border-border py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">From raw request to usable data</h2>
          <p className="mt-4 text-muted">
            Finding organizations is the easy half. The hard half is trusting the rows, knowing
            which question produced them, and getting them into the tool you actually work in —
            that&apos;s what these cover.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: (i % 3) * 0.06 }}
              className="rounded-xl border border-border bg-surface/50 p-5 transition-colors hover:border-border-strong hover:bg-surface/80"
            >
              <f.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <h3 className="mt-3.5 text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
