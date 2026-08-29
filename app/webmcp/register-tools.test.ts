import { describe, expect, it } from "vitest";

import {
  applyCaseAction,
  createCaseState,
} from "../../src/shared/case-state";
import {
  CreateCaseInputSchema,
  type Actor,
  type CaseAction,
} from "../../src/shared/schemas";
import { registerCaseTools } from "./register-tools";
import type { ModelContext, WebMcpTool } from "./types";

describe("WebMCP tools", () => {
  it("registers case tools and attributes agent work", async () => {
    const tools = new Map<string, WebMcpTool>();
    const signals: AbortSignal[] = [];
    const modelContext: ModelContext = {
      async registerTool(tool, options) {
        tools.set(tool.name, tool);
        if (options?.signal) {
          signals.push(options.signal);
        }
      },
    };
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    };
    const baseActor: Actor = {
      id: "human-1",
      name: "Alex",
      kind: "human",
    };
    let current = createCaseState(
      "case-1",
      CreateCaseInputSchema.parse({
        title: "Checkout errors",
        creatorName: "Alex",
      }),
      {
        now: () => "2026-08-28T12:00:00.000Z",
        id: () => crypto.randomUUID(),
      },
    );
    const submit = async (action: CaseAction) => {
      current = applyCaseAction(current, action);
      return current;
    };

    const registration = registerCaseTools({
      modelContext,
      baseActor,
      getState: () => current,
      submit,
      storage,
    });
    await registration.ready;

    expect(registration.toolNames).toEqual([
      "read_case",
      "join_as_agent",
      "set_sections",
      "add_section",
      "add_finding",
      "add_hypothesis",
      "create_task",
      "update_task",
      "post_update",
      "propose_resolution",
      "add_note",
      "add_decision",
      "add_checklist_item",
      "toggle_checklist_item",
    ]);
    expect(tools.get("add_finding")?.inputSchema).toMatchObject({
      type: "object",
    });

    await tools.get("join_as_agent")?.execute({ name: "Scout" });
    await tools
      .get("add_finding")
      ?.execute({ body: "Cache misses increased after release 214." });

    const finding = current.entries.at(-1);
    expect(finding?.author).toMatchObject({
      id: "human-1:agent",
      name: "Scout",
      kind: "agent",
    });
    expect(finding?.source).toBe("webmcp");

    const readResult = await tools.get("read_case")?.execute({});
    expect(readResult?.structuredContent).toMatchObject({
      id: "case-1",
      revision: 3,
    });
    expect(
      (
        readResult?.structuredContent as {
          sections: Array<{ type: string; typeLabel: string; title: string }>;
        }
      ).sections,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "note",
          typeLabel: "Note",
          hint: "A freeform written block",
          title: "Goal",
        }),
        expect.objectContaining({
          type: "tasks",
          typeLabel: "Tasks",
          title: "Tasks",
        }),
      ]),
    );

    registration.dispose();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
