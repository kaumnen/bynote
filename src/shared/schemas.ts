import { z } from "zod";

export const CaseKindSchema = z.enum([
  "plan",
  "campaign",
  "meeting",
  "incident",
  "bug",
  "feature",
  "custom",
]);
export const ENTRY_BODY_MAX = 4_000;
export const NOTE_BODY_MAX = 8_000;
export const NOTE_REVISION_MAX = 20;
export const HYPOTHESIS_DETAIL_MAX = 4_000;
export const CaseStatusSchema = z.enum([
  "open",
  "investigating",
  "monitoring",
  "resolved",
]);
export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export const TaskStatusSchema = z.enum(["open", "doing", "done"]);
export const ActionSourceSchema = z.enum(["human-ui", "webmcp"]);
export const SectionTypeSchema = z.enum([
  "note",
  "timeline",
  "findings",
  "hypotheses",
  "tasks",
  "checklist",
  "decisions",
]);

export const ActorSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(48),
    kind: z.enum(["human", "agent"]),
  })
  .strict();

export const CreateCaseInputSchema = z
  .object({
    kind: CaseKindSchema.default("plan"),
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().max(600).default(""),
    severity: SeveritySchema.default("high"),
    creatorName: z.string().trim().min(1).max(48).default("Guest"),
    demo: z.boolean().default(false),
  })
  .strict();

export const SectionSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: SectionTypeSchema,
    title: z.string().trim().min(1).max(80),
  })
  .strict();

export const CaseEntrySchema = z
  .object({
    id: z.string(),
    kind: z.enum([
      "update",
      "finding",
      "resolution-proposal",
      "status-change",
      "task-change",
    ]),
    body: z.string(),
    author: ActorSchema,
    source: ActionSourceSchema,
    createdAt: z.string(),
    acceptedAt: z.string().optional(),
    acceptedBy: ActorSchema.optional(),
  })
  .strict();

export const HypothesisSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    detail: z.string(),
    confidence: ConfidenceSchema,
    status: z.enum(["active", "supported", "rejected"]),
    author: ActorSchema,
    source: ActionSourceSchema,
    createdAt: z.string(),
  })
  .strict();

export const CaseTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: TaskStatusSchema,
    assignee: z.string().optional(),
    author: ActorSchema,
    source: ActionSourceSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const ParticipantSchema = z
  .object({
    actor: ActorSchema,
    lastSeenAt: z.string(),
  })
  .strict();

export const NoteRevisionSchema = z
  .object({
    body: z.string(),
    author: ActorSchema,
    source: ActionSourceSchema,
    createdAt: z.string(),
  })
  .strict();

export const NoteItemSchema = z
  .object({
    id: z.string(),
    sectionId: z.string(),
    body: z.string(),
    author: ActorSchema,
    source: ActionSourceSchema,
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    updatedBy: ActorSchema.optional(),
    revisions: z.array(NoteRevisionSchema).max(NOTE_REVISION_MAX).optional(),
  })
  .strict();

