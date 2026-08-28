import { describe, expect, it } from "vitest";

import {
  applyCaseAction,
  createCaseState,
  type MutationContext,
} from "./case-state";
import { CreateCaseInputSchema, type Actor } from "./schemas";

function testContext(): MutationContext {
  let id = 0;
  return {
    now: () => "2026-08-28T12:00:00.000Z",
    id: () => `id-${++id}`,
  };
}

const human: Actor = {
  id: "human-1",
  name: "Mina",
  kind: "human",
};

describe("case state", () => {
  it("creates a case and applies ordered actions", () => {
    const context = testContext();
    const input = CreateCaseInputSchema.parse({
      kind: "bug",
      title: "Draft disappears after reconnect",
      summary: "A saved draft is lost after the browser reconnects.",
      severity: "high",
      creatorName: "Mina",
      demo: false,
    });
    const initial = createCaseState("case-1", input, context);

    const withFinding = applyCaseAction(
      initial,
      {
        type: "add_finding",
        body: "The draft exists before the socket reconnects.",
        actor: human,
        source: "human-ui",
      },
      context,
    );
    const withTask = applyCaseAction(
      withFinding,
      {
        type: "create_task",
        title: "Inspect reconnect state",
        actor: human,
        source: "human-ui",
      },
      context,
    );

    expect(withFinding.revision).toBe(2);
    expect(withFinding.entries.at(-1)?.kind).toBe("finding");
    expect(withTask.revision).toBe(3);
    expect(withTask.tasks).toHaveLength(1);
    expect(withTask.tasks[0]?.status).toBe("open");
  });

  it("requires a human to accept a resolution", () => {
    const context = testContext();
    const initial = createCaseState(
      "case-2",
      CreateCaseInputSchema.parse({
        title: "Checkout errors",
        creatorName: "Mina",
      }),
      context,
    );
    const agent: Actor = {
      id: "agent-1",
      name: "Scout",
      kind: "agent",
    };
    const proposed = applyCaseAction(
      initial,
      {
        type: "propose_resolution",
        body: "Roll back release 214.",
        actor: agent,
        source: "webmcp",
      },
      context,
    );
    const proposalId = proposed.entries.at(-1)?.id;

    expect(() =>
      applyCaseAction(
        proposed,
        {
          type: "accept_resolution",
          entryId: proposalId ?? "",
          actor: agent,
          source: "webmcp",
        },
        context,
      ),
    ).toThrow("A human must accept the resolution");

    const resolved = applyCaseAction(
      proposed,
      {
        type: "accept_resolution",
        entryId: proposalId ?? "",
        actor: human,
        source: "human-ui",
      },
      context,
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.entries.at(-1)?.acceptedBy?.name).toBe("Mina");
  });

  it("creates a useful fresh demo", () => {
    const state = createCaseState(
      "demo-1",
      CreateCaseInputSchema.parse({
        title: "Demo",
        creatorName: "Guest",
        demo: true,
      }),
      testContext(),
    );

    expect(state.kind).toBe("incident");
    expect(state.entries).toHaveLength(3);
    expect(state.hypotheses).toHaveLength(1);
    expect(state.tasks).toHaveLength(1);
    expect(state.participants.some(({ actor }) => actor.kind === "agent")).toBe(
      true,
    );
  });
});
