import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router";

import { useActor } from "../hooks/use-actor";
import { useCaseRoom } from "../hooks/use-case-room";
import { useWebMcp } from "../hooks/use-webmcp";
import { getCase } from "../lib/cases.server";
import type {
  Actor,
  CaseAction,
  CaseEntry,
  CaseStatusSchema,
  TaskStatusSchema,
} from "../../src/shared/schemas";
import type { z } from "zod";
import type { Route } from "./+types/case";

type ComposerKind =
  | "update"
  | "finding"
  | "hypothesis"
  | "task"
  | "resolution";
type CaseStatus = z.infer<typeof CaseStatusSchema>;
type TaskStatus = z.infer<typeof TaskStatusSchema>;
type WorkFilter = "all" | "finding" | "update" | "task" | "resolution";

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
  resolution: "What should resolve this case?",
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

function matchesWorkFilter(entry: CaseEntry, filter: WorkFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "update") {
    return entry.kind === "update" || entry.kind === "status-change";
  }
  if (filter === "task") {
    return entry.kind === "task-change";
  }
  if (filter === "resolution") {
    return entry.kind === "resolution-proposal";
  }
  return entry.kind === "finding";
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData ? `${loaderData.title} | Byline` : "Case | Byline",
    },
    {
      name: "description",
      content: "A shared case for people and browser agents.",
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const state = await getCase(params.caseId);
  if (!state) {
    throw new Response("Case not found", { status: 404 });
  }
  return state;
}

