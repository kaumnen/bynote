import { describe, expect, it } from "vitest";

import {
  applyCaseAction,
  createCaseState,
  type MutationContext,
} from "./case-state";
import { DEMO_DIAGRAMS } from "./demo-diagrams";
import { DEMO_DEFAULTS, DEMO_KINDS } from "./demos";
import { mermaidBlocks } from "./markdown";
import {
  CreateCaseInputSchema,
  ENTRY_BODY_MAX,
  NOTE_BODY_MAX,
  type Actor,
} from "./schemas";

function testContext(): MutationContext {
  let id = 0;
  return {
    now: () => "2026-08-28T12:00:00.000Z",
    id: () => `id-${++id}`,
  };
}

const human: Actor = {
  id: "human-1",
  name: "Alex",
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
      creatorName: "Alex",
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

    expect(initial.kind).toBe("bug");
    expect(initial.sections.map(({ title }) => title)).toEqual([
      "Repro",
      "Expected / actual",
      "Findings",
      "Tasks",
    ]);
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
        creatorName: "Alex",
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
    expect(resolved.entries.at(-1)?.acceptedBy?.name).toBe("Alex");
  });

  it("creates a useful fresh demo", () => {
    const state = createCaseState(
      "demo-1",
      CreateCaseInputSchema.parse({
        kind: "incident",
        title: "Checkout errors after release 214",
        creatorName: "Guest",
        demo: true,
      }),
      testContext(),
    );

    expect(state.kind).toBe("incident");
    expect(state.title).toBe("Checkout errors after release 214");
    expect(state.entries).toHaveLength(3);
    expect(state.hypotheses).toHaveLength(1);
    expect(state.tasks).toHaveLength(1);
    expect(state.participants.some(({ actor }) => actor.kind === "agent")).toBe(
      true,
    );
    expect(state).not.toHaveProperty("expiresAt");
  });

  it("creates filled bug and feature samples", () => {
    const bug = createCaseState(
      "demo-bug",
      CreateCaseInputSchema.parse({
        kind: "bug",
        title: "Search results skip page two",
        creatorName: "Guest",
        demo: true,
      }),
      testContext(),
    );
    const feature = createCaseState(
      "demo-feature",
      CreateCaseInputSchema.parse({
        kind: "feature",
        title: "Saturday export drill",
        creatorName: "Guest",
        demo: true,
      }),
      testContext(),
    );

    expect(bug.kind).toBe("bug");
    expect(bug.notes).toHaveLength(2);
    expect(bug.entries.some(({ kind }) => kind === "finding")).toBe(true);
    expect(feature.kind).toBe("feature");
    expect(feature.title).toBe("Saturday export drill");
    expect(feature.notes).toHaveLength(1);
    expect(feature.decisions).toHaveLength(1);
  });

  it("creates filled campaign and meeting samples", () => {
    const campaign = createCaseState(
      "demo-campaign",
      CreateCaseInputSchema.parse({
        kind: "campaign",
        title: "Spring launch in APAC",
        creatorName: "Guest",
        demo: true,
      }),
      testContext(),
    );
    const meeting = createCaseState(
      "demo-meeting",
      CreateCaseInputSchema.parse({
        kind: "meeting",
        title: "Weekly GTM standup",
        creatorName: "Guest",
        demo: true,
      }),
      testContext(),
    );

    expect(campaign.kind).toBe("campaign");
    expect(campaign.notes.some(({ body }) => body.includes("```mermaid"))).toBe(
      true,
    );
    expect(campaign.checklists).toHaveLength(3);
    expect(meeting.kind).toBe("meeting");
    expect(meeting.notes).toHaveLength(1);
    expect(meeting.checklists.map(({ title }) => title)).toContain(
      "Pipeline by region",
    );
  });

  it("puts a mermaid diagram in every filled sample", () => {
    const fences = DEMO_KINDS.flatMap((kind) => {
      const state = createCaseState(
        `demo-${kind}`,
        CreateCaseInputSchema.parse({
          kind,
          title: DEMO_DEFAULTS[kind].title,
          creatorName: "Guest",
          demo: true,
        }),
        testContext(),
      );
      const bodies = [
        ...state.notes.map(({ body }) => body),
        ...state.decisions.map(({ body }) => body),
        ...state.entries.map(({ body }) => body),
        ...state.hypotheses.map(({ detail }) => detail),
      ];
      for (const body of bodies) {
        const limit = state.entries.some((entry) => entry.body === body)
          ? ENTRY_BODY_MAX
          : NOTE_BODY_MAX;
        expect(body.length).toBeLessThanOrEqual(limit);
      }
      return bodies.flatMap((body) => mermaidBlocks(body));
    });

    expect(fences).toHaveLength(DEMO_KINDS.length);
    expect(fences.some((chart) => chart.startsWith("gantt"))).toBe(true);
    expect(fences.some((chart) => chart.startsWith("flowchart"))).toBe(true);
    expect(fences.some((chart) => chart.startsWith("journey"))).toBe(true);
    expect(fences.some((chart) => chart.startsWith("sequenceDiagram"))).toBe(
      true,
    );
    expect(fences.some((chart) => chart.startsWith("stateDiagram-v2"))).toBe(
      true,
    );
    expect(fences).toEqual(
      expect.arrayContaining(Object.values(DEMO_DIAGRAMS)),
    );
  });

  it("lets an agent reshape custom sections", () => {
    const context = testContext();
    const initial = createCaseState(
      "custom-1",
      CreateCaseInputSchema.parse({
        kind: "custom",
        title: "Release notes",
        creatorName: "Alex",
      }),
      context,
    );

    expect(initial.sections).toEqual([]);
    expect(initial.entries).toEqual([]);
    expect(initial.participants).toEqual([]);

    const shaped = applyCaseAction(
      initial,
      {
        type: "set_sections",
        sections: [
          { type: "note", title: "Summary" },
          { type: "checklist", title: "Ship list" },
        ],
        actor: human,
        source: "webmcp",
      },
      context,
    );

    expect(shaped.sections).toHaveLength(2);
    expect(shaped.sections[0]?.title).toBe("Summary");

    const noted = applyCaseAction(
      shaped,
      {
        type: "add_note",
        sectionId: shaped.sections[0]?.id ?? "",
        body: "Ship after the canary is green.",
        actor: human,
        source: "human-ui",
      },
      context,
    );

    expect(noted.notes).toHaveLength(1);
    expect(noted.notes[0]?.body).toContain("canary");
  });
});
