import type { Connector, ExtractedIntent, StageId, WorkflowStage } from "@/types";

export const CONNECTORS: Connector[] = [
  { id: "web-search", name: "Curated Web Index", type: "web", status: "active", recordsContributed: 0, reliability: 92, icon: "globe" },
  { id: "company-registry", name: "Company Directory", type: "api", status: "active", recordsContributed: 0, reliability: 97, icon: "building" },
  { id: "news-feed", name: "Ecosystem Feed", type: "api", status: "active", recordsContributed: 0, reliability: 88, icon: "newspaper" },
  { id: "social-directory", name: "Public Directory", type: "web", status: "active", recordsContributed: 0, reliability: 79, icon: "users" },
  { id: "csr-database", name: "CSR / Sustainability DB", type: "database", status: "active", recordsContributed: 0, reliability: 94, icon: "leaf" },
  { id: "job-boards", name: "Startup & Tech Index", type: "api", status: "active", recordsContributed: 0, reliability: 90, icon: "briefcase" },
];

export const STAGE_META: Record<StageId, { label: string; description: string }> = {
  interpret: { label: "Interpret", description: "Understanding what you're looking for" },
  plan: { label: "Plan", description: "Choosing which sources this question needs" },
  collect: { label: "Collect", description: "Gathering matching organizations" },
  validate: { label: "Validate", description: "Checking links, emails and completeness" },
  deduplicate: { label: "Deduplicate", description: "Merging duplicate organizations" },
  deliver: { label: "Deliver", description: "Building your dataset" },
};

export function buildInitialStages(): WorkflowStage[] {
  return (Object.keys(STAGE_META) as StageId[]).map((id) => ({
    id,
    label: STAGE_META[id].label,
    description: STAGE_META[id].description,
    status: "pending",
    progress: 0,
    logs: [],
  }));
}

const LOCATIONS = ["pune", "bangalore", "mumbai", "delhi", "hyderabad", "chennai", "gurugram", "ahmedabad", "san francisco", "new york", "london", "berlin"];

function detectLocation(prompt: string): string | undefined {
  const lower = prompt.toLowerCase();
  return LOCATIONS.find((loc) => lower.includes(loc));
}

function detectEntityType(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("sponsor")) return "Sponsor Lead";
  if (lower.includes("job") || lower.includes("hiring") || lower.includes("role")) return "Job Opening";
  if (lower.includes("investor") || lower.includes("vc")) return "Investor";
  if (lower.includes("lead") || lower.includes("sales")) return "Sales Lead";
  if (lower.includes("event")) return "Event";
  return "Organization";
}

function detectFields(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const fields = new Set<string>(["Name"]);
  if (lower.includes("website")) fields.add("Website");
  if (lower.includes("industry")) fields.add("Industry");
  if (lower.includes("location")) fields.add("Location");
  if (lower.includes("contact")) fields.add("Contact Email");
  if (lower.includes("phone")) fields.add("Phone");
  if (lower.includes("company")) fields.add("Company");
  if (lower.includes("salary") || lower.includes("compensation")) fields.add("Salary Range");
  if (lower.includes("role") || lower.includes("title") || lower.includes("job")) fields.add("Role Title");
  // sensible defaults if the prompt didn't spell fields out
  if (fields.size < 4) {
    ["Website", "Industry", "Location", "Contact Email"].forEach((f) => fields.add(f));
  }
  return Array.from(fields);
}

export function extractIntent(prompt: string): ExtractedIntent {
  const location = detectLocation(prompt);
  const entityType = detectEntityType(prompt);
  const fields = detectFields(prompt);
  const constraints: string[] = [];
  if (location) constraints.push(`Location contains "${location}"`);
  if (prompt.toLowerCase().includes("sustain")) constraints.push("Sector relates to sustainability / environment");
  if (prompt.toLowerCase().includes("week")) constraints.push("Posted within the last 7 days");
  if (constraints.length === 0) constraints.push("No hard filters detected — broad collection");

  return {
    goal: prompt.trim(),
    entityType,
    location: location ? location[0].toUpperCase() + location.slice(1) : undefined,
    fields,
    constraints,
    confidence: intentConfidence(!!location, fields.length, entityType !== "Organization"),
  };
}

// What each source layer actually holds. Shown on the Sources page so the
// list is self-explanatory rather than six mysterious connector names.
export const SOURCE_LAYER_NOTES: Record<string, string> = {
  "web-search": "Official websites of energy, manufacturing and infrastructure majors — company site, industry and HQ.",
  "company-registry": "Registered company profiles: fintech, software and industrial firms with contact details.",
  "news-feed": "Climate and corporate news coverage used to surface sponsor- and announcement-related orgs.",
  "social-directory": "Public profiles of consumer-tech and mobility startups.",
  "csr-database": "CSR arms, foundations and research bodies working on sustainability and environment.",
  "job-boards": "Tech employers indexed for hiring questions (roles, teams, locations).",
};

// Planned per question by src/lib/collect.ts planSourcesForIntent(): the layers
// are derived from the organizations that match the question, so the plan and
// the delivered dataset always agree.

// Confidence for intent: deterministic, from extraction evidence (no random).
export function intentConfidence(locFound: boolean, fieldsCount: number, entityCertain: boolean): number {
  let c = 0.72;
  if (locFound) c += 0.08;
  if (fieldsCount >= 4) c += 0.06;
  if (entityCertain) c += 0.06;
  return Math.round(Math.min(0.97, c) * 100) / 100;
}

export const SAMPLE_PROMPT =
  "Find sustainability-focused sponsor leads for a college technology festival in Pune. Include company name, website, industry, location and contact information.";
