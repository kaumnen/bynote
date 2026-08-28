import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { readStoredActorName, useActor } from "../hooks/use-actor";
import { useCaseRoom } from "../hooks/use-case-room";
import { useWebMcp } from "../hooks/use-webmcp";
import { HowItWorks } from "../components/how-it-works";
import { SiteFooter } from "../components/site-footer";
import {
  clearOpenNotebook,
  createLocalNotebook,
  downloadNotebook,
  listLocalNotebooks,
  openNotebookInTab,
  readLocalNotebook,
  readOpenNotebookId,
  removeLocalNotebook,
  withNeutralNames,
} from "../lib/local-notebook";
import { notebookAgentPrompt } from "../webmcp/prompts";
import { registerLibraryTools } from "../webmcp/register-library-tools";
import { registerCaseTools } from "../webmcp/register-tools";
import { isNotebookId } from "../../src/shared/case-id";
import {
  SECTION_PALETTE,
  kindLabel,
  kindUsesSeverity,
  severityLabel,
  statusOptions,
} from "../../src/shared/templates";
import type {
  Actor,
  CaseAction,
  CaseEntry,
  CaseState,
  CaseStatusSchema,
  Section,
  SectionType,
  TaskStatusSchema,
} from "../../src/shared/schemas";
import type { z } from "zod";

type ComposerKind =
  | "update"
  | "finding"
  | "hypothesis"
  | "task"
  | "resolution";
type CaseStatus = z.infer<typeof CaseStatusSchema>;
type TaskStatus = z.infer<typeof TaskStatusSchema>;

const composerLabels: Record<ComposerKind, string> = {
  update: "Post update",
  finding: "Add finding",
  hypothesis: "Add hypothesis",
  task: "Create task",
  resolution: "Propose resolution",
};

const composerPlaceholders: Record<ComposerKind, string> = {
  update: "What changed?",
  finding: "What did you verify?",
  hypothesis: "What could explain this?",
  task: "What needs to happen?",
  resolution: "What should resolve this?",
};

const entryLabels: Record<CaseEntry["kind"], string> = {
  update: "Update",
  finding: "Finding",
  "resolution-proposal": "Resolution proposal",
  "status-change": "Status",
  "task-change": "Task",
};

function timeLabel(value: string) {
  const iso = new Date(value).toISOString();
  return `${iso.slice(11, 16)} UTC`;
}

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function actorKey(actor: Actor) {
  return `${actor.kind}:${actor.name.trim().toLowerCase()}`;
}

function actorTone(name: string) {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return `tone-${Math.abs(hash) % 5}`;
}

export function meta() {
  return [
    { title: "Notebook | Bynote" },
    {
      name: "description",
      content: "A local notebook for people and agents.",
    },
  ];
}

export default function CaseRoute() {
  return <DeviceNotebook />;
}

function DeviceNotebook() {
  const location = useLocation();
  const navigate = useNavigate();
  const seeded = (location.state as { case?: CaseState } | null)?.case;
  const [notebookId, setNotebookId] = useState<string | null | undefined>(
    seeded?.id && isNotebookId(seeded.id) ? seeded.id : undefined,
  );
  const [state, setState] = useState<CaseState | null | undefined>(
    seeded && seeded.id === notebookId
      ? withNeutralNames(seeded)
      : undefined,
  );

  useEffect(() => {
    if (notebookId) {
      return;
    }

    const openId = readOpenNotebookId();
    if (!openId) {
      navigate("/", { replace: true });
      return;
    }

    setNotebookId(openId);
  }, [notebookId, navigate]);

  useEffect(() => {
    if (!notebookId || state) {
      return;
    }

    setState(readLocalNotebook(notebookId));
  }, [notebookId, state]);

  useEffect(() => {
    if (state === null) {
      clearOpenNotebook();
    }
  }, [state]);

  if (!notebookId || state === undefined) {
    return null;
  }

  if (!state) {
    return (
      <main className="error-page">
        <Link className="wordmark" to="/">
          BYNOTE
        </Link>
        <section className="error-panel">
          <p className="eyebrow">This device</p>
          <h1>Notebook not on this browser</h1>
          <p>
            Notes live in this browser. Import a JSON export, or start a new
            notebook.
          </p>
          <Link className="button button-primary" to="/">
            Start a notebook
          </Link>
        </section>
      </main>
    );
  }

  return <NotebookWorkspace initialState={state} />;
}

