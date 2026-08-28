import { z } from "zod";

import {
  toolInputSchemas,
  type Actor,
  type CaseAction,
  type CaseState,
} from "../../src/shared/schemas";
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

function stateSummary(state: CaseState) {
  return {
    id: state.id,
    kind: state.kind,
    title: state.title,
    summary: state.summary,
    severity: state.severity,
    status: state.status,
    revision: state.revision,
    entries: state.entries,
    hypotheses: state.hypotheses,
    tasks: state.tasks,
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
  const agentNameKey = `byline.agent-name.${getState().id}`;
  let agentName = storage?.getItem(agentNameKey) || "Browser agent";

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
      name: "read_case",
      description:
        "Read the complete active Byline case, including findings, hypotheses, tasks, status, and participants. Call this before changing the case.",
      inputSchema: schema(toolInputSchemas.readCase),
      execute() {
        return result("Current case", stateSummary(getState()));
      },
    },
    {
      name: "join_as_agent",
      description:
        "Join the active case with an agent name. Call this before adding work so people can identify the agent.",
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
      name: "add_finding",
      description:
        "Add verified evidence or an observed fact to the active case. Do not use this for an untested explanation.",
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
      description:
        "Add a possible explanation to the active case with supporting detail and a confidence level.",
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
      description:
        "Create a specific investigation or response task in the active case.",
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
      description:
        "Change an existing task to open, doing, or done. Use a task ID returned by read_case or create_task.",
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
      description:
        "Post a concise progress update to the active case timeline.",
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
      description:
        "Propose a resolution for human review. This does not resolve the case. A person must accept the proposal in Byline.",
      inputSchema: schema(toolInputSchemas.proposeResolution),
      async execute(input) {
        const parsed = toolInputSchemas.proposeResolution.parse(input);
        const state = await submit(
          agentAction({ type: "propose_resolution", body: parsed.body }),
        );
        return result("Resolution proposed", { revision: state.revision });
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