export default function CaseRoom({ loaderData }: Route.ComponentProps) {
  const { actor, setName } = useActor();
  const room = useCaseRoom(loaderData);
  const webMcpStatus = useWebMcp({
    actor,
    getState: room.getState,
    submit: room.submit,
  });
  const [composerKind, setComposerKind] =
    useState<ComposerKind>("update");
  const [body, setBody] = useState("");
  const [nameDraft, setNameDraft] = useState(actor.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [authorFilter, setAuthorFilter] = useState("all");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("all");

  useEffect(() => {
    setNameDraft(actor.name);
  }, [actor.name]);

  useEffect(() => {
    if (actor.id === "pending") {
      return;
    }

    room
      .submit({ type: "join", actor, source: "human-ui" })
      .catch(() => setError("Could not join the case."));
  }, [actor.id, actor.name, room.submit]);

  const activeProposals = useMemo(
    () =>
      room.state.entries.filter(
        ({ kind, acceptedAt }) =>
          kind === "resolution-proposal" && !acceptedAt,
      ),
    [room.state.entries],
  );
  const contributors = useMemo(() => {
    const people = [
      ...room.state.participants.map(({ actor: participant }) => participant),
      ...room.state.entries.map(({ author }) => author),
      ...room.state.hypotheses.map(({ author }) => author),
      ...room.state.tasks.map(({ author }) => author),
    ];
    const unique = new Map<string, Actor>();
    for (const person of people) {
      unique.set(actorKey(person), person);
    }
    return [...unique.values()];
  }, [
    room.state.entries,
    room.state.hypotheses,
    room.state.participants,
    room.state.tasks,
  ]);
  const contributorTones = useMemo(
    () =>
      new Map(
        contributors.map((participant, index) => [
          actorKey(participant),
          `tone-${index % 5}`,
        ]),
      ),
    [contributors],
  );
  const toneFor = (participant: Actor) =>
    contributorTones.get(actorKey(participant)) ?? actorTone(participant.name);
  const visibleEntries = useMemo(
    () =>
      room.state.entries
        .filter(
          (entry) =>
            (authorFilter === "all" ||
              actorKey(entry.author) === authorFilter) &&
            matchesWorkFilter(entry, workFilter),
        )
        .toReversed(),
    [authorFilter, room.state.entries, workFilter],
  );
  const visibleHypotheses = useMemo(
    () =>
      room.state.hypotheses.filter(
        ({ author }) =>
          authorFilter === "all" || actorKey(author) === authorFilter,
      ),
    [authorFilter, room.state.hypotheses],
  );
  const visibleTasks = useMemo(
    () =>
      room.state.tasks.filter(
        ({ author }) =>
          authorFilter === "all" || actorKey(author) === authorFilter,
      ),
    [authorFilter, room.state.tasks],
  );

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

  const handleComposer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = body.trim();
    if (!value || actor.id === "pending") {
      return;
    }

    let action: CaseAction;
    switch (composerKind) {
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
      setBody("");
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("Copy the link from the address bar.");
    }
  };

  const saveName = () => {
    setName(nameDraft);
  };

  return (
    <main className="case-page">
      <header className="case-header">
        <div className="case-header-top">
          <Link className="wordmark" to="/">
            BYLINE
          </Link>
          <div className="header-actions">
            <span className={`live-state live-state-${room.connection}`}>
              {room.connection === "live" ? "Live" : room.connection}
            </span>
            <button className="text-button" type="button" onClick={copyLink}>
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="case-title-row">
          <div>
            <p className="eyebrow">
              {room.state.kind} / {room.state.severity}
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
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>

        <div className="case-meta-row">
          <label className="identity-control">
            <span>Working as</span>
            <input
              value={nameDraft}
              maxLength={48}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>

          <div className="participants" aria-label="Case participants">
            <span>In this case</span>
            <div className="participant-chips">
              {contributors.map((participant) => {
                const key = actorKey(participant);
                return (
                  <button
                    key={key}
                    className={`actor-chip ${toneFor(participant)} ${
                      authorFilter === key ? "actor-chip-active" : ""
                    }`}
                    type="button"
                    aria-pressed={authorFilter === key}
                    aria-label={`Show work from ${participant.name}, ${participant.kind}`}
                    onClick={() =>
                      setAuthorFilter(authorFilter === key ? "all" : key)
                    }
                  >
                    <i aria-hidden="true">
                      {participant.kind === "agent" ? "A" : "H"}
                    </i>
                    <span>{participant.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`agent-state agent-state-${webMcpStatus}`}>
            <span>Agent tools</span>
            <strong>
              {webMcpStatus === "ready"
                ? "Ready"
                : webMcpStatus === "unavailable"
                  ? "Unavailable"
                  : webMcpStatus === "error"
                    ? "Blocked"
                    : "Checking"}
            </strong>
          </div>
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

      <div className="case-layout">
        <section className="workstream" aria-labelledby="workstream-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Shared record</p>
              <h2 id="workstream-title">Workstream</h2>
            </div>
            <span>Revision {room.state.revision}</span>
          </div>

          <div className="filter-bar" aria-label="Workstream filters">
            <label>
              <span>Contributor</span>
              <select
                value={authorFilter}
                onChange={(event) => setAuthorFilter(event.target.value)}
              >
                <option value="all">Everyone</option>
                {contributors.map((participant) => (
                  <option
                    key={actorKey(participant)}
                    value={actorKey(participant)}
                  >
                    {participant.name} ({statusLabel(participant.kind)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Work type</span>
              <select
                value={workFilter}
                onChange={(event) =>
                  setWorkFilter(event.target.value as WorkFilter)
                }
              >
                <option value="all">All work</option>
                <option value="finding">Findings</option>
                <option value="update">Updates</option>
                <option value="task">Task changes</option>
                <option value="resolution">Resolutions</option>
              </select>
            </label>
            <div className="filter-summary">
              <span className="filter-count">
                {authorFilter === "all" && workFilter === "all"
                  ? `${room.state.entries.length} entries`
                  : `${visibleEntries.length} of ${room.state.entries.length}`}
              </span>
              {authorFilter !== "all" || workFilter !== "all" ? (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setAuthorFilter("all");
                    setWorkFilter("all");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          <form className="composer" onSubmit={handleComposer}>
            <div className="composer-top">
              <label>
                <span className="sr-only">Entry type</span>
                <select
                  value={composerKind}
                  onChange={(event) =>
                    setComposerKind(event.target.value as ComposerKind)
                  }
                >
                  <option value="update">Update</option>
                  <option value="finding">Finding</option>
                  <option value="hypothesis">Hypothesis</option>
                  <option value="task">Task</option>
                  <option value="resolution">Resolution</option>
                </select>
              </label>
              <span>{actor.name}</span>
            </div>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={composerPlaceholders[composerKind]}
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
                {busy ? "Saving..." : composerLabels[composerKind]}
              </button>
            </div>
          </form>

          {visibleEntries.length ? (
            <ol className="byline-rail">
              {visibleEntries.map((item) => (
              <li
                key={item.id}
                className={`entry entry-${item.kind} entry-${item.author.kind} ${toneFor(item.author)}`}
              >
                <div className="entry-marker" aria-hidden="true">
                  {item.author.kind === "agent" ? "A" : "H"}
                </div>
                <article>
                  <header>
                    <span className="entry-kind">
                      {entryLabels[item.kind]}
                    </span>
                    <time dateTime={item.createdAt}>
                      {timeLabel(item.createdAt)}
                    </time>
                  </header>
                  <p>{item.body}</p>
                  <footer>
                    <strong className="author-label">{item.author.name}</strong>
                    <span className="role-label">
                      {item.source === "webmcp"
                        ? "Agent via WebMCP"
                        : "Human"}
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
          ) : (
            <p className="filtered-empty">No work matches these filters.</p>
          )}
        </section>

        <aside className="focus-panel">
          <section aria-labelledby="hypotheses-title">
            <div className="section-heading compact">
              <h2 id="hypotheses-title">Hypotheses</h2>
              <span>
                {authorFilter === "all"
                  ? room.state.hypotheses.length
                  : `${visibleHypotheses.length}/${room.state.hypotheses.length}`}
              </span>
            </div>
            {visibleHypotheses.length ? (
              <ol className="focus-list">
                {visibleHypotheses.map((hypothesis) => (
                  <li
                    key={hypothesis.id}
                    className={toneFor(hypothesis.author)}
                  >
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
              <p className="empty-copy">No hypotheses in this view.</p>
            )}
          </section>

          <section aria-labelledby="tasks-title">
            <div className="section-heading compact">
              <h2 id="tasks-title">Tasks</h2>
              <span>
                {authorFilter === "all"
                  ? room.state.tasks.length
                  : `${visibleTasks.length}/${room.state.tasks.length}`}
              </span>
            </div>
            {visibleTasks.length ? (
              <ol className="task-list">
                {visibleTasks.map((task) => (
                  <li
                    key={task.id}
                    className={toneFor(task.author)}
                  >
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
                        {task.assignee &&
                        task.assignee !== task.author.name ? (
                          <small>Assigned to {task.assignee}</small>
                        ) : null}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-copy">No tasks in this view.</p>
            )}
          </section>

          <section className="agent-help" aria-labelledby="agent-help-title">
            <p className="eyebrow">Browser agent</p>
            <h2 id="agent-help-title">Try this prompt</h2>
            <p>
              Read this case. Join as Scout. Add one finding, one hypothesis,
              and one task.
            </p>
            {activeProposals.length ? (
              <small>{activeProposals.length} resolution waiting for review.</small>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}
