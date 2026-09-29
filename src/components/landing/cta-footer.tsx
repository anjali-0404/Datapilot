"use client";

import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaFooter() {
  return (
    <>
      <section className="relative overflow-hidden py-28">
        <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
        <div className="relative mx-auto max-w-3xl px-6 text-center md:px-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Every record traces back to a real source.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            No black-box answers. Ask your question, watch the pipeline run, then open any row
            to see the organization and its official website — data you can defend in front of
            a client, a committee or a judge.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" variant="gradient" asChild>
              <Link href="/tasks/new">
                Ask your first question <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-10">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[linear-gradient(135deg,#6d5bfa,#17b6d4)]">
              <Radar className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-muted">DataPilot AI</span>
          </div>
          <p className="text-xs text-muted-2">Reasoning by Grok 4.1 via OpenRouter · every record traceable to a verified source</p>
        </div>
      </footer>
    </>
  );
}
