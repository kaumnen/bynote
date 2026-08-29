import type { CreateCaseInput } from "./schemas";
import { kindLabel } from "./templates";

export const DEMO_GROUPS = [
  {
    label: "Work",
    kinds: ["plan", "campaign", "meeting"],
  },
  {
    label: "Engineering",
    kinds: ["incident", "bug", "feature"],
  },
] as const;

export const DEMO_KINDS = DEMO_GROUPS.flatMap(({ kinds }) => kinds);

export type DemoKind = (typeof DEMO_KINDS)[number];

export const DEMO_DEFAULTS: Record<
  DemoKind,
  {
    title: string;
    summary: string;
    severity: CreateCaseInput["severity"];
  }
> = {
  plan: {
    title: "Q3 partner rollout",
    summary:
      "One page for the goal, the dates, and the work to land it.",
    severity: "medium",
  },
  campaign: {
    title: "Spring launch in APAC",
    summary:
      "Sales and marketing need one page for audience, message, and the work to ship it.",
    severity: "medium",
  },
  meeting: {
    title: "Weekly GTM standup",
    summary: "Capture what was said, what was decided, and what happens next.",
    severity: "medium",
  },
  incident: {
    title: "Checkout errors after release 214",
    summary:
      "Checkout requests are returning errors in two regions. The issue started soon after a release.",
    severity: "critical",
  },
  bug: {
    title: "Search results skip page two",
    summary:
      "Paging from page 1 to page 2 shows the same ten results. It started after the list query change.",
    severity: "high",
  },
  feature: {
    title: "Export notes as a file",
    summary:
      "People need to take a notebook to another browser without a shared server.",
    severity: "medium",
  },
};

export function isDemoKind(value: string): value is DemoKind {
  return (DEMO_KINDS as readonly string[]).includes(value);
}

export function demoLabel(kind: DemoKind) {
  return kindLabel(kind);
}

export function resolveDemoTitle(kind: DemoKind, title = "") {
  const trimmed = title.trim();
  return trimmed || DEMO_DEFAULTS[kind].title;
}

export function isDefaultDemoTitle(kind: DemoKind, title: string) {
  return title.trim() === DEMO_DEFAULTS[kind].title;
}
