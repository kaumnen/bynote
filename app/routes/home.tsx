import { data, Form, redirect, useNavigation } from "react-router";

import { createCase } from "../lib/cases.server";
import { CreateCaseInputSchema } from "../../src/shared/schemas";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "Byline | Shared investigation room" },
    {
      name: "description",
      content: "Work on bugs and incidents with people and browser agents.",
    },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const demo = form.get("intent") === "demo";
  const parsed = CreateCaseInputSchema.safeParse({
    kind: demo ? "incident" : form.get("kind"),
    title: demo ? "Demo incident" : form.get("title"),
    summary: demo ? "" : form.get("summary"),
    severity: demo ? "critical" : form.get("severity"),
    creatorName: form.get("creatorName") || "Guest",
    demo,
  });

  if (!parsed.success) {
    return data(
      { error: "Check the case details and try again." },
      { status: 400 },
    );
  }

  const state = await createCase(parsed.data);
  return redirect(`/cases/${state.id}`);
}

export default function Home({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <main className="home">
      <header className="site-header">
        <a className="wordmark" href="/">
          BYLINE
        </a>
        <p>Shared investigation room</p>
      </header>

      <section className="launcher">
        <div className="launcher-intro">
          <p className="eyebrow">Bugs and incidents</p>
          <h1>Work one case together.</h1>
          <p>
            Keep findings, hypotheses, tasks, and decisions in one live record.
            People and browser agents use the same room.
          </p>
        </div>

        <Form method="post" className="case-form">
          <fieldset>
            <legend>Case type</legend>
            <div className="type-choice">
              <label>
                <input type="radio" name="kind" value="incident" defaultChecked />
                <span>Incident</span>
              </label>
              <label>
                <input type="radio" name="kind" value="bug" />
                <span>Bug</span>
              </label>
            </div>
          </fieldset>

          <label className="field">
            <span>Title</span>
            <input
              name="title"
              type="text"
              minLength={3}
              maxLength={120}
              placeholder="Checkout errors after release"
              required
            />
          </label>

          <label className="field">
            <span>Brief</span>
            <textarea
              name="summary"
              rows={3}
              maxLength={600}
              placeholder="What is happening?"
            />
          </label>

          <div className="form-row">
            <label className="field">
              <span>Severity</span>
              <select name="severity" defaultValue="high">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            <label className="field">
              <span>Your name</span>
              <input
                name="creatorName"
                type="text"
                maxLength={48}
                placeholder="Guest"
              />
            </label>
          </div>

          {actionData?.error ? (
            <p className="form-error" role="alert">
              {actionData.error}
            </p>
          ) : null}

          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Creating case..." : "Create case"}
          </button>
        </Form>

        <div className="demo-row">
          <div>
            <strong>Want to test it first?</strong>
            <p>Open a fresh incident with sample evidence and tasks.</p>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="demo" />
            <button className="button button-secondary" type="submit" disabled={busy}>
              Open demo
            </button>
          </Form>
        </div>
      </section>

      <footer className="home-footer">
        <span>WEBMCP READY</span>
        <span>CLOUDFLARE DURABLE OBJECTS</span>
      </footer>
    </main>
  );
}
