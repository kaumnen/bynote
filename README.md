# Bynote

A notebook for people and agents. It lives in this browser. Nothing is sent to a server.

Plans, campaigns, meetings. Incidents, bugs, features. Or a blank page. Notes, tasks or diagrams sit on one page. Export a JSON file to move it.

## Use

1. Open the home page.
2. Pick a template. Give it a title.
3. Write in sections. Set your name. Notes are signed with it.
4. Export a file when you want a copy. Import that file on another browser.

Need a filled example? Open a sample on the home page. A sample with the default title reuses one already stored here.

Clearing site data deletes the notebooks. A copied `/notebook` URL does not carry notes.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Create, list, import, open a sample. |
| `/notebook` | The open notebook. Which one comes from this tab. |

If the notebook is missing, the page says so. Import a file or start a new one.

## Templates

Work: Plan, Campaign, Meeting, Blank. Engineering: Incident, Bug, Feature.

Incident and Bug show severity (low, medium, high, critical). Other kinds store severity but hide it.

Status values are always `open`, `investigating`, `monitoring`, `resolved`. Labels change by kind:

| Kind | Labels |
| --- | --- |
| Incident, Bug | Open, Investigating, Monitoring, Resolved |
| Everything else | Open, In progress, Paused, Done |

Seeded sections:

| Kind | Sections |
| --- | --- |
| Plan | Goal (note), Notes (note), Tasks, Decisions |
| Campaign | Audience (note), Messaging (note), Channels (checklist), Tasks, Decisions |
| Meeting | Agenda (checklist), Notes (note), Decisions, Tasks |
| Incident | Workstream (timeline), Hypotheses, Tasks, Resolution (decisions) |
| Bug | Repro (note), Expected / actual (note), Findings, Tasks |
| Feature | Goal (note), Spec and decisions (decisions), Tasks |
| Blank (`custom`) | None |

Title: 3 to 120 characters. Brief: up to 600.

## Sections

A notebook holds up to 20 sections. Type is the behavior. Title is a label. A section named Goal is still a note.

| Type | Holds | You add |
| --- | --- | --- |
| `note` | Markdown notes | A note body |
| `timeline` | Ordered entries | Update, finding, hypothesis, task or resolution |
| `findings` | Entries with kind `finding` | A finding |
| `hypotheses` | Possible explanations | Title, optional detail, confidence |
| `tasks` | Work items | Title. Status: open, doing, done |
| `checklist` | Yes/no items | An item title |
| `decisions` | Calls plus resolution proposals | A decision body |

Add one section at a time in the UI. Agents can replace the whole layout with `set_sections`. That mints new section ids. Notes, checklists or decisions on dropped ids are gone.

## Notes

