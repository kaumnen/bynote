import { afterEach, describe, expect, it } from "vitest";

import { applyCaseAction, createCaseState } from "../../src/shared/case-state";
import { CreateCaseInputSchema } from "../../src/shared/schemas";
import {
  clearOpenNotebook,
  createLocalNotebook,
  importNotebookFile,
  listLocalNotebooks,
  notebookFile,
  openDemoNotebook,
  parseNotebookFile,
  readLocalNotebook,
  readOpenNotebookId,
  removeLocalNotebook,
  setOpenNotebook,
} from "./local-notebook";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    get length() {
      return data.size;
    },
  } satisfies Storage;
}

function installMemoryStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memoryStorage(),
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
});

describe("notebook export", () => {
  it("round-trips a notebook through the v1 file", () => {
    const state = createCaseState(
      "abc123abc123abc123abc123abc123ab",
      CreateCaseInputSchema.parse({
        kind: "feature",
        title: "Share notes as a file",
        creatorName: "Alex",
      }),
    );

    const restored = parseNotebookFile(notebookFile(state));
    expect(restored.id).toBe(state.id);
    expect(restored.kind).toBe("feature");
    expect(restored.sections[0]?.title).toBe("Goal");
    expect(notebookFile(state).format).toBe("bynote.notebook.v1");
  });

  it("imports a legacy byline.notebook.v1 file", () => {
    const state = createCaseState(
      "abc123abc123abc123abc123abc123ab",
      CreateCaseInputSchema.parse({
        kind: "custom",
        title: "Old export",
        creatorName: "Alex",
      }),
    );

    const restored = parseNotebookFile({
      format: "byline.notebook.v1",
      notebook: state,
    });
    expect(restored.title).toBe("Old export");
  });

  it("persists, lists, and reimports on this device", () => {
    installMemoryStorage();
    const created = createLocalNotebook(
      CreateCaseInputSchema.parse({
        kind: "custom",
        title: "Blank canvas",
        creatorName: "Alex",
      }),
    );
    expect(created.sections).toEqual([]);
    expect(readLocalNotebook(created.id)?.title).toBe("Blank canvas");
    expect(listLocalNotebooks()).toEqual([
      expect.objectContaining({
        title: "Blank canvas",
        kind: "custom",
        createdAt: created.createdAt,
      }),
    ]);

    const shaped = applyCaseAction(created, {
      type: "add_section",
      sectionType: "checklist",
      title: "Ship list",
      actor: { id: "human-1", name: "Alex", kind: "human" },
      source: "human-ui",
    });
    const imported = importNotebookFile(notebookFile(shaped));
    expect(imported.sections[0]?.title).toBe("Ship list");
    expect(readLocalNotebook(imported.id)?.sections).toHaveLength(1);
  });

  it("rewrites stored demo name Mina to Alex", () => {
    installMemoryStorage();
    const state = createLocalNotebook(
      CreateCaseInputSchema.parse({
        kind: "incident",
        title: "Checkout errors after release 214",
        creatorName: "Mina",
      }),
    );
    localStorage.setItem(
      `byline:notebook:${state.id}`,
      JSON.stringify({
        ...state,
        participants: [
          {
            actor: { id: "human-1", name: "Mina", kind: "human" },
            lastSeenAt: state.createdAt,
          },
        ],
        tasks: [
          {
            id: "task-1",
            title: "Check cache keys",
            status: "doing",
            assignee: "Mina",
            author: { id: "agent-1", name: "Trace", kind: "agent" },
            source: "webmcp",
            createdAt: state.createdAt,
            updatedAt: state.createdAt,
          },
        ],
      }),
    );

    const loaded = readLocalNotebook(state.id);
    expect(loaded?.participants[0]?.actor.name).toBe("Alex");
    expect(loaded?.tasks[0]?.assignee).toBe("Alex");
  });
});

describe("open notebook pointer", () => {
  it("remembers the open notebook in session storage", () => {
    installMemoryStorage();
    const created = createLocalNotebook(
      CreateCaseInputSchema.parse({
        kind: "custom",
        title: "Open pointer",
        creatorName: "Alex",
      }),
    );

    setOpenNotebook(created.id);
    expect(readOpenNotebookId()).toBe(created.id);
    setOpenNotebook("not-an-id");
    expect(readOpenNotebookId()).toBe(created.id);
    clearOpenNotebook();
    expect(readOpenNotebookId()).toBeNull();
  });

  it("clears the open pointer when that notebook is deleted", () => {
    installMemoryStorage();
    const created = createLocalNotebook(
      CreateCaseInputSchema.parse({
        kind: "bug",
        title: "Delete me",
        creatorName: "Alex",
      }),
    );
    setOpenNotebook(created.id);
    removeLocalNotebook(created.id);
    expect(readOpenNotebookId()).toBeNull();
    expect(readLocalNotebook(created.id)).toBeNull();
  });
});

describe("demo notebook", () => {
  it("reopens the default sample instead of creating another", () => {
    installMemoryStorage();
    const first = openDemoNotebook({ kind: "incident" });
    const second = openDemoNotebook({ kind: "incident" });
    expect(second.id).toBe(first.id);
    expect(listLocalNotebooks()).toHaveLength(1);
    expect(first.title).toBe("Checkout errors after release 214");
  });

  it("keeps default samples of different types separate", () => {
    installMemoryStorage();
    const incident = openDemoNotebook({ kind: "incident" });
    const bug = openDemoNotebook({ kind: "bug" });
    expect(bug.id).not.toBe(incident.id);
    expect(bug.title).toBe("Search results skip page two");
    expect(listLocalNotebooks()).toHaveLength(2);
  });

  it("creates a new sample when the name is custom", () => {
    installMemoryStorage();
    const named = openDemoNotebook({
      kind: "incident",
      title: "Saturday checkout drill",
    });
    const namedAgain = openDemoNotebook({
      kind: "incident",
      title: "Saturday checkout drill",
    });
    expect(named.title).toBe("Saturday checkout drill");
    expect(namedAgain.id).not.toBe(named.id);
    expect(listLocalNotebooks()).toHaveLength(2);
  });

  it("adopts an existing default sample when present", () => {
    installMemoryStorage();
    const created = createLocalNotebook(
      CreateCaseInputSchema.parse({
        kind: "incident",
        title: "Checkout errors after release 214",
        creatorName: "Alex",
        demo: true,
      }),
    );
    const opened = openDemoNotebook({ kind: "incident" });
    expect(opened.id).toBe(created.id);
    expect(listLocalNotebooks()).toHaveLength(1);
  });

  it("creates a fresh default sample after the last one is deleted", () => {
    installMemoryStorage();
    const first = openDemoNotebook({ kind: "feature" });
    removeLocalNotebook(first.id);
    const second = openDemoNotebook({ kind: "feature" });
    expect(second.id).not.toBe(first.id);
    expect(readLocalNotebook(first.id)).toBeNull();
    expect(listLocalNotebooks()).toHaveLength(1);
  });
});
