"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Building2, Briefcase, Rocket, Leaf, ShieldCheck, Download, Mail } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { SAMPLE_PROMPT } from "@/lib/collection-engine";
import { toast } from "sonner";

const EXAMPLES = [
  {
    icon: Leaf,
    title: "Sponsor outreach",
    why: "Find companies to email for fest sponsorship",
    prompt: SAMPLE_PROMPT,
  },
  {
    icon: Briefcase,
    title: "Hiring intel",
    why: "See who is hiring, which roles, what pay bands",
    prompt: "Find open marketing manager roles in Bangalore posted in the last 7 days. Include company, role title, location and salary range.",
  },
  {
    icon: Building2,
    title: "Market scan",
    why: "Map competitors or partners in a sector + city",
    prompt: "Collect information on mid-size fintech companies in Mumbai, including website, industry and contact email.",
  },
  {
    icon: Rocket,
    title: "Investor mapping",
    why: "Build a target list for fundraising outreach",
    prompt: "Find early-stage investors focused on climate tech, with website, location and contact information.",
  },
];

const OUTCOMES = [
  { icon: ShieldCheck, title: "Trust every row", desc: "Each record links to its verified source. No black-box data." },
  { icon: Mail, title: "Act immediately", desc: "Outreach lists with emails, sites & locations — ready to contact." },
  { icon: Download, title: "Take it anywhere", desc: "Export clean CSV/JSON for sheets, CRMs or pitch decks." },
];

export default function NewTaskPage() {
  const [prompt, setPrompt] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const submitPrompt = useAppStore((s) => s.submitPrompt);
  const router = useRouter();

  const handleSubmit = async (value?: string) => {
    const finalPrompt = (value ?? prompt).trim();
    if (!finalPrompt) return;
    setSubmitting(true);
    try {
      const id = await submitPrompt(finalPrompt);
      router.push(`/tasks/${id}`);
    } catch {
      setSubmitting(false);
      toast.error("Could not start the request. Please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#6d5bfa,#17b6d4)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">What business question are you answering?</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Ask the way you&apos;d brief a colleague. Name the columns you want and DataPilot will
          build them — then verify every record against its source.
        </p>
      </div>

      <Card className="p-5">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Which Pune tech companies could sponsor our college fest? I need websites and contact emails for outreach."
          className="min-h-32 resize-none border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
          }}
        />
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted">
            Ask for these columns: company name · website · industry · location · contact email · phone
          </p>
          <Button variant="gradient" disabled={!prompt.trim() || submitting} onClick={() => handleSubmit()}>
            Build my dataset <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OUTCOMES.map((o) => (
          <div key={o.title} className="rounded-xl border border-border bg-surface/50 p-4">
            <o.icon className="h-4 w-4 text-success" />
            <p className="mt-2 text-sm font-semibold text-foreground">{o.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{o.desc}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Start from a proven question</p>
        <p className="mb-3 text-[11px] text-muted-2">Each one maps to a real business outcome — pick the closest to your need.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EXAMPLES.map((ex, i) => (
            <motion.button
              key={ex.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSubmit(ex.prompt)}
              className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-surface/50 p-4 text-left transition-colors hover:border-border-strong hover:bg-surface/90"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2/70 text-primary">
                <ex.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground">{ex.title}</span>
              <span className="text-xs text-secondary">{ex.why}</span>
              <span className="line-clamp-2 text-[11px] text-muted-2">{ex.prompt}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
