import { createCaseState } from "../../src/shared/case-state";
import { isNotebookId, newNotebookId } from "../../src/shared/case-id";
import {
  DEMO_DEFAULTS,
  isDefaultDemoTitle,
  resolveDemoTitle,
  type DemoKind,
} from "../../src/shared/demos";
import {
  CaseStateSchema,
  NOTEBOOK_FILE_FORMAT,
  NotebookFileSchema,
  type CaseState,
  type CreateCaseInput,
} from "../../src/shared/schemas";

const STORAGE_PREFIX = "byline:notebook:";
const OPEN_KEY = "byline:open";
const LEGACY_DEMO_NAME = "Mina";
const NEUTRAL_NAME = "Alex";

export type NotebookSummary = {
  id: string;
  title: string;
  kind: CaseState["kind"];
  status: CaseState["status"];
  summary: string;
  createdAt: string;
  updatedAt: string;
};

function storageKey(notebookId: string) {
  return `${STORAGE_PREFIX}${notebookId}`;
}

function renameActor(actor: CaseState["participants"][number]["actor"]) {
  return actor.name === LEGACY_DEMO_NAME
    ? { ...actor, name: NEUTRAL_NAME }
    : actor;
}

export function withNeutralNames(state: CaseState): CaseState {
  return {
    ...state,
    entries: state.entries.map((item) => ({
      ...item,
      author: renameActor(item.author),
      acceptedBy: item.acceptedBy ? renameActor(item.acceptedBy) : undefined,
    })),
    hypotheses: state.hypotheses.map((item) => ({
      ...item,
      author: renameActor(item.author),
    })),
    tasks: state.tasks.map((item) => ({
      ...item,
      author: renameActor(item.author),
      assignee:
        item.assignee === LEGACY_DEMO_NAME ? NEUTRAL_NAME : item.assignee,
    })),
    notes: state.notes.map((item) => ({
      ...item,
      author: renameActor(item.author),
    })),
    checklists: state.checklists.map((item) => ({
      ...item,
      author: renameActor(item.author),
    })),
    decisions: state.decisions.map((item) => ({
      ...item,
      author: renameActor(item.author),
    })),
    participants: state.participants.map((item) => ({
      ...item,
      actor: renameActor(item.actor),
    })),
  };
}

export function createLocalNotebook(input: CreateCaseInput) {
  const state = createCaseState(newNotebookId(), input);
  writeLocalNotebook(state);
  return state;
}

export function openDemoNotebook(input: {
  kind: DemoKind;
  title?: string;
  creatorName?: string;
}) {
  const kind = input.kind;
  const defaults = DEMO_DEFAULTS[kind];
  const title = resolveDemoTitle(kind, input.title);
  const creatorName = input.creatorName?.trim() || "Guest";

  if (isDefaultDemoTitle(kind, title)) {
    const existing = listLocalNotebooks()
      .map((summary) => readLocalNotebook(summary.id))
      .find(
        (state): state is CaseState =>
          Boolean(state && state.kind === kind && state.title === defaults.title),
      );
    if (existing) {
      return existing;
    }
  }

  return createLocalNotebook({
    kind,
    title,
    summary: defaults.summary,
    severity: defaults.severity,
    creatorName,
    demo: true,
  });
}

export function readLocalNotebook(notebookId: string) {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(storageKey(notebookId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = CaseStateSchema.parse(JSON.parse(raw));
    const next = withNeutralNames(parsed);
    if (JSON.stringify(parsed).includes(`"${LEGACY_DEMO_NAME}"`)) {
      writeLocalNotebook(next);
    }
    return next;
  } catch {
    localStorage.removeItem(storageKey(notebookId));
    return null;
  }
}

export function writeLocalNotebook(state: CaseState) {
  localStorage.setItem(storageKey(state.id), JSON.stringify(state));
}

export function removeLocalNotebook(notebookId: string) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(storageKey(notebookId));
  if (readOpenNotebookId() === notebookId) {
    clearOpenNotebook();
  }
}

export function readOpenNotebookId() {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const id = sessionStorage.getItem(OPEN_KEY);
    return id && isNotebookId(id) ? id : null;
  } catch {
    return null;
  }
}

export function setOpenNotebook(notebookId: string) {
  if (typeof sessionStorage === "undefined" || !isNotebookId(notebookId)) {
    return;
  }

  try {
    sessionStorage.setItem(OPEN_KEY, notebookId);
  } catch {
    return;
  }
}

export function openNotebookInTab(notebookId: string) {
  if (!isNotebookId(notebookId)) {
    return;
  }

  setOpenNotebook(notebookId);
  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    if (window.location.pathname === "/notebook") {
      window.location.reload();
    } else {
      window.location.assign("/notebook");
    }
  }, 50);
}

export function clearOpenNotebook() {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(OPEN_KEY);
  } catch {
    return;
  }
}

export function listLocalNotebooks(): NotebookSummary[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const summaries: NotebookSummary[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(STORAGE_PREFIX)) {
      continue;
    }

    const notebookId = key.slice(STORAGE_PREFIX.length);
    const state = readLocalNotebook(notebookId);
    if (!state) {
      continue;
    }

    const latest = [
      state.createdAt,
      ...state.entries.map(({ createdAt }) => createdAt),
      ...state.notes.map(({ createdAt }) => createdAt),
      ...state.decisions.map(({ createdAt }) => createdAt),
      ...state.checklists.map(({ updatedAt }) => updatedAt),
    ].sort()
      .at(-1);

    summaries.push({
      id: state.id,
      title: state.title,
      kind: state.kind,
      status: state.status,
      summary: state.summary,
      createdAt: state.createdAt,
      updatedAt: latest ?? state.createdAt,
    });
  }

  return summaries.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function notebookFile(state: CaseState) {
  return {
    format: NOTEBOOK_FILE_FORMAT,
    notebook: state,
  };
}

export function parseNotebookFile(value: unknown) {
  return NotebookFileSchema.parse(value).notebook;
}

export function importNotebookFile(value: unknown) {
  const state = withNeutralNames(parseNotebookFile(value));
  writeLocalNotebook(state);
  return state;
}

export function downloadNotebook(state: CaseState) {
  const blob = new Blob([JSON.stringify(notebookFile(state), null, 2)], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = state.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  link.href = href;
  link.download = `${slug || "notebook"}.bynote.json`;
  link.click();
  URL.revokeObjectURL(href);
}