function NotebookWorkspace({ initialState }: { initialState: CaseState }) {
  const { actor, setName } = useActor();
  const room = useCaseRoom(initialState);
  const webMcp = useWebMcp(
    (modelContext) => {
      const caseTools = registerCaseTools({
        modelContext,
        baseActor: actor,
        getState: room.getState,
        submit: room.submit,
        storage: window.sessionStorage,
      });
      const libraryTools = registerLibraryTools({
        modelContext,
        list: listLocalNotebooks,
        create: createLocalNotebook,
        openInTab: openNotebookInTab,
        openId: readOpenNotebookId,
        creatorName: readStoredActorName,
      });
      return {
        ready: Promise.all([caseTools.ready, libraryTools.ready]),
        toolNames: [...caseTools.toolNames, ...libraryTools.toolNames],
        dispose: () => {
          caseTools.dispose();
          libraryTools.dispose();
        },
      };
    },
    actor.id !== "pending",
    [actor.id, actor.name],
  );
  const [nameDraft, setNameDraft] = useState(actor.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sectionType, setSectionType] = useState<SectionType>("note");
  const [sectionTitle, setSectionTitle] = useState("");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    setNameDraft(actor.name);
  }, [actor.name]);

  useEffect(() => {
    if (actor.id === "pending") {
      return;
    }

    room
      .submit({ type: "join", actor, source: "human-ui" })
      .catch(() => {
        setError("Could not join the notebook.");
      });
  }, [actor.id, actor.name, room.submit]);

  const authors = useMemo(() => {
    const people = [
      ...room.state.entries
        .filter((entry) => entry.body !== "Notebook opened.")
        .map(({ author }) => author),
      ...room.state.hypotheses.map(({ author }) => author),
      ...room.state.tasks.map(({ author }) => author),
      ...room.state.notes.map(({ author }) => author),
      ...room.state.decisions.map(({ author }) => author),
      ...room.state.checklists.map(({ author }) => author),
    ];
    const unique = new Map<string, Actor>();
    for (const person of people) {
      unique.set(actorKey(person), person);
    }
    return [...unique.values()];
  }, [
    room.state.checklists,
    room.state.decisions,
    room.state.entries,
    room.state.hypotheses,
    room.state.notes,
    room.state.tasks,
  ]);
  const contributorTones = useMemo(
    () =>
      new Map(
        authors.map((participant, index) => [
          actorKey(participant),
          `tone-${index % 5}`,
        ]),
      ),
    [authors],
  );
  const toneFor = (participant: Actor) =>
    contributorTones.get(actorKey(participant)) ?? actorTone(participant.name);

  useEffect(() => {
    if (authors.length <= 1 && authorFilter !== "all") {
      setAuthorFilter("all");
    }
  }, [authorFilter, authors.length]);

  const submitAction = async (action: CaseAction) => {
    setBusy(true);
    setError("");
    try {
      await room.submit(action);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Request failed",
      );
      throw nextError;
    } finally {
      setBusy(false);
    }
  };

  const handleComposer = async (kind: ComposerKind, value: string) => {
    if (!value || actor.id === "pending") {
      return;
    }

    let action: CaseAction;
    switch (kind) {
      case "finding":
        action = {
          type: "add_finding",
          body: value,
          actor,
          source: "human-ui",
        };
        break;
      case "hypothesis":
        action = {
          type: "add_hypothesis",
          title: value,
          detail: "",
          confidence: "medium",
          actor,
          source: "human-ui",
        };
        break;
      case "task":
        action = {
          type: "create_task",
          title: value,
          actor,
          source: "human-ui",
        };
        break;
      case "resolution":
        action = {
          type: "propose_resolution",
          body: value,
          actor,
          source: "human-ui",
        };
        break;
      default:
        action = {
          type: "post_update",
          body: value,
          actor,
          source: "human-ui",
        };
    }

    try {
      await submitAction(action);
    } catch {
      return;
    }
  };

  const changeStatus = async (status: CaseStatus) => {
    await submitAction({
      type: "set_status",
      status,
      actor,
      source: "human-ui",
    });
  };

  const changeTask = async (taskId: string, status: TaskStatus) => {
    await submitAction({
      type: "update_task",
      taskId,
      status,
      actor,
      source: "human-ui",
    });
  };

  const acceptResolution = async (entryId: string) => {
    await submitAction({
      type: "accept_resolution",
      entryId,
      actor,
      source: "human-ui",
    });
  };

  const saveName = () => {
    setName(nameDraft);
  };

  const addSection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = sectionTitle.trim();
    if (!title || actor.id === "pending") {
      return;
    }

    try {
      await submitAction({
        type: "add_section",
        sectionType,
        title,
        actor,
        source: "human-ui",
      });
      setSectionTitle("");
    } catch {
      return;
    }
  };

  const deleteNotebook = () => {
    if (!pendingDelete) {
      setPendingDelete(true);
      return;
    }

    removeLocalNotebook(room.state.id);
    window.location.href = "/";
  };

  const showAuthors = authors.length > 1;
  const notebookKind = kindLabel(room.state.kind);
  const showSeverity = kindUsesSeverity(room.state.kind);

  const addSectionForm = (
    <form className="add-section" onSubmit={addSection}>
      <div className="section-heading compact">
        <h2>Add a section</h2>
        {room.state.sections.length ? (
          <span>{room.state.sections.length}/20</span>
        ) : null}
      </div>
      <div className="form-row">
        <label className="field">
          <span>Type</span>
          <select
            value={sectionType}
            onChange={(event) =>
              setSectionType(event.target.value as SectionType)
            }
          >
            {SECTION_PALETTE.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Title</span>
          <input
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value)}
            maxLength={80}
            placeholder={
              SECTION_PALETTE.find(({ type }) => type === sectionType)?.hint
            }
          />
        </label>
      </div>
      <button
        className="button button-secondary"
        type="submit"
        disabled={busy || !sectionTitle.trim() || actor.id === "pending"}
      >
        Add section
      </button>
    </form>
  );

  return (
    <main className="case-page">
      <div className="case-page-body">
      <header className="case-header">
        <div className="case-header-top">
          <Link className="wordmark" to="/">
            BYNOTE
          </Link>
          <div className="header-actions">
            <HowItWorks />
            <button
              className="text-button"
              type="button"
              title="Download a JSON file to move or share this notebook. A copied link does not include your notes."
              onClick={() => downloadNotebook(room.state)}
            >
              Export
            </button>
            <button
              className={
                pendingDelete
                  ? "text-button notebook-delete-confirm"
                  : "text-button"
              }
              type="button"
              onClick={deleteNotebook}
              onBlur={() => setPendingDelete(false)}
            >
              {pendingDelete ? "Confirm delete" : "Delete"}
            </button>
          </div>
        </div>

        <div className="case-title-row">
          <div>
            <p className="eyebrow">
              {notebookKind}
              {showSeverity
                ? ` · ${severityLabel(room.state.severity)} severity`
                : " notebook"}
            </p>
            <h1>{room.state.title}</h1>
            {room.state.summary ? <p>{room.state.summary}</p> : null}
          </div>

          <label className="status-control">
            <span>Status</span>
            <select
              value={room.state.status}
              onChange={(event) =>
                void changeStatus(event.target.value as CaseStatus)
              }
              disabled={busy}
            >
              {statusOptions(room.state.kind).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="case-user-row">
          <label className="identity-control">
            <span>Your name</span>
            <input
              value={nameDraft}
              maxLength={48}
              aria-describedby="name-hint"
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
            <small id="name-hint">Notes are signed with this name.</small>
          </label>

          {showAuthors ? (
            <div className="author-filter" aria-label="Filter by author">
              <span>Show notes by</span>
              <div className="participant-chips">
                {authors.map((participant) => {
                  const key = actorKey(participant);
                  return (
                    <button
                      key={key}
                      className={`actor-chip ${toneFor(participant)} ${
                        authorFilter === key ? "actor-chip-active" : ""
                      }`}
                      type="button"
                      aria-pressed={authorFilter === key}
                      aria-label={`Show notes from ${participant.name}${
                        participant.kind === "agent" ? ", agent" : ""
                      }`}
                      onClick={() =>
                        setAuthorFilter(authorFilter === key ? "all" : key)
                      }
                    >
                      <span>{participant.name}</span>
                      {participant.kind === "agent" ? (
                        <em>agent</em>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="page-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="notebook-layout">
        {room.state.sections.length ? (
          <>
            {room.state.sections.map((section) => (
              <NotebookSection
                key={section.id}
                section={section}
                room={room}
                actor={actor}
                busy={busy}
                authorFilter={authorFilter}
                handleComposer={handleComposer}
                changeTask={changeTask}
                acceptResolution={acceptResolution}
                submitAction={submitAction}
                toneFor={toneFor}
              />
            ))}
            {addSectionForm}
          </>
        ) : (
          <div className="empty-notebook">
            <h2>No sections yet</h2>
            <p>
              Add a note, a task list, or whatever this page needs. An agent
              that supports WebMCP can set this up too.
            </p>
            {addSectionForm}
          </div>
        )}
      </div>
      </div>

      <SiteFooter
        status={webMcp.status}
        toolCount={webMcp.toolCount}
        prompt={notebookAgentPrompt()}
      />
    </main>
  );
}

function NotebookSection({
  section,
  room,
  actor,
  busy,
  authorFilter,
  handleComposer,
  changeTask,
  acceptResolution,
  submitAction,
  toneFor,
}: {
  section: Section;
  room: ReturnType<typeof useCaseRoom>;
  actor: Actor;
  busy: boolean;
  authorFilter: string;
  handleComposer: (kind: ComposerKind, value: string) => Promise<void>;
  changeTask: (taskId: string, status: TaskStatus) => Promise<void>;
  acceptResolution: (entryId: string) => Promise<void>;
  submitAction: (action: CaseAction) => Promise<void>;
  toneFor: (participant: Actor) => string;
}) {
  const matchesAuthor = (author: Actor) =>
    authorFilter === "all" || actorKey(author) === authorFilter;

  if (section.type === "timeline" || section.type === "findings") {
    const items = room.state.entries
      .filter((entry) => {
        if (!matchesAuthor(entry.author)) {
          return false;
        }
        if (section.type === "findings") {
          return entry.kind === "finding";
        }
        return true;
      })
      .toReversed();
    const kinds: ComposerKind[] =
      section.type === "findings"
        ? ["finding"]
        : ["update", "finding", "hypothesis", "task", "resolution"];

    return (
      <section className="notebook-section" aria-labelledby={section.id}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {section.type === "findings" ? "Verified facts" : "Activity"}
            </p>
            <h2 id={section.id}>{section.title}</h2>
          </div>
          <span>
            {items.length}
            {authorFilter === "all" ? "" : ` filtered`}
          </span>
        </div>
        <Composer
          kinds={kinds}
          actor={actor}
          busy={busy}
          onSubmit={handleComposer}
        />
        {items.length ? (
          <EntryList
            items={items}
            busy={busy}
            toneFor={toneFor}
            acceptResolution={acceptResolution}
          />
        ) : (
          <p className="empty-copy">Nothing in this section yet.</p>
        )}
      </section>
    );
  }

  if (section.type === "hypotheses") {
    const items = room.state.hypotheses.filter(({ author }) =>
      matchesAuthor(author),
    );
    return (
      <section className="notebook-section" aria-labelledby={section.id}>
        <div className="section-heading compact">
          <h2 id={section.id}>{section.title}</h2>
          <span>{items.length}</span>
        </div>
        <Composer
          kinds={["hypothesis"]}
          actor={actor}
          busy={busy}
          onSubmit={handleComposer}
        />
        {items.length ? (
          <ol className="focus-list">
            {items.map((hypothesis) => (
              <li key={hypothesis.id} className={toneFor(hypothesis.author)}>
                <div className="focus-item-top">
                  <span>{hypothesis.confidence} confidence</span>
                  <span>{hypothesis.status}</span>
                </div>
                <strong>{hypothesis.title}</strong>
                {hypothesis.detail ? <p>{hypothesis.detail}</p> : null}
                <small className="author-mini">
                  <i aria-hidden="true">
                    {hypothesis.author.kind === "agent" ? "A" : "H"}
                  </i>
                  {hypothesis.author.name} / {timeLabel(hypothesis.createdAt)}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">No hypotheses yet.</p>
        )}
      </section>
    );
  }

  if (section.type === "tasks") {
    const items = room.state.tasks.filter(({ author }) =>
      matchesAuthor(author),
    );
    return (
      <section className="notebook-section" aria-labelledby={section.id}>
        <div className="section-heading compact">
          <h2 id={section.id}>{section.title}</h2>
          <span>{items.length}</span>
        </div>
        <Composer
          kinds={["task"]}
          actor={actor}
          busy={busy}
          onSubmit={handleComposer}
        />
        {items.length ? (
          <ol className="task-list">
            {items.map((task) => (
              <li key={task.id} className={toneFor(task.author)}>
                <strong>{task.title}</strong>
                <div>
                  <select
                    aria-label={`Status for ${task.title}`}
                    className={`task-status task-status-${task.status}`}
                    value={task.status}
                    disabled={busy}
                    onChange={(event) =>
                      void changeTask(
                        task.id,
                        event.target.value as TaskStatus,
                      )
                    }
                  >
                    <option value="open">Open</option>
                    <option value="doing">Doing</option>
                    <option value="done">Done</option>
                  </select>
                  <span className="task-byline">
                    <small className="author-mini">
                      <i aria-hidden="true">
                        {task.author.kind === "agent" ? "A" : "H"}
                      </i>
                      {task.author.name}
                    </small>
                    {task.assignee && task.assignee !== task.author.name ? (
                      <small>Assigned to {task.assignee}</small>
                    ) : null}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">No tasks yet.</p>
        )}
      </section>
    );
  }

  if (section.type === "note") {
    const items = room.state.notes.filter(
      (item) => item.sectionId === section.id && matchesAuthor(item.author),
    );
    return (
      <section className="notebook-section" aria-labelledby={section.id}>
        <div className="section-heading compact">
          <h2 id={section.id}>{section.title}</h2>
          <span>{items.length}</span>
        </div>
        <SectionTextForm
          placeholder="Write a note"
          disabled={busy || actor.id === "pending"}
          onSubmit={(value) =>
            submitAction({
              type: "add_note",
              sectionId: section.id,
              body: value,
              actor,
              source: "human-ui",
            })
          }
        />
        {items.length ? (
          <ol className="focus-list">
            {items.toReversed().map((item) => (
              <li key={item.id} className={toneFor(item.author)}>
                <p>{item.body}</p>
                <small className="author-mini">
                  <i aria-hidden="true">
                    {item.author.kind === "agent" ? "A" : "H"}
                  </i>
                  {item.author.name} / {timeLabel(item.createdAt)}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">Empty note.</p>
        )}
      </section>
    );
  }

  if (section.type === "decisions") {
    const items = room.state.decisions.filter(
      (item) => item.sectionId === section.id && matchesAuthor(item.author),
    );
    const proposals = room.state.entries.filter(
      (item) =>
        item.kind === "resolution-proposal" && matchesAuthor(item.author),
    );
    return (
      <section className="notebook-section" aria-labelledby={section.id}>
        <div className="section-heading compact">
          <h2 id={section.id}>{section.title}</h2>
          <span>{items.length + proposals.length}</span>
        </div>
        <SectionTextForm
          placeholder="What was decided?"
          disabled={busy || actor.id === "pending"}
          onSubmit={(value) =>
            submitAction({
              type: "add_decision",
              sectionId: section.id,
              body: value,
              actor,
              source: "human-ui",
            })
          }
        />
        {proposals.length ? (
          <EntryList
            items={proposals.toReversed()}
            busy={busy}
            toneFor={toneFor}
            acceptResolution={acceptResolution}
          />
        ) : null}
        {items.length ? (
          <ol className="focus-list">
            {items.toReversed().map((item) => (
              <li key={item.id} className={toneFor(item.author)}>
                <p>{item.body}</p>
                <small className="author-mini">
                  <i aria-hidden="true">
                    {item.author.kind === "agent" ? "A" : "H"}
                  </i>
                  {item.author.name} / {timeLabel(item.createdAt)}
                </small>
              </li>
            ))}
          </ol>
        ) : null}
        {!items.length && !proposals.length ? (
          <p className="empty-copy">No decisions yet.</p>
        ) : null}
      </section>
    );
  }

  const items = room.state.checklists.filter(
    (item) => item.sectionId === section.id && matchesAuthor(item.author),
  );
  return (
    <section className="notebook-section" aria-labelledby={section.id}>
      <div className="section-heading compact">
        <h2 id={section.id}>{section.title}</h2>
        <span>
          {items.filter(({ done }) => done).length}/{items.length}
        </span>
      </div>
      <SectionTextForm
        placeholder="Add an item"
        disabled={busy || actor.id === "pending"}
        onSubmit={(value) =>
          submitAction({
            type: "add_checklist_item",
            sectionId: section.id,
            title: value,
            actor,
            source: "human-ui",
          })
        }
      />
      {items.length ? (
        <ul className="checklist">
          {items.map((item) => (
            <li key={item.id} className={toneFor(item.author)}>
              <label>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={busy}
                  onChange={() =>
                    void submitAction({
                      type: "toggle_checklist_item",
                      itemId: item.id,
                      actor,
                      source: "human-ui",
                    })
                  }
                />
                <span className={item.done ? "checklist-done" : ""}>
                  {item.title}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">No checklist items yet.</p>
      )}
    </section>
  );
}

function Composer({
  kinds,
  actor,
  busy,
  onSubmit,
}: {
  kinds: ComposerKind[];
  actor: Actor;
  busy: boolean;
  onSubmit: (kind: ComposerKind, value: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<ComposerKind>(kinds[0] ?? "update");
  const [body, setBody] = useState("");
  const active = kinds.includes(kind) ? kind : (kinds[0] ?? "update");

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        const value = body.trim();
        if (!value) {
          return;
        }
        void onSubmit(active, value).then(() => setBody(""));
      }}
    >
      <div className="composer-top">
        {kinds.length > 1 ? (
          <label>
            <span className="sr-only">Entry type</span>
            <select
              value={active}
              onChange={(event) =>
                setKind(event.target.value as ComposerKind)
              }
            >
              {kinds.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span>{composerLabels[active]}</span>
        )}
        <span>{actor.name}</span>
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={composerPlaceholders[active]}
        maxLength={2_000}
        rows={3}
      />
      <div className="composer-actions">
        <span>{body.length}/2000</span>
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || !body.trim() || actor.id === "pending"}
        >
          {busy ? "Saving..." : composerLabels[active]}
        </button>
      </div>
    </form>
  );
}

function SectionTextForm({
  placeholder,
  disabled,
  onSubmit,
}: {
  placeholder: string;
  disabled: boolean;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (!next) {
          return;
        }
        void onSubmit(next).then(() => setValue(""));
      }}
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        maxLength={4_000}
        rows={3}
        disabled={disabled}
      />
      <div className="composer-actions">
        <span>{value.length}/4000</span>
        <button
          className="button button-primary"
          type="submit"
          disabled={disabled || !value.trim()}
        >
          Add
        </button>
      </div>
    </form>
  );
}

function EntryList({
  items,
  busy,
  toneFor,
  acceptResolution,
}: {
  items: CaseEntry[];
  busy: boolean;
  toneFor: (participant: Actor) => string;
  acceptResolution: (entryId: string) => Promise<void>;
}) {
  return (
    <ol className="byline-rail">
      {items.map((item) => (
        <li
          key={item.id}
          className={`entry entry-${item.kind} entry-${item.author.kind} ${toneFor(item.author)}`}
        >
          <div className="entry-marker" aria-hidden="true">
            {item.author.kind === "agent" ? "A" : "H"}
          </div>
          <article>
            <header>
              <span className="entry-kind">{entryLabels[item.kind]}</span>
              <time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
            </header>
            <p>{item.body}</p>
            <footer>
              <strong className="author-label">{item.author.name}</strong>
              <span className="role-label">
                {item.source === "webmcp" ? "Agent via WebMCP" : "Human"}
              </span>
            </footer>
            {item.kind === "resolution-proposal" ? (
              item.acceptedAt ? (
                <p className="accepted-label">
                  Accepted by {item.acceptedBy?.name || "Human"}
                </p>
              ) : (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => void acceptResolution(item.id)}
                >
                  Accept resolution
                </button>
              )
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
