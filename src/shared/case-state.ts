import { DEMO_DIAGRAMS, mermaidFence } from "./demo-diagrams";
import {
  DEMO_DEFAULTS,
  isDemoKind,
  resolveDemoTitle,
  type DemoKind,
} from "./demos";
import { toggleMarkdownTask } from "./markdown";
import { reviseNoteItem } from "./note-history";
import { emptyNotebookLists, sectionsForTemplate } from "./templates";
import type {
  Actor,
  CaseAction,
  CaseEntry,
  CaseState,
  CreateCaseInput,
  NoteItem,
  Section,
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

function noteItem(
  id: string,
  sectionId: string,
  body: string,
  author: Actor,
  source: NoteItem["source"],
  createdAt: string,
): NoteItem {
  return { id, sectionId, body, author, source, createdAt };
}

function sectionByTitle(sections: Section[], title: string) {
  return sections.find((section) => section.title === title);
}

function demoKindFor(input: CreateCaseInput): DemoKind {
  return isDemoKind(input.kind) ? input.kind : "campaign";
}

function demoSeed(
  kind: DemoKind,
  sections: Section[],
  lead: Actor,
  trace: Actor,
  firstAt: string,
  secondAt: string,
  thirdAt: string,
  context: MutationContext,
): Pick<
  CaseState,
  | "status"
  | "entries"
  | "hypotheses"
  | "tasks"
  | "notes"
  | "checklists"
  | "decisions"
> {
  const lists = emptyNotebookLists();

  if (kind === "incident") {
    const resolution = sectionByTitle(sections, "Resolution");
    return {
      ...lists,
      status: "investigating",
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
          [
            "Database latency is unchanged. Cache misses are 3.4 times higher.",
            "",
            mermaidFence(DEMO_DIAGRAMS.incidentSequence),
          ].join("\n"),
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
          assignee: "Alex",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
          updatedAt: thirdAt,
        },
      ],
      decisions: resolution
        ? [
            noteItem(
              context.id(),
              resolution.id,
              "If cache keys changed, roll back 214 or restore the old key format.",
              trace,
              "webmcp",
              thirdAt,
            ),
          ]
        : [],
    };
  }

  if (kind === "campaign") {
    const audience = sectionByTitle(sections, "Audience");
    const messaging = sectionByTitle(sections, "Messaging");
    const channels = sectionByTitle(sections, "Channels");
    const decisions = sectionByTitle(sections, "Decisions");
    return {
      ...lists,
      status: "investigating",
      notes: [
        ...(audience
          ? [
              noteItem(
                context.id(),
                audience.id,
                [
                  "Enterprise ops leads in APAC who already use the product.",
                  "",
                  "- They buy through a regional partner.",
                  "- They care about reliability more than new features.",
                ].join("\n"),
                lead,
                "human-ui",
                firstAt,
              ),
            ]
          : []),
        ...(messaging
          ? [
              noteItem(
                context.id(),
                messaging.id,
                [
                  "# Message",
                  "",
                  "Lead with reliability. Proof: 99.9% uptime last two quarters.",
                  "",
                  "## Path to expand",
                  "",
                  mermaidFence(DEMO_DIAGRAMS.campaignFlow),
                ].join("\n"),
                lead,
                "human-ui",
                secondAt,
              ),
            ]
          : []),
      ],
      checklists: channels
        ? [
            {
              id: context.id(),
              sectionId: channels.id,
              title: "Partner webinar",
              done: true,
              author: lead,
              source: "human-ui",
              createdAt: firstAt,
              updatedAt: secondAt,
            },
            {
              id: context.id(),
              sectionId: channels.id,
              title: "Sales one-pager",
              done: false,
              author: lead,
              source: "human-ui",
              createdAt: secondAt,
              updatedAt: secondAt,
            },
            {
              id: context.id(),
              sectionId: channels.id,
              title: "Customer email",
              done: false,
              author: trace,
              source: "webmcp",
              createdAt: thirdAt,
              updatedAt: thirdAt,
            },
          ]
        : [],
      tasks: [
        {
          id: context.id(),
          title: "Draft the one-pager from the messaging note",
          status: "doing",
          assignee: "Alex",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
          updatedAt: thirdAt,
        },
      ],
      decisions: decisions
        ? [
            noteItem(
              context.id(),
              decisions.id,
              "Keep the first wave partner-only. Direct sales follows after the webinar.",
              lead,
              "human-ui",
              thirdAt,
            ),
          ]
        : [],
    };
  }

  if (kind === "meeting") {
    const agenda = sectionByTitle(sections, "Agenda");
    const notes = sectionByTitle(sections, "Notes");
    const decisions = sectionByTitle(sections, "Decisions");
    return {
      ...lists,
      status: "open",
      notes: notes
        ? [
            noteItem(
              context.id(),
              notes.id,
              [
                "# Standup",
                "",
                "APAC pipeline is ahead of plan. EMEA is waiting on the one-pager.",
                "",
                "1. Ship the one-pager before Thursday's partner call.",
                "2. Keep the webinar date. Do not add a second region this wave.",
                "",
                mermaidFence(DEMO_DIAGRAMS.meetingJourney),
              ].join("\n"),
              lead,
              "human-ui",
              secondAt,
            ),
          ]
        : [],
      checklists: agenda
        ? [
            {
              id: context.id(),
              sectionId: agenda.id,
              title: "Pipeline by region",
              done: true,
              author: lead,
              source: "human-ui",
              createdAt: firstAt,
              updatedAt: firstAt,
            },
            {
              id: context.id(),
              sectionId: agenda.id,
              title: "Launch blockers",
              done: true,
              author: lead,
              source: "human-ui",
              createdAt: firstAt,
              updatedAt: secondAt,
            },
            {
              id: context.id(),
              sectionId: agenda.id,
              title: "Asks for product",
              done: false,
              author: lead,
              source: "human-ui",
              createdAt: firstAt,
              updatedAt: firstAt,
            },
          ]
        : [],
      tasks: [
        {
          id: context.id(),
          title: "Send the one-pager draft to EMEA before Thursday",
          status: "open",
          assignee: "Alex",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
          updatedAt: thirdAt,
        },
      ],
      decisions: decisions
        ? [
            noteItem(
              context.id(),
              decisions.id,
              "Webinar date stays. No second region until the one-pager is in market.",
              lead,
              "human-ui",
              thirdAt,
            ),
          ]
        : [],
    };
  }

  if (kind === "bug") {
    const repro = sectionByTitle(sections, "Repro");
    const expected = sectionByTitle(sections, "Expected / actual");
    return {
      ...lists,
      status: "investigating",
      notes: [
        ...(repro
          ? [
              noteItem(
                context.id(),
                repro.id,
                [
                  "Open search, go to page 2. The ten results are a copy of page 1.",
                  "",
                  mermaidFence(DEMO_DIAGRAMS.bugSequence),
                ].join("\n"),
                lead,
                "human-ui",
                firstAt,
              ),
            ]
          : []),
        ...(expected
          ? [
              noteItem(
                context.id(),
                expected.id,
                "Expected page 2. Actual: page 1 repeats. Refresh does not help.",
                lead,
                "human-ui",
                secondAt,
              ),
            ]
          : []),
      ],
      entries: [
        entry(
          context.id(),
          "finding",
          "The list query uses page as the offset instead of (page - 1) * size.",
          trace,
          "webmcp",
          thirdAt,
        ),
      ],
      tasks: [
        {
          id: context.id(),
          title: "Confirm the offset math in the list query",
          status: "doing",
          assignee: "Alex",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
          updatedAt: thirdAt,
        },
      ],
    };
  }

  if (kind === "plan") {
    const goal = sectionByTitle(sections, "Goal");
    const decisions = sectionByTitle(sections, "Decisions");
    return {
      ...lists,
      status: "investigating",
      notes: goal
        ? [
            noteItem(
              context.id(),
              goal.id,
              [
                "# Goal",
                "",
                "Land the APAC partner wave before the webinar.",
                "",
                "## Window",
                "",
                "- One-pager in review this week.",
                "- Webinar on 18 Sep.",
                "",
                mermaidFence(DEMO_DIAGRAMS.planGantt),
              ].join("\n"),
              lead,
              "human-ui",
              firstAt,
            ),
          ]
        : [],
      tasks: [
        {
          id: context.id(),
          title: "Finish the one-pager for partner review",
          status: "doing",
          assignee: "Alex",
          author: trace,
          source: "webmcp",
          createdAt: thirdAt,
          updatedAt: thirdAt,
        },
      ],
      decisions: decisions
        ? [
            noteItem(
              context.id(),
              decisions.id,
              "Keep the webinar date. Slip direct sales if the one-pager is late.",
              lead,
              "human-ui",
              thirdAt,
            ),
          ]
        : [],
    };
  }

  const goal = sectionByTitle(sections, "Goal");
  const spec = sectionByTitle(sections, "Spec and decisions");
  return {
    ...lists,
    status: "open",
    notes: goal
      ? [
          noteItem(
            context.id(),
            goal.id,
            "A JSON export that another Bynote tab can import. No account.",
            lead,
            "human-ui",
            firstAt,
          ),
        ]
      : [],
    decisions: spec
      ? [
          noteItem(
            context.id(),
            spec.id,
            [
              "Keep the file on this device. A copied link will not fetch the notes.",
              "",
              mermaidFence(DEMO_DIAGRAMS.featureStates),
            ].join("\n"),
            trace,
            "webmcp",
            secondAt,
          ),
        ]
      : [],
    tasks: [
      {
        id: context.id(),
        title: "Draft the v1 file shape and import path",
        status: "doing",
        assignee: "Alex",
        author: trace,
        source: "webmcp",
        createdAt: thirdAt,
        updatedAt: thirdAt,
      },
    ],
  };
}

