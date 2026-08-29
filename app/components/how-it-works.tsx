import { useRef, useState } from "react";

const examples = [
  {
    kind: "Plan",
    title: "Q3 partner rollout",
    detail: "Goal, dates, a gantt, tasks, and the call you already made.",
  },
  {
    kind: "Campaign",
    title: "Spring launch in APAC",
    detail:
      "Audience, messaging, a funnel diagram, a channel checklist, and who goes first.",
  },
  {
    kind: "Meeting",
    title: "Weekly GTM standup",
    detail: "Agenda, notes with a journey diagram, decisions, and what happens next.",
  },
  {
    kind: "Incident",
    title: "Checkout errors after a release",
    detail:
      "Engineering template. Timeline, a sequence diagram, hypotheses, tasks, a resolution to accept.",
  },
  {
    kind: "Blank",
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
                Create a plan, campaign, meeting, or blank notebook.
                Engineering templates for incidents, bugs, and features sit
                in their own group.
              </p>
            </section>
            <section>
              <p className="eyebrow">Write</p>
              <p>
                Add notes, tasks, checklists, and decisions. Each section
                shows its type, so a Goal note is not the same as a task
                list. Notes can use markdown headings, lists, checkboxes,
                links, and mermaid diagrams. Edit a sent note or tick a
                checkbox; history shows who changed what. Filter by author
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
