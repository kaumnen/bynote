import { useRef, useState } from "react";

const examples = [
  {
    kind: "Incident",
    title: "Checkout errors after a release",
    detail: "Timeline of what changed, hypotheses, tasks, a resolution to accept.",
  },
  {
    kind: "Bug",
    title: "Search skips page two",
    detail: "Repro steps, expected vs actual, findings, then the fix work.",
  },
  {
    kind: "Feature",
    title: "Export notes as a file",
    detail: "Goal, spec and decisions, a task list for the people building it.",
  },
  {
    kind: "Custom",
    title: "Whatever this page is for",
    detail: "A blank notebook. Add only the sections you need.",
  },
] as const;

export function HowItWorks() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    dialog.current?.showModal();
    setOpen(true);
  };

  const hide = () => {
    dialog.current?.close();
  };

  return (
    <>
      <button
        className="text-button how-it-works-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="how-it-works-dialog"
        onClick={show}
      >
        How it works
      </button>
      <dialog
        ref={dialog}
        id="how-it-works-dialog"
        className="how-it-works-dialog"
        aria-labelledby="how-it-works-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) {
            hide();
          }
        }}
      >
        <div className="how-it-works-body">
          <div className="how-it-works-top">
            <p className="eyebrow">Local agent notebook</p>
            <form method="dialog">
              <button className="text-button" type="submit">
                Close
              </button>
            </form>
          </div>

          <h2 id="how-it-works-title">How it works</h2>
          <p>
            You and your agents share one notebook in this browser. Nothing is
            uploaded. Export a JSON file when you want to share or move it.
          </p>

          <div className="how-it-works-steps">
            <section>
              <p className="eyebrow">Start</p>
              <p>
                Create an incident, bug, feature, or blank custom notebook.
                Templates arrive with sections already named.
              </p>
            </section>
            <section>
              <p className="eyebrow">Write</p>
              <p>
                Add notes, timelines, findings, hypotheses, tasks, checklists,
                and decisions. Your name signs what you write. Filter by author
                when people and agents are both in it.
              </p>
            </section>
            <section>
              <p className="eyebrow">Agents</p>
              <p>
                When the footer shows WebMCP ready, an assistant can list,
                open, and write in this tab. Copy the footer prompt into the
                agent. If it says WebMCP off, you can still use the notebook
                yourself.
              </p>
            </section>
            <section>
              <p className="eyebrow">Stay local</p>
              <p>
                Notebooks live in this browser until you delete them. Export
                downloads a file you can import on another machine.
              </p>
            </section>
          </div>

          <p className="eyebrow">Example uses</p>
          <ul className="how-it-works-examples">
            {examples.map((example) => (
              <li
                key={example.kind}
                aria-label={`${example.kind}: ${example.title}. ${example.detail}`}
              >
                <strong>{example.kind}</strong>
                <span>
                  {example.title}. {example.detail}
                </span>
              </li>
            ))}
          </ul>

          <p className="how-it-works-hint">
            Need a filled example? Choose a sample on the home page.
          </p>
        </div>
      </dialog>
    </>
  );
}
