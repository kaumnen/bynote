import type {
  Actor,
  CaseAction,
  CaseEntry,
  CaseState,
  CreateCaseInput,
} from "./schemas";

export type MutationContext = {
  now: () => string;
  id: () => string;
};

export const defaultMutationContext: MutationContext = {
  now: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
};

function timeBefore(iso: string, minutes: number) {
  return new Date(Date.parse(iso) - minutes * 60_000).toISOString();
}

function actor(id: string, name: string, kind: Actor["kind"]): Actor {
  return { id, name, kind };
}

function entry(
  id: string,
  kind: CaseEntry["kind"],
  body: string,
  author: Actor,
  source: CaseEntry["source"],
  createdAt: string,
): CaseEntry {
  return { id, kind, body, author, source, createdAt };
}

export function createCaseState(
  caseId: string,
  input: CreateCaseInput,
  context: MutationContext = defaultMutationContext,
): CaseState {
  const now = context.now();
  const creator = actor(context.id(), input.creatorName, "human");

  if (input.demo) {
    const lead = actor(context.id(), "Mina", "human");
    const trace = actor(context.id(), "Trace", "agent");
    const firstAt = timeBefore(now, 18);
    const secondAt = timeBefore(now, 12);
    const thirdAt = timeBefore(now, 7);

    return {
      id: caseId,
      kind: "incident",
      title: "Checkout errors after release 214",
      summary:
        "Checkout requests are returning errors in two regions. The issue started soon after a release.",
      severity: "critical",
      status: "investigating",
      createdAt: firstAt,
      revision: 1,
      entries: [
        entry(
          context.id(),
          "update",
          "Checkout errors crossed 10 percent in two regions.",
          lead,
          "human-ui",
          firstAt,
        ),
        entry(
          context.id(),
          "finding",
          "Errors started four minutes after release 214.",
          lead,
          "human-ui",
          secondAt,
        ),
        entry(
          context.id(),
          "finding",
          "Database latency is unchanged. Cache misses are 3.4 times higher.",
          trace,
          "webmcp",
          thirdAt,
        ),
      ],
      hypotheses: [
        {
          id: context.id(),
          title: "Release 214 changed cache keys",
          detail:
            "The timing and cache miss increase point to a key format change.",
          confidence: "high",
          status: "active",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
        },
      ],
      tasks: [
        {
          id: context.id(),
          title: "Compare cache keys before and after release 214",
          status: "doing",
          assignee: "Mina",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
          updatedAt: thirdAt,
        },
      ],
      participants: [
        { actor: creator, lastSeenAt: now },
        { actor: lead, lastSeenAt: now },
        { actor: trace, lastSeenAt: now },
      ],
    };
  }

  return {
    id: caseId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    severity: input.severity,
    status: "open",
    createdAt: now,
    revision: 1,
    entries: [
      entry(
        context.id(),
        "update",
        "Case opened.",
        creator,
        "human-ui",
        now,
      ),
    ],
    hypotheses: [],
    tasks: [],
    participants: [{ actor: creator, lastSeenAt: now }],
  };
}

function withParticipant(state: CaseState, nextActor: Actor, now: string) {
  const otherParticipants = state.participants.filter(
    ({ actor: participant }) => participant.id !== nextActor.id,
  );

  return [
    ...otherParticipants,
    { actor: nextActor, lastSeenAt: now },
  ].slice(-30);
}

function appendEntry(state: CaseState, nextEntry: CaseEntry) {
  return [...state.entries, nextEntry].slice(-250);
}

export function applyCaseAction(
  state: CaseState,
  action: CaseAction,
  context: MutationContext = defaultMutationContext,
): CaseState {
  const now = context.now();
  const base: CaseState = {
    ...state,
    revision: state.revision + 1,
    participants: withParticipant(state, action.actor, now),
  };

  switch (action.type) {
    case "join":
      return base;

    case "post_update":
      return {
        ...base,
        entries: appendEntry(
          state,
          entry(
            context.id(),
            "update",
            action.body,
            action.actor,
            action.source,
            now,
          ),
        ),
      };

    case "add_finding":
      return {
        ...base,
        entries: appendEntry(
          state,
          entry(
            context.id(),
            "finding",
            action.body,
            action.actor,
            action.source,
            now,
          ),
        ),
      };

    case "add_hypothesis":
      return {
        ...base,
        hypotheses: [
          ...state.hypotheses,
          {
            id: context.id(),
            title: action.title,
            detail: action.detail,
            confidence: action.confidence,
            status: "active" as const,
            author: action.actor,
            source: action.source,
            createdAt: now,
          },
        ].slice(-100),
      };

    case "create_task":
      return {
        ...base,
        tasks: [
          ...state.tasks,
          {
            id: context.id(),
            title: action.title,
            status: "open" as const,
            assignee: action.assignee || undefined,
            author: action.actor,
            source: action.source,
            createdAt: now,
            updatedAt: now,
          },
        ].slice(-100),
      };

    case "update_task": {
      const task = state.tasks.find(({ id }) => id === action.taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      return {
        ...base,
        tasks: state.tasks.map((item) =>
          item.id === action.taskId
            ? { ...item, status: action.status, updatedAt: now }
            : item,
        ),
        entries: appendEntry(
          state,
          entry(
            context.id(),
            "task-change",
            `${task.title}: ${action.status}.`,
            action.actor,
            action.source,
            now,
          ),
        ),
      };
    }

    case "propose_resolution":
      return {
        ...base,
        entries: appendEntry(
          state,
          entry(
            context.id(),
            "resolution-proposal",
            action.body,
            action.actor,
            action.source,
            now,
          ),
        ),
      };

    case "accept_resolution": {
      if (action.actor.kind !== "human") {
        throw new Error("A human must accept the resolution");
      }

      const proposal = state.entries.find(
        ({ id, kind }) =>
          id === action.entryId && kind === "resolution-proposal",
      );
      if (!proposal) {
        throw new Error("Resolution proposal not found");
      }

      return {
        ...base,
        status: "resolved",
        entries: state.entries.map((item) =>
          item.id === proposal.id
            ? { ...item, acceptedAt: now, acceptedBy: action.actor }
            : item,
        ),
      };
    }

    case "set_status":
      return {
        ...base,
        status: action.status,
        entries: appendEntry(
          state,
          entry(
            context.id(),
            "status-change",
            `Status changed to ${action.status}.`,
            action.actor,
            action.source,
            now,
          ),
        ),
      };
  }
}
