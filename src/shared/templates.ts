import type { CaseState, CreateCaseInput, Section } from "./schemas";

export type CaseKind = CreateCaseInput["kind"];

export function kindLabel(kind: CaseKind) {
  if (kind === "incident") {
    return "Incident";
  }
  if (kind === "bug") {
    return "Bug";
  }
  if (kind === "feature") {
    return "Feature";
  }
  return "Custom";
}

export function kindUsesSeverity(kind: CaseKind) {
  return kind === "incident" || kind === "bug";
}

export function defaultSeverityFor(kind: CaseKind): CreateCaseInput["severity"] {
  return kindUsesSeverity(kind) ? "high" : "medium";
}

export function createFieldCopy(kind: CaseKind) {
  if (kind === "incident") {
    return {
      title: "Checkout errors after release",
      brief: "What broke, and who is affected?",
    };
  }
  if (kind === "bug") {
    return {
      title: "Search skips page two",
      brief: "What happens, and how do you reproduce it?",
    };
  }
  if (kind === "feature") {
    return {
      title: "Export notes as a file",
      brief: "What should this do, and for whom?",
    };
  }
  return {
    title: "Untitled notebook",
    brief: "What is this notebook for?",
  };
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

type SectionSeed = Pick<Section, "type" | "title">;

const templates: Record<CreateCaseInput["kind"], SectionSeed[]> = {
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
