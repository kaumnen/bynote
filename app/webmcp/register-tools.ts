import { z } from "zod";

import {
  toolInputSchemas,
  type Actor,
  type CaseAction,
  type CaseState,
} from "../../src/shared/schemas";
import { describeSection } from "../../src/shared/templates";
import type {
  ModelContext,
  WebMcpTool,
  WebMcpToolResult,
} from "./types";

type RegisterCaseToolsOptions = {
  modelContext: ModelContext;
  baseActor: Actor;
  getState: () => CaseState;
  submit: (action: CaseAction) => Promise<CaseState>;
  storage?: Pick<Storage, "getItem" | "setItem">;
};

function result(label: string, data: unknown): WebMcpToolResult {
  return {
    content: [{ type: "text", text: `${label}\n${JSON.stringify(data)}` }],
    structuredContent: data,
  };
}

function publicNote(item: CaseState["notes"][number]) {
  const { revisions, ...rest } = item;
  void revisions;
  return rest;
}

function stateSummary(state: CaseState) {
  return {
    id: state.id,
    kind: state.kind,
    title: state.title,
    summary: state.summary,
    severity: state.severity,
    status: state.status,
    revision: state.revision,
    sections: state.sections.map(describeSection),
    entries: state.entries,
    hypotheses: state.hypotheses,
    tasks: state.tasks,
    notes: state.notes.map(publicNote),
    checklists: state.checklists,
    decisions: state.decisions,
    participants: state.participants,
  };
}

function schema(input: z.ZodType) {
  return z.toJSONSchema(input) as Record<string, unknown>;
}

