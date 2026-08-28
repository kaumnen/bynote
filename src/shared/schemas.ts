import { z } from "zod";

export const CaseKindSchema = z.enum(["bug", "incident"]);
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

export const ActorSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(48),
    kind: z.enum(["human", "agent"]),
  })
  .strict();

export const CreateCaseInputSchema = z
  .object({
    kind: CaseKindSchema.default("incident"),
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().max(600).default(""),
    severity: SeveritySchema.default("high"),
    creatorName: z.string().trim().min(1).max(48).default("Guest"),
    demo: z.boolean().default(false),
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
    entries: z.array(CaseEntrySchema),
    hypotheses: z.array(HypothesisSchema),
    tasks: z.array(CaseTaskSchema),
    participants: z.array(ParticipantSchema),
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
      body: z.string().trim().min(1).max(2_000),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_finding"),
      body: z.string().trim().min(1).max(2_000),
      ...actionBase,
    })
    .strict(),
  z
    .object({
      type: z.literal("add_hypothesis"),
      title: z.string().trim().min(1).max(180),
      detail: z.string().trim().max(1_200).default(""),
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
      body: z.string().trim().min(1).max(2_000),
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
]);

export const toolInputSchemas = {
  readCase: z.object({}).strict(),
  joinAsAgent: z
    .object({
      name: z.string().trim().min(1).max(48),
    })
    .strict(),
  addFinding: z
    .object({
      body: z.string().trim().min(1).max(2_000),
    })
    .strict(),
  addHypothesis: z
    .object({
      title: z.string().trim().min(1).max(180),
      detail: z.string().trim().max(1_200).default(""),
      confidence: ConfidenceSchema.default("medium"),
    })
    .strict(),
  createTask: z
    .object({
      title: z.string().trim().min(1).max(240),
      assignee: z.string().trim().max(48).optional(),
    })
    .strict(),
  updateTask: z
    .object({
      taskId: z.string().min(1).max(100),
      status: TaskStatusSchema,
    })
    .strict(),
  postUpdate: z
    .object({
      body: z.string().trim().min(1).max(2_000),
    })
    .strict(),
  proposeResolution: z
    .object({
      body: z.string().trim().min(1).max(2_000),
    })
    .strict(),
} as const;

export type Actor = z.infer<typeof ActorSchema>;
export type CaseAction = z.infer<typeof CaseActionSchema>;
export type CaseEntry = z.infer<typeof CaseEntrySchema>;
export type CaseState = z.infer<typeof CaseStateSchema>;
export type CaseTask = z.infer<typeof CaseTaskSchema>;
export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