export function createCaseState(
  caseId: string,
  input: CreateCaseInput,
  context: MutationContext = defaultMutationContext,
): CaseState {
  const now = context.now();
  const creator = actor(context.id(), input.creatorName, "human");

  if (input.demo) {
    const kind = demoKindFor(input);
    const defaults = DEMO_DEFAULTS[kind];
    const sections = sectionsForTemplate(kind, context.id);
    const lead = actor(context.id(), "Alex", "human");
    const trace = actor(context.id(), "Trace", "agent");
    const firstAt = timeBefore(now, 18);
    const secondAt = timeBefore(now, 12);
    const thirdAt = timeBefore(now, 7);

    return {
      id: caseId,
      kind,
      title: resolveDemoTitle(kind, input.title),
      summary: defaults.summary,
      severity: defaults.severity,
      createdAt: firstAt,
      revision: 1,
      sections,
      ...demoSeed(
        kind,
        sections,
        lead,
        trace,
        firstAt,
        secondAt,
        thirdAt,
        context,
      ),
      participants: [
        { actor: creator, lastSeenAt: now },
        { actor: lead, lastSeenAt: now },
        { actor: trace, lastSeenAt: now },
      ],
    };
  }

  const sections = sectionsForTemplate(input.kind, context.id);

  return {
    id: caseId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    severity: input.severity,
    status: "open",
    createdAt: now,
    revision: 1,
    sections,
    ...emptyNotebookLists(),
    participants: [],
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

function requireSection(
  state: CaseState,
  sectionId: string,
  type: Section["type"],
) {
  const section = state.sections.find(({ id }) => id === sectionId);
  if (!section || section.type !== type) {
    throw new Error("Section not found");
  }
  return section;
}

function pruneForSections(state: CaseState, sections: Section[]): CaseState {
  const ids = new Set(sections.map(({ id }) => id));
  return {
    ...state,
    sections,
    notes: state.notes.filter(({ sectionId }) => ids.has(sectionId)),
    checklists: state.checklists.filter(({ sectionId }) => ids.has(sectionId)),
    decisions: state.decisions.filter(({ sectionId }) => ids.has(sectionId)),
  };
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

    case "add_note":
      requireSection(state, action.sectionId, "note");
      return {
        ...base,
        notes: [
          ...state.notes,
          noteItem(
            context.id(),
            action.sectionId,
            action.body,
            action.actor,
            action.source,
            now,
          ),
        ].slice(-100),
      };

    case "revise_note": {
      const item = state.notes.find(({ id }) => id === action.noteId);
      if (!item) {
        throw new Error("Note not found");
      }

      const revised = reviseNoteItem(
        item,
        action.body,
        action.actor,
        action.source,
        now,
      );
      if (revised === item) {
        return state;
      }

      return {
        ...base,
        notes: state.notes.map((entryItem) =>
          entryItem.id === action.noteId ? revised : entryItem,
        ),
      };
    }

    case "toggle_note_task": {
      const item = state.notes.find(({ id }) => id === action.noteId);
      if (!item) {
        throw new Error("Note not found");
      }

      const body = toggleMarkdownTask(item.body, action.taskIndex);
      if (body === null) {
        throw new Error("Task item not found");
      }

      const revised = reviseNoteItem(
        item,
        body,
        action.actor,
        action.source,
        now,
      );
      if (revised === item) {
        return state;
      }

      return {
        ...base,
        notes: state.notes.map((entryItem) =>
          entryItem.id === action.noteId ? revised : entryItem,
        ),
      };
    }

    case "add_decision":
      requireSection(state, action.sectionId, "decisions");
      return {
        ...base,
        decisions: [
          ...state.decisions,
          noteItem(
            context.id(),
            action.sectionId,
            action.body,
            action.actor,
            action.source,
            now,
          ),
        ].slice(-100),
      };

    case "add_checklist_item":
      requireSection(state, action.sectionId, "checklist");
      return {
        ...base,
        checklists: [
          ...state.checklists,
          {
            id: context.id(),
            sectionId: action.sectionId,
            title: action.title,
            done: false,
            author: action.actor,
            source: action.source,
            createdAt: now,
            updatedAt: now,
          },
        ].slice(-200),
      };

    case "toggle_checklist_item": {
      const item = state.checklists.find(({ id }) => id === action.itemId);
      if (!item) {
        throw new Error("Checklist item not found");
      }

      return {
        ...base,
        checklists: state.checklists.map((entryItem) =>
          entryItem.id === action.itemId
            ? { ...entryItem, done: !entryItem.done, updatedAt: now }
            : entryItem,
        ),
      };
    }

    case "add_section": {
      if (state.sections.length >= 20) {
        throw new Error("A notebook can have 20 sections");
      }

      return {
        ...base,
        sections: [
          ...state.sections,
          {
            id: context.id(),
            type: action.sectionType,
            title: action.title,
          },
        ],
      };
    }

    case "set_sections": {
      const sections = action.sections.map((section) => ({
        id: context.id(),
        type: section.type,
        title: section.title,
      }));
      return pruneForSections(base, sections);
    }
  }
}
