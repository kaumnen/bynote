import type { CaseState, CreateCaseInput, Section } from "./schemas";

export type CaseKind = CreateCaseInput["kind"];

export const TEMPLATE_GROUPS = [
  {
    id: "work",
    label: "Work",
    kinds: ["plan", "campaign", "meeting", "custom"],
  },
  {
    id: "engineering",
    label: "Engineering",
    kinds: ["incident", "bug", "feature"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  kinds: readonly CaseKind[];
}>;

const kindLabels: Record<CaseKind, string> = {
  plan: "Plan",
  campaign: "Campaign",
  meeting: "Meeting",
  incident: "Incident",
  bug: "Bug",
  feature: "Feature",
  custom: "Blank",
};

export function kindLabel(kind: CaseKind) {
  return kindLabels[kind];
}

export function kindUsesSeverity(kind: CaseKind) {
  return kind === "incident" || kind === "bug";
}

export function defaultSeverityFor(kind: CaseKind): CreateCaseInput["severity"] {
  return kindUsesSeverity(kind) ? "high" : "medium";
}

const fieldCopy: Record<CaseKind, { title: string; brief: string }> = {
  plan: {
    title: "Q3 partner rollout",
    brief: "What are you working toward?",
  },
  campaign: {
    title: "Spring launch in APAC",
    brief: "Who is this for, and what should they do?",
  },
  meeting: {
    title: "Weekly GTM standup",
    brief: "What is this conversation for?",
  },
  incident: {
    title: "Checkout errors after release",
    brief: "What broke, and who is affected?",
  },
  bug: {
    title: "Search skips page two",
    brief: "What happens, and how do you reproduce it?",
  },
  feature: {
    title: "Export notes as a file",
    brief: "What should this do, and for whom?",
  },
  custom: {
    title: "Untitled notebook",
    brief: "What is this notebook for?",
  },
};

export function createFieldCopy(kind: CaseKind) {
  return fieldCopy[kind];
}

export function statusOptions(kind: CaseKind): {
  value: CaseState["status"];
  label: string;
}[] {
  if (kindUsesSeverity(kind)) {
    return [
      { value: "open", label: "Open" },
      { value: "investigating", label: "Investigating" },
      { value: "monitoring", label: "Monitoring" },
      { value: "resolved", label: "Resolved" },
    ];
  }

  return [
    { value: "open", label: "Open" },
    { value: "investigating", label: "In progress" },
    { value: "monitoring", label: "Paused" },
    { value: "resolved", label: "Done" },
  ];
}

export function severityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const SECTION_PALETTE = [
  {
    type: "note" as const,
    label: "Note",
    hint: "A freeform written block",
  },
  {
    type: "timeline" as const,
    label: "Timeline",
    hint: "Updates, findings, and status in order",
  },
  {
    type: "findings" as const,
    label: "Findings",
    hint: "Verified facts",
  },
  {
    type: "hypotheses" as const,
    label: "Hypotheses",
    hint: "Possible explanations",
  },
  {
    type: "tasks" as const,
    label: "Tasks",
    hint: "Work to do",
  },
  {
    type: "checklist" as const,
    label: "Checklist",
    hint: "Simple yes/no items",
  },
  {
    type: "decisions" as const,
    label: "Decisions",
    hint: "Calls and resolutions",
  },
];

export function sectionCopy(type: Section["type"]) {
  const copy = SECTION_PALETTE.find((item) => item.type === type);
  if (!copy) {
    throw new Error(`Unknown section type ${type}`);
  }
  return copy;
}

export function describeSection(section: Pick<Section, "id" | "type" | "title">) {
  const copy = sectionCopy(section.type);
  return {
    id: section.id,
    type: section.type,
    typeLabel: copy.label,
    hint: copy.hint,
    title: section.title,
  };
}

type SectionSeed = Pick<Section, "type" | "title">;

const templates: Record<CreateCaseInput["kind"], SectionSeed[]> = {
  plan: [
    { type: "note", title: "Goal" },
    { type: "note", title: "Notes" },
    { type: "tasks", title: "Tasks" },
    { type: "decisions", title: "Decisions" },
  ],
  campaign: [
    { type: "note", title: "Audience" },
    { type: "note", title: "Messaging" },
    { type: "checklist", title: "Channels" },
    { type: "tasks", title: "Tasks" },
    { type: "decisions", title: "Decisions" },
  ],
  meeting: [
    { type: "checklist", title: "Agenda" },
    { type: "note", title: "Notes" },
    { type: "decisions", title: "Decisions" },
    { type: "tasks", title: "Tasks" },
  ],
  incident: [
    { type: "timeline", title: "Workstream" },
    { type: "hypotheses", title: "Hypotheses" },
    { type: "tasks", title: "Tasks" },
    { type: "decisions", title: "Resolution" },
  ],
  bug: [
    { type: "note", title: "Repro" },
    { type: "note", title: "Expected / actual" },
    { type: "findings", title: "Findings" },
    { type: "tasks", title: "Tasks" },
  ],
  feature: [
    { type: "note", title: "Goal" },
    { type: "decisions", title: "Spec and decisions" },
    { type: "tasks", title: "Tasks" },
  ],
  custom: [],
};

export function sectionsForTemplate(
  kind: CreateCaseInput["kind"],
  nextId: () => string,
): Section[] {
  return templates[kind].map((section) => ({
    id: nextId(),
    type: section.type,
    title: section.title,
  }));
}

export function emptyNotebookLists(): Pick<
  CaseState,
  "entries" | "hypotheses" | "tasks" | "notes" | "checklists" | "decisions"
> {
  return {
    entries: [],
    hypotheses: [],
    tasks: [],
    notes: [],
    checklists: [],
    decisions: [],
  };
}