export const ChecklistItemSchema = z
  .object({
    id: z.string(),
    sectionId: z.string(),
    title: z.string(),
    done: z.boolean(),
    author: ActorSchema,
    source: ActionSourceSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const CaseStateSchema = z
  .object({
    id: z.string(),
    kind: CaseKindSchema,
    title: z.string(),
    summary: z.string(),
    severity: SeveritySchema,
    status: CaseStatusSchema,
    createdAt: z.string(),
    revision: z.number().int().nonnegative(),
    sections: z.array(SectionSchema),
    entries: z.array(CaseEntrySchema),
    hypotheses: z.array(HypothesisSchema),
    tasks: z.array(CaseTaskSchema),
    notes: z.array(NoteItemSchema),
    checklists: z.array(ChecklistItemSchema),
    decisions: z.array(NoteItemSchema),
    participants: z.array(ParticipantSchema),
  })
  .strict();

export const NOTEBOOK_FILE_FORMAT = "bynote.notebook.v1" as const;
export const LEGACY_NOTEBOOK_FILE_FORMAT = "byline.notebook.v1" as const;

export const NotebookFileSchema = z
  .object({
    format: z.enum([NOTEBOOK_FILE_FORMAT, LEGACY_NOTEBOOK_FILE_FORMAT]),
    notebook: CaseStateSchema,
  })
  .strict();

const actionBase = {
  actor: ActorSchema,
  source: ActionSourceSchema,
};

export const CaseActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("join"),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("post_update"),
      body: z.string().trim().min(1).max(ENTRY_BODY_MAX),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_finding"),
      body: z.string().trim().min(1).max(ENTRY_BODY_MAX),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_hypothesis"),
      title: z.string().trim().min(1).max(180),
      detail: z.string().trim().max(HYPOTHESIS_DETAIL_MAX).default(""),
      confidence: ConfidenceSchema.default("medium"),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("create_task"),
      title: z.string().trim().min(1).max(240),
      assignee: z.string().trim().max(48).optional(),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("update_task"),
      taskId: z.string().min(1).max(100),
      status: TaskStatusSchema,
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("propose_resolution"),
      body: z.string().trim().min(1).max(ENTRY_BODY_MAX),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("accept_resolution"),
      entryId: z.string().min(1).max(100),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("set_status"),
      status: CaseStatusSchema,
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_note"),
      sectionId: z.string().min(1).max(100),
      body: z.string().trim().min(1).max(NOTE_BODY_MAX),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("revise_note"),
      noteId: z.string().min(1).max(100),
      body: z.string().trim().min(1).max(NOTE_BODY_MAX),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("toggle_note_task"),
      noteId: z.string().min(1).max(100),
      taskIndex: z.number().int().nonnegative().max(200),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_decision"),
      sectionId: z.string().min(1).max(100),
      body: z.string().trim().min(1).max(NOTE_BODY_MAX),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_checklist_item"),
      sectionId: z.string().min(1).max(100),
      title: z.string().trim().min(1).max(240),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("toggle_checklist_item"),
      itemId: z.string().min(1).max(100),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_section"),
      sectionType: SectionTypeSchema,
      title: z.string().trim().min(1).max(80),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("set_sections"),
      sections: z
        .array(
          z
            .object({
              type: SectionTypeSchema,
              title: z.string().trim().min(1).max(80),
            })
            .strict(),
        )
        .min(0)
        .max(20),
      ...actionBase,
    })
    .strict(),
]);

