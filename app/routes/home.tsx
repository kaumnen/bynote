import { Link, useNavigate } from "react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createLocalNotebook,
  importNotebookFile,
  listLocalNotebooks,
  openDemoNotebook,
  openNotebookInTab,
  readLocalNotebook,
  readOpenNotebookId,
  removeLocalNotebook,
  setOpenNotebook,
  type NotebookSummary,
} from "../lib/local-notebook";
import {
  DEMO_DEFAULTS,
  DEMO_KINDS,
  demoLabel,
  isDefaultDemoTitle,
  type DemoKind,
} from "../../src/shared/demos";
import { readStoredActorName } from "../hooks/use-actor";
import { useWebMcp } from "../hooks/use-webmcp";
import { HowItWorks } from "../components/how-it-works";
import { SiteFooter } from "../components/site-footer";
import { libraryAgentPrompt } from "../webmcp/prompts";
import { registerLibraryTools } from "../webmcp/register-library-tools";
import {
  createFieldCopy,
  defaultSeverityFor,
  kindLabel,
  kindUsesSeverity,
} from "../../src/shared/templates";
import {
  CreateCaseInputSchema,
  type CaseState,
  type CreateCaseInput,
} from "../../src/shared/schemas";
import type { Route } from "./+types/home";

function createdLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function meta() {
  return [
    { title: "Bynote | Local agent notebook" },
    {
      name: "description",
      content:
        "A local notebook where you and your agents can track incidents, bugs, and feature work. Export a JSON file to share it.",
    },
  ];
}