export function registerCaseTools({
  modelContext,
  baseActor,
  getState,
  submit,
  storage,
}: RegisterCaseToolsOptions) {
  const controller = new AbortController();
  const agentNameKey = `bynote.agent-name.${getState().id}`;
  const legacyAgentNameKey = `byline.agent-name.${getState().id}`;
  let agentName =
    storage?.getItem(agentNameKey) ||
    storage?.getItem(legacyAgentNameKey) ||
    "Agent";

  const agentActor = (): Actor => ({
    id: `${baseActor.id}:agent`,
    name: agentName,
    kind: "agent",
  });

  const agentAction = <T extends Omit<CaseAction, "actor" | "source">>(
    action: T,
  ) =>
    ({
      ...action,
      actor: agentActor(),
      source: "webmcp",
    }) as CaseAction;

  const tools: WebMcpTool[] = [
    {
      name: "read_notebook",
      title: "Read notebook",
      description:
        "Reads the notebook open in this tab. Returns id, kind, title, summary, severity, status, revision, sections (type, typeLabel, hint, title), entries, hypotheses, tasks, notes, checklists, decisions, and participants.",
      inputSchema: schema(toolInputSchemas.readCase),
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute() {
        return result("Current notebook", stateSummary(getState()));
      },
    },
    {
      name: "join_agent",
      title: "Join agent",
      description:
        "Joins the active notebook under an agent name. Returns the agent identity and notebook revision.",
      inputSchema: schema(toolInputSchemas.joinAsAgent),
      async execute(input) {
        const parsed = toolInputSchemas.joinAsAgent.parse(input);
        agentName = parsed.name;
        storage?.setItem(agentNameKey, agentName);
        const state = await submit(
          agentAction({
            type: "join",
          }),
        );
        return result("Agent joined", {
          agent: agentActor(),
          revision: state.revision,
        });
      },
    },
    {
      name: "set_sections",
      title: "Set sections",
      description:
        "Replaces the notebook layout with an ordered list of sections. Each section has a type of note, timeline, findings, hypotheses, tasks, checklist, or decisions, and a title label. Returns the updated sections and revision.",
      inputSchema: schema(toolInputSchemas.setSections),
      async execute(input) {
        const parsed = toolInputSchemas.setSections.parse(input);
        const state = await submit(
          agentAction({ type: "set_sections", sections: parsed.sections }),
        );
        return result("Sections updated", {
          sections: state.sections.map(describeSection),
          revision: state.revision,
        });
      },
    },
    {
      name: "add_section",
      title: "Add section",
      description:
        "Appends one section. Type is note, timeline, findings, hypotheses, tasks, checklist, or decisions. Title is a label. Returns the new section and revision.",
      inputSchema: schema(toolInputSchemas.addSection),
      async execute(input) {
        const parsed = toolInputSchemas.addSection.parse(input);
        const state = await submit(
          agentAction({
            type: "add_section",
            sectionType: parsed.type,
            title: parsed.title,
          }),
        );
        const section = state.sections.at(-1);
        return result("Section added", {
          section: section ? describeSection(section) : null,
          revision: state.revision,
        });
      },
    },
    {
      name: "add_finding",
      title: "Add finding",
      description:
        "Adds verified evidence or an observed fact. Returns the notebook revision.",
      inputSchema: schema(toolInputSchemas.addFinding),
      async execute(input) {
        const parsed = toolInputSchemas.addFinding.parse(input);
        const state = await submit(
          agentAction({ type: "add_finding", body: parsed.body }),
        );
        return result("Finding added", { revision: state.revision });
      },
    },
    {
      name: "add_hypothesis",
      title: "Add hypothesis",
      description:
        "Adds a possible explanation with supporting detail and a confidence level. Returns the notebook revision.",
      inputSchema: schema(toolInputSchemas.addHypothesis),
      async execute(input) {
        const parsed = toolInputSchemas.addHypothesis.parse(input);
        const state = await submit(
          agentAction({ type: "add_hypothesis", ...parsed }),
        );
        return result("Hypothesis added", { revision: state.revision });
      },
    },
    {
      name: "create_task",
      title: "Create task",
      description:
        "Creates a task in the notebook. Returns the new task and revision.",
      inputSchema: schema(toolInputSchemas.createTask),
      async execute(input) {
        const parsed = toolInputSchemas.createTask.parse(input);
        const state = await submit(
          agentAction({ type: "create_task", ...parsed }),
        );
        const created = state.tasks.at(-1);
        return result("Task created", {
          task: created,
          revision: state.revision,
        });
      },
    },
    {
      name: "update_task",
      title: "Update task",
      description:
        "Changes an existing task to open, doing, or done. Returns the updated task and revision.",
      inputSchema: schema(toolInputSchemas.updateTask),
      async execute(input) {
        const parsed = toolInputSchemas.updateTask.parse(input);
        const state = await submit(
          agentAction({ type: "update_task", ...parsed }),
        );
        return result("Task updated", {
          task: state.tasks.find(({ id }) => id === parsed.taskId),
          revision: state.revision,
        });
      },
    },
    {
      name: "post_update",
      title: "Post update",
      description:
        "Posts a progress update to the timeline. Markdown and mermaid diagrams are rendered. Returns the notebook revision.",
      inputSchema: schema(toolInputSchemas.postUpdate),
      async execute(input) {
        const parsed = toolInputSchemas.postUpdate.parse(input);
        const state = await submit(
          agentAction({ type: "post_update", body: parsed.body }),
        );
        return result("Update posted", { revision: state.revision });
      },
    },
    {
      name: "propose_resolution",
      title: "Propose resolution",
      description:
        "Proposes a resolution for human review. This does not resolve the notebook. Returns the notebook revision.",
      inputSchema: schema(toolInputSchemas.proposeResolution),
      async execute(input) {
        const parsed = toolInputSchemas.proposeResolution.parse(input);
        const state = await submit(
          agentAction({ type: "propose_resolution", body: parsed.body }),
        );
        return result("Resolution proposed", { revision: state.revision });
      },
    },
    {
      name: "add_note",
      title: "Add note",
      description:
        "Appends markdown to a note section. Mermaid diagrams in fenced mermaid code blocks are rendered. Returns the notebook revision.",
      inputSchema: schema(toolInputSchemas.addNote),
      async execute(input) {
        const parsed = toolInputSchemas.addNote.parse(input);
        const state = await submit(
          agentAction({
            type: "add_note",
            sectionId: parsed.sectionId,
            body: parsed.body,
          }),
        );
        return result("Note added", { revision: state.revision });
      },
    },
    {
      name: "revise_note",
      title: "Revise note",
      description:
        "Replaces the body of a sent note in place. History keeps the previous body, who changed it, and when. Returns the updated note and revision.",
      inputSchema: schema(toolInputSchemas.reviseNote),
      async execute(input) {
        const parsed = toolInputSchemas.reviseNote.parse(input);
        const state = await submit(
          agentAction({
            type: "revise_note",
            noteId: parsed.noteId,
            body: parsed.body,
          }),
        );
        const note = state.notes.find(({ id }) => id === parsed.noteId);
        return result("Note revised", {
          note: note ? publicNote(note) : null,
          revision: state.revision,
        });
      },
    },
    {
      name: "toggle_checkbox",
      title: "Toggle checkbox",
      description:
        "Toggles a markdown task list checkbox in a sent note. taskIndex is the 0-based checkbox in that note, skipping fenced code. Returns the updated note and revision.",
      inputSchema: schema(toolInputSchemas.toggleNoteTask),
      async execute(input) {
        const parsed = toolInputSchemas.toggleNoteTask.parse(input);
        const state = await submit(
          agentAction({
            type: "toggle_note_task",
            noteId: parsed.noteId,
            taskIndex: parsed.taskIndex,
          }),
        );
        const note = state.notes.find(({ id }) => id === parsed.noteId);
        return result("Note task updated", {
          note: note ? publicNote(note) : null,
          revision: state.revision,
        });
      },
    },
    {
      name: "add_decision",
      title: "Add decision",
      description:
        "Records a decision in a decisions section. Markdown and mermaid diagrams are rendered. Returns the notebook revision.",
      inputSchema: schema(toolInputSchemas.addDecision),
      async execute(input) {
        const parsed = toolInputSchemas.addDecision.parse(input);
        const state = await submit(
          agentAction({
            type: "add_decision",
            sectionId: parsed.sectionId,
            body: parsed.body,
          }),
        );
        return result("Decision added", { revision: state.revision });
      },
    },
    {
      name: "add_check",
      title: "Add checklist item",
      description:
        "Adds an item to a checklist section. Returns the new item and revision.",
      inputSchema: schema(toolInputSchemas.addChecklistItem),
      async execute(input) {
        const parsed = toolInputSchemas.addChecklistItem.parse(input);
        const state = await submit(
          agentAction({
            type: "add_checklist_item",
            sectionId: parsed.sectionId,
            title: parsed.title,
          }),
        );
        return result("Checklist item added", {
          item: state.checklists.at(-1),
          revision: state.revision,
        });
      },
    },
    {
      name: "toggle_check",
      title: "Toggle checklist item",
      description:
        "Toggles a checklist item done or not done. Returns the updated item and revision.",
      inputSchema: schema(toolInputSchemas.toggleChecklistItem),
      async execute(input) {
        const parsed = toolInputSchemas.toggleChecklistItem.parse(input);
        const state = await submit(
          agentAction({
            type: "toggle_checklist_item",
            itemId: parsed.itemId,
          }),
        );
        return result("Checklist item updated", {
          item: state.checklists.find(({ id }) => id === parsed.itemId),
          revision: state.revision,
        });
      },
    },
  ];

  const ready = Promise.all(
    tools.map((tool) =>
      modelContext.registerTool(tool, { signal: controller.signal }),
    ),
  );

  return {
    ready,
    toolNames: tools.map(({ name }) => name),
    dispose: () => controller.abort(),
  };
}