Markdown in notes, updates, findings or decisions. [GFM](https://github.github.com/gfm/): headings, lists, tables, task checkboxes, links. Line breaks stay as breaks.

Fenced `mermaid` blocks render as diagrams (flowchart, sequence, gantt, journey, others mermaid 11 accepts). On failure you see the source. Mermaid runs with `securityLevel: "strict"`.

`javascript:`, `vbscript:` or `data:` links and images are stripped.

In a note you can:

- Edit the body. The card stays. History keeps who changed what.
- Tick a markdown checkbox. That writes a revision too.
- Open History for a line diff of two versions.

Headings inside a note are stepped down so they do not compete with the page title (`#` renders as `h3`).

When more than one name has written, filter the page by author. Humans show as H. Agents show as A. Times are `HH:MM UTC`.

A human must accept a resolution proposal. That sets status to resolved. An agent can propose. It cannot accept.

## Agents

[WebMCP](https://webmachinelearning.github.io/webmcp/) is a browser API on `document.modelContext`. This page registers tools there. It is experimental. Chrome has an origin trial. Other browsers may have nothing.

The footer pill:

| Label | Meaning |
| --- | --- |
| `WebMCP · N tools` | Tools registered. An assistant in this tab can call them. |
| `WebMCP off` | No `document.modelContext`. Use the page yourself. |
| `WebMCP blocked` | The API exists. Registration failed. |
| `WebMCP` | Still checking. |

Hover over or focus **Copy prompt** to preview the page prompt. Select it to
put the prompt on the clipboard, then paste it into the agent.

The right side of the footer links to [kaumnen](https://x.com/kaumnen) on X.

Home prompt:

```
You are on the Bynote home page.
Call list_notebooks to see notebooks in this browser.
Call open_notebook with an id to work on one. The tab will open that notebook and writing tools will apply to it.
If none exist, call create_notebook, then continue there.
Prefer plan, campaign, or meeting for GTM and everyday work. Use incident, bug, or feature for engineering. Use custom for a blank page.
```

Notebook prompt:

```
You are in Bynote. The notebook open in this tab is the one to work on.
Call read_case first. Call join_as_agent before you add work.
If you need a different notebook, call list_notebooks, then open_notebook.
If it has no sections, add a Goal note and a Tasks section.
Each section has a type and a title. Type is note, timeline, findings, hypotheses, tasks, checklist, or decisions. Title is only a label. Goal is a note.
Notes, updates, findings, and decisions support markdown. Put diagrams in fenced mermaid code blocks.
To change a sent note, call revise_note. Toggle checkboxes in a note with toggle_note_task. Use a checklist section for standalone work items.
Add one useful note or finding, then add one task.
```

Home registers 3 tools. A notebook registers those 3 plus 16 write/read tools (19 total).

### Home tools

| Tool | Does |
| --- | --- |
| `list_notebooks` | Notebooks in this browser, plus the open id. |
| `open_notebook` | Open by id. Navigates this tab to `/notebook`. |
| `create_notebook` | Create, then open. `kind`: plan, campaign, meeting, incident, bug, feature, custom. Severity only matters for incident or bug. |

### Notebook tools

Call `read_case` first. Call `join_as_agent` with a name before you write. Agent name is kept in this tab per notebook.

| Tool | Does |
| --- | --- |
| `read_case` | Full notebook. Section objects include `type`, `typeLabel`, `hint`, `title`. Note revisions are omitted. |
| `join_as_agent` | Set the agent name. Record a join. |
| `add_section` | Append one section. |
| `set_sections` | Replace the layout (max 20). |
| `add_note` | Markdown on a `note` section. Pass `sectionId` from `read_case`. |
| `revise_note` | Replace a sent note body. Pass `noteId`. |
| `toggle_note_task` | Flip checkbox `taskIndex` (0-based, skips fenced code). |
| `add_decision` | Markdown on a `decisions` section. |
| `add_checklist_item` | Item on a `checklist` section. |
| `toggle_checklist_item` | Flip done. |
| `post_update` | Timeline update. |
| `add_finding` | Verified fact. Not a guess. |
| `add_hypothesis` | Possible explanation. `confidence`: low, medium, high. |
| `create_task` | Task. Optional `assignee`. |
| `update_task` | `open`, `doing` or `done`. Pass `taskId`. |
| `propose_resolution` | Proposal for a human to accept. Does not resolve the notebook. |

Writes from the UI use source `human-ui`. Writes from these tools use `webmcp`.

## Files

Export downloads `{title-slug}.bynote.json`.

```json
{
  "format": "bynote.notebook.v1",
  "notebook": {
    "id": "32 lowercase hex chars",
    "kind": "plan",
    "title": "",
    "summary": "",
    "severity": "medium",
    "status": "open",
    "createdAt": "2026-08-29T00:00:00.000Z",
    "revision": 1,
    "sections": [],
    "entries": [],
    "hypotheses": [],
    "tasks": [],
    "notes": [],
    "checklists": [],
    "decisions": [],
    "participants": []
  }
}
```

Import accepts `application/json`, `.json`, `.bynote.json` or `.byline.json`. `format` must be `bynote.notebook.v1` or the older `byline.notebook.v1`. The `notebook` object must pass the Zod schema in `src/shared/schemas.ts`. Anything else is rejected.

Ids are 32 hex characters (a UUID with the hyphens removed).

## Storage

All of this is on the device. The Cloudflare worker only serves the app.

| Key | Where | What |
| --- | --- | --- |
| `bynote:notebook:{id}` | `localStorage` | Full notebook JSON |
| `bynote:open` | `sessionStorage` | Notebook id for this tab |
| `bynote.actor` | `localStorage` | Your id and name. Default name `Guest`. Max 48 chars. |
| `bynote.agent-name.{id}` | `sessionStorage` | Agent name for that notebook |

Same-origin tabs on the same notebook sync over `BroadcastChannel` named `bynote:{id}`.

A bad stored notebook is dropped on read.

## Caps

Oldest extras are dropped when a list overflows. Note history keeps the original plus the newest revisions.

| Thing | Cap |
| --- | --- |
| Sections | 20 |
| Section title | 80 |
| Note body | 8000 |
| Note revisions | 20 |
| Notes | 100 |
| Timeline entries | 250 |
| Entry body (update, finding, resolution) | 4000 |
| Hypotheses | 100 |
| Hypothesis title | 180 |
| Hypothesis detail | 4000 |
| Tasks | 100 |
| Task title | 240 |
| Decisions | 100 |
| Checklist items | 200 |
| Checklist title | 240 |
| Participants | 30 |
| Checkboxes in one note (`taskIndex`) | 200 |

## Code

Package manager: Bun 1.4. React 19, React Router 8 (SSR), Vite 8, Cloudflare Workers, Zod 4, Vitest. Markdown: `react-markdown`, `remark-gfm`, `remark-breaks`. Diagrams: mermaid 11.

| Path | Role |
| --- | --- |
| `app/routes/home.tsx` | Home page |
| `app/routes/case.tsx` | Notebook page |
| `app/lib/local-notebook.ts` | Storage, import, export |
| `app/hooks/use-case-room.ts` | Apply an action, persist, broadcast |
| `app/hooks/use-webmcp.ts` | Register tools if the API exists |
| `app/webmcp/register-library-tools.ts` | Home tools |
| `app/webmcp/register-tools.ts` | Notebook tools |
| `app/webmcp/prompts.ts` | Copy-prompt text |
| `src/shared/schemas.ts` | Types, file format, tool inputs |
| `src/shared/case-state.ts` | Create, mutate, demo seeds |
| `src/shared/templates.ts` | Kinds, section palette |
| `src/shared/markdown.ts` | Mermaid fences, checkbox toggle |
| `src/shared/note-history.ts` | Revisions, line diff |
| `workers/app.ts` | Worker fetch. No notebook I/O. |

State changes go through `applyCaseAction`. UI and WebMCP share that path.

## Run

```sh
bun install
bun run dev
```

| Script | Does |
| --- | --- |
| `dev` | Vite + React Router |
| `test` | Vitest once |
| `test:watch` | Vitest watch |
| `typecheck` | Wrangler types, React Router typegen, `tsc -b` |
| `build` | Production build |
| `check` | typecheck, test, build |
| `preview` | Build, then `vite preview` |
| `deploy` | Build, then `wrangler deploy` (worker name `bynote`) |

Tests live next to the code: `src/**/*.test.ts`, `app/**/*.test.ts`, `app/**/*.test.tsx`.

## License

MIT. See `LICENSE`.

Departure Mono and Lucide-derived icons: `THIRD_PARTY_NOTICES.md`.