export default function Home(_props: Route.ComponentProps) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const demoPicker = useRef<HTMLDivElement>(null);
  const demoDialog = useRef<HTMLDialogElement>(null);
  const demoNameInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState("");
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [demoKind, setDemoKind] = useState<DemoKind | null>(null);
  const [demoName, setDemoName] = useState("");
  const [kind, setKind] = useState<CreateCaseInput["kind"]>("incident");
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const fieldCopy = createFieldCopy(kind);
  const showSeverity = kindUsesSeverity(kind);
  const webMcp = useWebMcp((modelContext) =>
    registerLibraryTools({
      modelContext,
      list: listLocalNotebooks,
      create: createLocalNotebook,
      openInTab: openNotebookInTab,
      openId: readOpenNotebookId,
      creatorName: readStoredActorName,
    }),
  );

  useEffect(() => {
    setNotebooks(listLocalNotebooks());
  }, []);

  useEffect(() => {
    if (!pendingDelete && !demoMenuOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (demoMenuOpen) {
        setDemoMenuOpen(false);
      }
      if (pendingDelete) {
        setPendingDelete("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete, demoMenuOpen]);

  useEffect(() => {
    if (!demoMenuOpen) {
      return;
    }

    const onPointer = (event: PointerEvent) => {
      if (!demoPicker.current?.contains(event.target as Node)) {
        setDemoMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [demoMenuOpen]);

  const reveal = (state: CaseState) => {
    setOpenNotebook(state.id);
    navigate("/notebook", { state: { case: state } });
  };

  const openNotebook = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = CreateCaseInputSchema.safeParse({
      kind,
      title: form.get("title"),
      summary: form.get("summary"),
      severity: showSeverity
        ? form.get("severity")
        : defaultSeverityFor(kind),
      creatorName: readStoredActorName(),
    });

    if (!parsed.success) {
      setError("Check the notebook details and try again.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const state = createLocalNotebook(parsed.data);
      reveal(state);
    } catch {
      setError("This browser blocked local storage.");
      setBusy(false);
    }
  };

  const creatorName = () => readStoredActorName();

  const pickDemo = (kind: DemoKind) => {
    setDemoKind(kind);
    setDemoName("");
    setDemoMenuOpen(false);
    setError("");
    requestAnimationFrame(() => {
      demoDialog.current?.showModal();
      demoNameInput.current?.focus();
    });
  };

  const closeDemoDialog = () => {
    demoDialog.current?.close();
    setDemoKind(null);
    setDemoName("");
  };

  const usingDefaultDemo =
    !demoKind ||
    demoName.trim() === "" ||
    isDefaultDemoTitle(demoKind, demoName);

  const createNamedDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!demoKind) {
      return;
    }

    const title = demoName.trim();
    if (!usingDefaultDemo && title.length < 3) {
      setError("Give the sample a name of at least 3 characters.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      reveal(
        openDemoNotebook({
          kind: demoKind,
          title: usingDefaultDemo ? DEMO_DEFAULTS[demoKind].title : title,
          creatorName: creatorName(),
        }),
      );
    } catch {
      setError("This browser blocked local storage.");
      setBusy(false);
    }
  };

  const deleteNotebook = (notebook: NotebookSummary) => {
    if (pendingDelete !== notebook.id) {
      setPendingDelete(notebook.id);
      return;
    }

    removeLocalNotebook(notebook.id);
    setPendingDelete("");
    setNotebooks(listLocalNotebooks());
  };

  const importFile = async (file: File) => {
    setError("");
    try {
      const state = importNotebookFile(JSON.parse(await file.text()));
      reveal(state);
    } catch {
      setError("That file is not a Bynote notebook.");
    }
  };

  return (
    <main className="home">
      <header className="site-header">
        <a className="wordmark" href="/">
          BYNOTE
        </a>
        <div className="site-header-actions">
          <p>Local agent notebook</p>
          <HowItWorks />
        </div>
      </header>

      <section className="launcher">
        <div className="launcher-intro">
          <p className="eyebrow">You and your agents</p>
          <h1>Work in one notebook.</h1>
          <p>
            Start with a template or a blank page. Add notes, findings, tasks,
            and decisions together. Everything stays in this browser until you
            export it.
          </p>
        </div>

        <form className="case-form" onSubmit={openNotebook}>
          <fieldset>
            <legend>Template</legend>
            <div className="type-choice type-choice-four">
              {(["incident", "bug", "feature", "custom"] as const).map(
                (value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="kind"
                      value={value}
                      checked={kind === value}
                      onChange={() => setKind(value)}
                    />
                    <span>{kindLabel(value)}</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <label className="field">
            <span>Title</span>
            <input
              name="title"
              type="text"
              minLength={3}
              maxLength={120}
              placeholder={fieldCopy.title}
              required
            />
          </label>

          <label className="field">
            <span>Brief</span>
            <textarea
              name="summary"
              rows={3}
              maxLength={600}
              placeholder={fieldCopy.brief}
            />
          </label>

          {showSeverity ? (
            <label className="field field-severity">
              <span>Severity</span>
              <select name="severity" defaultValue="high">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create notebook"}
          </button>
        </form>

        <div className="demo-row">
          <div>
            <strong>Need an example?</strong>
            <p>Open a filled incident, bug, or feature notebook.</p>
          </div>
          <div className="demo-picker" ref={demoPicker}>
            <button
              className="button button-secondary demo-picker-toggle"
              type="button"
              aria-haspopup="menu"
              aria-expanded={demoMenuOpen}
              disabled={busy}
              onClick={() => setDemoMenuOpen((open) => !open)}
            >
              Choose sample
            </button>
            {demoMenuOpen ? (
              <div className="demo-menu" role="menu" aria-label="Sample type">
                {DEMO_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => pickDemo(kind)}
                  >
                    {demoLabel(kind)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <section className="library" aria-labelledby="library-title">
          <div className="library-heading">
            <div>
              <h2 id="library-title">
                On this browser
                {notebooks.length ? (
                  <span className="library-count">{notebooks.length}</span>
                ) : null}
              </h2>
              <p>
                {notebooks.length
                  ? "These notebooks stay here until you delete them."
                  : "Nothing stored here yet. Create one above, or import a file."}
              </p>
            </div>
            <div className="library-actions">
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="application/json,.json,.bynote.json,.byline.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void importFile(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
              <button
                className="button button-secondary"
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                Import file
              </button>
            </div>
          </div>

          {notebooks.length ? (
            <ul className="saved-notebooks">
              {notebooks.map((notebook) => (
                <li key={notebook.id}>
                  <Link
                    to="/notebook"
                    onClick={(event) => {
                      event.preventDefault();
                      const state = readLocalNotebook(notebook.id);
                      if (state) {
                        reveal(state);
                      }
                    }}
                  >
                    <span className="notebook-copy">
                      <strong>{notebook.title}</strong>
                      <span className="notebook-meta">
                        <span className="notebook-kind">
                          {kindLabel(notebook.kind)}
                        </span>
                        <time dateTime={notebook.createdAt}>
                          {createdLabel(notebook.createdAt)}
                        </time>
                      </span>
                    </span>
                  </Link>
                  <button
                    className={
                      pendingDelete === notebook.id
                        ? "text-button notebook-delete-confirm"
                        : "text-button"
                    }
                    type="button"
                    aria-label={
                      pendingDelete === notebook.id
                        ? `Confirm delete ${notebook.title}`
                        : `Delete ${notebook.title}`
                    }
                    onClick={() => deleteNotebook(notebook)}
                  >
                    {pendingDelete === notebook.id ? "Confirm" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>

      <SiteFooter
        status={webMcp.status}
        toolCount={webMcp.toolCount}
        prompt={libraryAgentPrompt()}
      />

      <dialog
        ref={demoDialog}
        className="demo-dialog"
        aria-labelledby="demo-dialog-title"
        onClose={() => {
          setDemoKind(null);
          setDemoName("");
        }}
        onClick={(event) => {
          if (event.target === demoDialog.current) {
            closeDemoDialog();
          }
        }}
      >
        <form className="demo-dialog-body" onSubmit={createNamedDemo}>
          <p className="eyebrow">
            {demoKind ? `${demoLabel(demoKind)} sample` : "Sample"}
          </p>
          <h2 id="demo-dialog-title">
            {demoKind ? `Name the ${demoKind} sample` : "Name the sample"}
          </h2>
          <p>Leave this blank to use the sample title.</p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="field">
            <span className="sr-only">Sample name</span>
            <div className="demo-slug">
              <input
                ref={demoNameInput}
                type="text"
                maxLength={120}
                value={demoName}
                placeholder={
                  demoKind ? DEMO_DEFAULTS[demoKind].title : "Sample name"
                }
                onChange={(event) => setDemoName(event.target.value)}
              />
              <button
                className="button"
                type="submit"
                disabled={busy || (!usingDefaultDemo && demoName.trim().length < 3)}
              >
                {usingDefaultDemo ? "Open sample" : "Create sample"}
              </button>
            </div>
          </label>
          <button
            className="text-button"
            type="button"
            onClick={closeDemoDialog}
          >
            Cancel
          </button>
        </form>
      </dialog>
    </main>
  );
}
