# Bynote

A notebook for people and agents. It lives in this browser. Nothing is sent to a server.

Plans, campaigns, meetings. Incidents, bugs, features. Or a blank page. Notes, tasks, or diagrams sit on one page. Export a JSON file to move it.

## Use

1. Open `/`. Pick a template and a title.
2. Write in sections. Set your name; notes are signed with it.
3. Export when you want a copy. Import that file in another browser.

Open a sample on the home page for a filled example. Clearing site data deletes notebooks. A copied `/notebook` URL does not carry notes.

## Agents

[WebMCP](https://webmachinelearning.github.io/webmcp/) tools register on `document.modelContext` when the browser supports it. Chrome has an origin trial. **Copy prompt** copies a page prompt for the agent.

Home: `list_notebooks`, `show_notebook`, `create_notebook`.

Notebook: those three plus `read_case`, `join_as_agent`, and write tools for sections, notes, tasks, and related items. Call `read_case` first. Call `join_as_agent` before writing. An agent can propose a resolution; only a human can accept it.

## Run

```sh
bun install
bun run dev
```

`bun run check` typechecks, tests, and builds. `bun run deploy` ships the Cloudflare worker (`bynote`), which only serves the app.

## License

MIT. See `LICENSE`. Departure Mono and Lucide-derived icons: `THIRD_PARTY_NOTICES.md`.