export const toolInputSchemas = {
  readCase: z.object({}).strict(),
  joinAsAgent: z
    .object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(48)
        .describe("Display name for the agent in this notebook."),
    })
    .strict(),
  addFinding: z
    .object({
      body: z
        .string()
        .trim()
        .min(1)
        .max(ENTRY_BODY_MAX)
        .describe("Verified evidence or an observed fact."),
    })
    .strict(),
  addHypothesis: z
    .object({
      title: z
        .string()
        .trim()
        .min(1)
        .max(180)
        .describe("Short name for the possible explanation."),
      detail: z
        .string()
        .trim()
        .max(HYPOTHESIS_DETAIL_MAX)
        .default("")
        .describe("Supporting detail for the explanation."),
      confidence: ConfidenceSchema.default("medium").describe(
        "Confidence in the explanation: low, medium, or high.",
      ),
    })
    .strict(),
  createTask: z
    .object({
      title: z
        .string()
        .trim()
        .min(1)
        .max(240)
        .describe("What the task is."),
      assignee: z
        .string()
        .trim()
        .max(48)
        .optional()
        .describe("Optional person the task is assigned to."),
    })
    .strict(),
  updateTask: z
    .object({
      taskId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of an existing task in this notebook."),
      status: TaskStatusSchema.describe(
        "New task status: open, doing, or done.",
      ),
    })
    .strict(),
  postUpdate: z
    .object({
      body: z
        .string()
        .trim()
        .min(1)
        .max(ENTRY_BODY_MAX)
        .describe("Progress update. Markdown and mermaid diagrams are rendered."),
    })
    .strict(),
  proposeResolution: z
    .object({
      body: z
        .string()
        .trim()
        .min(1)
        .max(ENTRY_BODY_MAX)
        .describe("Proposed resolution for a person to accept or reject."),
    })
    .strict(),
  addNote: z
    .object({
      sectionId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a section whose type is note."),
      body: z
        .string()
        .trim()
        .min(1)
        .max(NOTE_BODY_MAX)
        .describe("Markdown to append. Mermaid diagrams in fenced mermaid blocks are rendered."),
    })
    .strict(),
  reviseNote: z
    .object({
      noteId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a sent note in this notebook."),
      body: z
        .string()
        .trim()
        .min(1)
        .max(NOTE_BODY_MAX)
        .describe("Replacement markdown for the note."),
    })
    .strict(),
  toggleNoteTask: z
    .object({
      noteId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a sent note that contains a markdown task list."),
      taskIndex: z
        .number()
        .int()
        .nonnegative()
        .max(200)
        .describe("0-based checkbox in that note, skipping fenced code."),
    })
    .strict(),
  addDecision: z
    .object({
      sectionId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a section whose type is decisions."),
      body: z
        .string()
        .trim()
        .min(1)
        .max(NOTE_BODY_MAX)
        .describe("Decision text. Markdown and mermaid diagrams are rendered."),
    })
    .strict(),
  addChecklistItem: z
    .object({
      sectionId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a section whose type is checklist."),
      title: z
        .string()
        .trim()
        .min(1)
        .max(240)
        .describe("Checklist item text."),
    })
    .strict(),
  toggleChecklistItem: z
    .object({
      itemId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a checklist item in this notebook."),
    })
    .strict(),
  addSection: z
    .object({
      type: SectionTypeSchema.describe(
        "Section type: note, timeline, findings, hypotheses, tasks, checklist, or decisions.",
      ),
      title: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe("Label shown on the section."),
    })
    .strict(),
  setSections: z
    .object({
      sections: z
        .array(
          z
            .object({
              type: SectionTypeSchema.describe(
                "Section type: note, timeline, findings, hypotheses, tasks, checklist, or decisions.",
              ),
              title: z
                .string()
                .trim()
                .min(1)
                .max(80)
                .describe("Label shown on the section."),
            })
            .strict(),
        )
        .max(20)
        .describe("Ordered sections that replace the current layout."),
    })
    .strict(),
  listNotebooks: z.object({}).strict(),
  setNotebook: z
    .object({
      notebookId: z
        .string()
        .min(1)
        .max(100)
        .describe("Id of a notebook stored in this browser."),
    })
    .strict(),
  createNotebook: z
    .object({
      kind: CaseKindSchema.default("custom").describe(
        "Notebook type: plan, campaign, meeting, incident, bug, feature, or custom.",
      ),
      title: z
        .string()
        .trim()
        .min(3)
        .max(120)
        .describe("Notebook title, 3 to 120 characters."),
      summary: z
        .string()
        .trim()
        .max(600)
        .default("")
        .describe("Optional short summary, up to 600 characters."),
      severity: SeveritySchema.optional().describe(
        "Severity for incident and bug notebooks: low, medium, high, or critical.",
      ),
    })
    .strict(),
} as const;

export type Actor = z.infer<typeof ActorSchema>;
export type CaseAction = z.infer<typeof CaseActionSchema>;
export type CaseEntry = z.infer<typeof CaseEntrySchema>;
export type CaseState = z.infer<typeof CaseStateSchema>;
export type CaseTask = z.infer<typeof CaseTaskSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type NoteItem = z.infer<typeof NoteItemSchema>;
export type NoteRevision = z.infer<typeof NoteRevisionSchema>;
export type NotebookFile = z.infer<typeof NotebookFileSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = z.infer<typeof SectionTypeSchema>;
