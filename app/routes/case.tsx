import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { readStoredActorName, useActor } from "../hooks/use-actor";
import { useCaseRoom } from "../hooks/use-case-room";
import { useWebMcp } from "../hooks/use-webmcp";
import { HowItWorks } from "../components/how-it-works";
import { MarkdownBody } from "../components/markdown-body";
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
  sectionCopy,
  severityLabel,
  statusOptions,
} from "../../src/shared/templates";
import {
  ENTRY_BODY_MAX,
  NOTE_BODY_MAX,
  type Actor,
  type CaseAction,
  type CaseEntry,
  type CaseState,
  type CaseStatusSchema,
  type NoteItem,
  type Section,
  type SectionType,
  type TaskStatusSchema,
} from "../../src/shared/schemas";
import { splitDiffRows } from "../../src/shared/note-history";
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
  update: "What changed? Markdown and mermaid work.",
  finding: "What did you verify? Markdown and mermaid work.",
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
              Add a note, a task list, or whatever this page needs. Notes can
              use markdown and mermaid diagrams. An agent that supports WebMCP
              can set this up too.
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

function SectionHeading({
  section,
  count,
}: {
  section: Section;
  count: ReactNode;
}) {
  const copy = sectionCopy(section.type);
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow" title={copy.hint}>
          {copy.label}
        </p>
        <h2 id={section.id}>{section.title}</h2>
      </div>
      {count != null && count !== "" ? <span>{count}</span> : null}
    </div>
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
      <section
        className="notebook-section"
        data-section-type={section.type}
        aria-labelledby={section.id}
      >
        <SectionHeading section={section} count={
            <>
              {items.length}
              {authorFilter === "all" ? "" : " filtered"}
            </>
          }
        />
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
      <section
        className="notebook-section"
        data-section-type={section.type}
        aria-labelledby={section.id}
      >
        <SectionHeading section={section} count={items.length} />
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
                {hypothesis.detail ? (
                  <MarkdownBody source={hypothesis.detail} />
                ) : null}
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
      <section
        className="notebook-section"
        data-section-type={section.type}
        aria-labelledby={section.id}
      >
        <SectionHeading section={section} count={items.length} />
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
      <section
        className="notebook-section"
        data-section-type={section.type}
        aria-labelledby={section.id}
      >
        <SectionHeading section={section} count={items.length} />
        <SectionTextForm
          placeholder="Write a note. Headings, lists, checkboxes, and mermaid diagrams work."
          disabled={busy || actor.id === "pending"}
          markdown
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
              <NoteCard
                key={item.id}
                item={item}
                busy={busy}
                actor={actor}
                tone={toneFor(item.author)}
                onAction={submitAction}
              />
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
      <section
        className="notebook-section"
        data-section-type={section.type}
        aria-labelledby={section.id}
      >
        <SectionHeading
          section={section}
          count={items.length + proposals.length}
        />
        <SectionTextForm
          placeholder="What was decided? Markdown and mermaid work."
          disabled={busy || actor.id === "pending"}
          markdown
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
                <MarkdownBody source={item.body} />
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
    <section
      className="notebook-section"
      data-section-type={section.type}
      aria-labelledby={section.id}
    >
      <SectionHeading
        section={section}
        count={`${items.filter(({ done }) => done).length}/${items.length}`}
      />
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
  const [preview, setPreview] = useState(false);
  const active = kinds.includes(kind) ? kind : (kinds[0] ?? "update");
  const canPreview =
    active === "update" || active === "finding" || active === "resolution";
  const limit =
    active === "task" ? 240 : active === "hypothesis" ? 180 : ENTRY_BODY_MAX;

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        const value = body.trim();
        if (!value) {
          return;
        }
        void onSubmit(active, value).then(() => {
          setBody("");
          setPreview(false);
        });
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
        <div className="composer-top-end">
          {canPreview ? (
            <button
              className={preview ? "text-button composer-preview-on" : "text-button"}
              type="button"
              aria-pressed={preview}
              onClick={() => setPreview((open) => !open)}
            >
              {preview ? "Write" : "Preview"}
            </button>
          ) : null}
          <span>{actor.name}</span>
        </div>
      </div>
      {preview && canPreview ? (
        <div className="composer-preview">
          {body.trim() ? (
            <MarkdownBody source={body} />
          ) : (
            <p className="empty-copy">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={composerPlaceholders[active]}
          maxLength={limit}
          rows={3}
        />
      )}
      <div className="composer-actions">
        <span>
          {body.length}/{limit}
          {canPreview ? " · Markdown" : ""}
        </span>
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

function NoteCard({
  item,
  busy,
  actor,
  tone,
  onAction,
}: {
  item: NoteItem;
  busy: boolean;
  actor: Actor;
  tone: string;
  onAction: (action: CaseAction) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canWrite = !busy && actor.id !== "pending";
  const updatedAt = item.updatedAt;
  const updatedBy = item.updatedBy;
  const hasHistory = Boolean(updatedAt && item.revisions?.length);

  return (
    <li className={tone}>
      {editing ? (
        <NoteEditForm
          initial={item.body}
          disabled={!canWrite}
          onSubmit={(body) =>
            onAction({
              type: "revise_note",
              noteId: item.id,
              body,
              actor,
              source: "human-ui",
            }).then(() => {
              setEditing(false);
            })
          }
          onCancel={() => setEditing(false)}
        />
      ) : (
        <MarkdownBody
          source={item.body}
          onToggleTask={
            canWrite
              ? (taskIndex) => {
                  void onAction({
                    type: "toggle_note_task",
                    noteId: item.id,
                    taskIndex,
                    actor,
                    source: "human-ui",
                  });
                }
              : undefined
          }
        />
      )}
      <div className="note-meta">
        <small className="author-mini">
          <i aria-hidden="true">{item.author.kind === "agent" ? "A" : "H"}</i>
          {item.author.name} / {timeLabel(item.createdAt)}
        </small>
        {updatedAt ? (
          <small className="note-updated">
            {updatedBy && updatedBy.id !== item.author.id
              ? `Updated ${timeLabel(updatedAt)} · ${updatedBy.name}`
              : `Updated ${timeLabel(updatedAt)}`}
          </small>
        ) : null}
        {editing ? null : (
          <div className="note-meta-actions">
            {hasHistory ? (
              <button
                className="text-button"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen(true)}
              >
                History
              </button>
            ) : null}
            <button
              className="text-button"
              type="button"
              disabled={!canWrite}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          </div>
        )}
      </div>
      {hasHistory ? (
        <NoteHistoryDialog
          item={item}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </li>
  );
}

function NoteEditForm({
  initial,
  disabled,
  onSubmit,
  onCancel,
}: {
  initial: string;
  disabled: boolean;
  onSubmit: (value: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [preview, setPreview] = useState(false);
  const trimmed = value.trim();
  const unchanged = trimmed === initial.trim();

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || unchanged) {
          return;
        }
        void onSubmit(trimmed);
      }}
    >
      <div className="composer-top">
        <span>Markdown</span>
        <button
          className={preview ? "text-button composer-preview-on" : "text-button"}
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview((open) => !open)}
        >
          {preview ? "Write" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="composer-preview">
          {trimmed ? (
            <MarkdownBody source={value} />
          ) : (
            <p className="empty-copy">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={NOTE_BODY_MAX}
          rows={6}
          disabled={disabled}
        />
      )}
      <div className="composer-actions">
        <span>
          {value.length}/{NOTE_BODY_MAX} · Markdown
        </span>
        <div className="note-edit-actions">
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={disabled || !trimmed || unchanged}
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}

function revisionCaption(
  revision: { author: Actor; createdAt: string },
  index: number,
  last: boolean,
) {
  if (index === 0) {
    return {
      title: "Original",
      meta: `${revision.author.name} / ${timeLabel(revision.createdAt)}`,
    };
  }

  return {
    title: last ? `${revision.author.name} · Current` : revision.author.name,
    meta: timeLabel(revision.createdAt),
  };
}

function NoteHistoryDialog({
  item,
  open,
  onClose,
}: {
  item: NoteItem;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const revisions = item.revisions ?? [];
  const lastIndex = Math.max(revisions.length - 1, 1);
  const [selected, setSelected] = useState(lastIndex);
  const [expanded, setExpanded] = useState(false);
  const selectedIndex = Math.min(Math.max(selected, 1), lastIndex);
  const before = revisions[selectedIndex - 1];
  const after = revisions[selectedIndex];
  const rows =
    before && after ? splitDiffRows(before.body, after.body) : [];
  const beforeCaption = before
    ? revisionCaption(before, selectedIndex - 1, false)
    : null;
  const afterCaption = after
    ? revisionCaption(after, selectedIndex, selectedIndex === lastIndex)
    : null;

  useEffect(() => {
    const node = dialog.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      setSelected(Math.max((item.revisions?.length ?? 1) - 1, 1));
      node.showModal();
    }
    if (!open && node.open) {
      node.close();
      setExpanded(false);
    }
  }, [item.revisions?.length, open]);

  return (
    <dialog
      ref={dialog}
      className={
        expanded ? "note-history-dialog note-history-dialog-wide" : "note-history-dialog"
      }
      aria-labelledby={`note-history-${item.id}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
    >
      <div className="note-history-body">
        <div className="note-history-top">
          <p className="eyebrow">Note history</p>
          <div className="note-history-top-actions">
            <button
              className="text-button"
              type="button"
              aria-pressed={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? "Shrink" : "Expand"}
            </button>
            <form method="dialog">
              <button className="text-button" type="submit">
                Close
              </button>
            </form>
          </div>
        </div>
        <h2 id={`note-history-${item.id}`}>What changed</h2>
        {revisions.length > 2 ? (
          <div className="note-history-steps" role="tablist" aria-label="Versions">
            {revisions.slice(1).map((revision, offset) => {
              const index = offset + 1;
              const current = index === lastIndex;
              return (
                <button
                  key={`${revision.createdAt}-${index}`}
                  className={
                    index === selectedIndex
                      ? "note-history-step note-history-step-on"
                      : "note-history-step"
                  }
                  type="button"
                  role="tab"
                  aria-selected={index === selectedIndex}
                  onClick={() => setSelected(index)}
                >
                  {current ? "Current" : revision.author.name}
                  <span>{timeLabel(revision.createdAt)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {beforeCaption && afterCaption ? (
          <div className="note-history-compare">
            <div className="note-history-compare-head">
              <div>
                <strong>{beforeCaption.title}</strong>
                <span>{beforeCaption.meta}</span>
              </div>
              <div>
                <strong>{afterCaption.title}</strong>
                <span>{afterCaption.meta}</span>
              </div>
            </div>
            <div
              className="note-history-compare-body"
              tabIndex={0}
              aria-label="Compared versions"
            >
              {rows.map((row, rowIndex) => (
                <div className="note-history-row" key={rowIndex}>
                  <pre
                    className={
                      row.left
                        ? `note-history-cell note-history-cell-${row.left.kind}`
                        : "note-history-cell note-history-cell-empty"
                    }
                  >
                    {row.left?.text || " "}
                  </pre>
                  <pre
                    className={
                      row.right
                        ? `note-history-cell note-history-cell-${row.right.kind}`
                        : "note-history-cell note-history-cell-empty"
                    }
                  >
                    {row.right?.text || " "}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

function SectionTextForm({
  placeholder,
  disabled,
  markdown = false,
  onSubmit,
}: {
  placeholder: string;
  disabled: boolean;
  markdown?: boolean;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState(false);
  const limit = markdown ? NOTE_BODY_MAX : 240;

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (!next) {
          return;
        }
        void onSubmit(next).then(() => {
          setValue("");
          setPreview(false);
        });
      }}
    >
      {markdown ? (
        <div className="composer-top">
          <span>Markdown</span>
          <button
            className={preview ? "text-button composer-preview-on" : "text-button"}
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview((open) => !open)}
          >
            {preview ? "Write" : "Preview"}
          </button>
        </div>
      ) : null}
      {preview && markdown ? (
        <div className="composer-preview">
          {value.trim() ? (
            <MarkdownBody source={value} />
          ) : (
            <p className="empty-copy">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          maxLength={limit}
          rows={3}
          disabled={disabled}
        />
      )}
      <div className="composer-actions">
        <span>
          {value.length}/{limit}
          {markdown ? " · Markdown" : ""}
        </span>
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
            <MarkdownBody source={item.body} />
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
