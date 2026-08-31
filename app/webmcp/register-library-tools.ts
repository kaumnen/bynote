import { z } from "zod";

import {
  toolInputSchemas,
  type CreateCaseInput,
} from "../../src/shared/schemas";
import { defaultSeverityFor } from "../../src/shared/templates";
import { isNotebookId } from "../../src/shared/case-id";
import {
  createLocalNotebook,
  type NotebookSummary,
} from "../lib/local-notebook";
import type { ModelContext, WebMcpTool, WebMcpToolResult } from "./types";

type RegisterLibraryToolsOptions = {
  modelContext: ModelContext;
  list: () => NotebookSummary[];
  create: (input: CreateCaseInput) => ReturnType<typeof createLocalNotebook>;
  openInTab: (notebookId: string) => void;
  openId: () => string | null;
  creatorName: () => string;
};

function result(label: string, data: unknown): WebMcpToolResult {
  return {
    content: [{ type: "text", text: `${label}\n${JSON.stringify(data)}` }],
    structuredContent: data,
  };
}

function schema(input: z.ZodType) {
  return z.toJSONSchema(input) as Record<string, unknown>;
}

export function registerLibraryTools({
  modelContext,
  list,
  create,
  openInTab,
  openId,
  creatorName,
}: RegisterLibraryToolsOptions) {
  const controller = new AbortController();

  const tools: WebMcpTool[] = [
    {
      name: "list_notebooks",
      title: "List notebooks",
      description:
        "Lists notebooks stored in this browser. Returns each notebook's id, title, kind, and which notebook this tab currently shows.",
      inputSchema: schema(toolInputSchemas.listNotebooks),
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute() {
        const notebooks = list();
        return result("Notebooks on this browser", {
          notebooks,
          openId: openId(),
        });
      },
    },
    {
      name: "set_notebook",
      title: "Set notebook",
      description:
        "Sets the notebook displayed in this tab by id. Returns the notebook summary.",
      inputSchema: schema(toolInputSchemas.setNotebook),
      annotations: {
        untrustedContentHint: true,
      },
      async execute(input) {
        const parsed = toolInputSchemas.setNotebook.parse(input);
        if (!isNotebookId(parsed.notebookId)) {
          throw new Error("Unknown notebook id");
        }
        const notebooks = list();
        const found = notebooks.find(({ id }) => id === parsed.notebookId);
        if (!found) {
          throw new Error("Notebook not found on this browser");
        }
        if (
          openId() === found.id &&
          globalThis.location?.pathname === "/notebook"
        ) {
          return result("Notebook already open", found);
        }
        openInTab(found.id);
        return result("Opening notebook", found);
      },
    },
    {
      name: "create_notebook",
      title: "Create notebook",
      description:
        "Creates a notebook in this browser, opens it in this tab, and returns the new notebook's id, title, and kind.",
      inputSchema: schema(toolInputSchemas.createNotebook),
      execute(input) {
        const parsed = toolInputSchemas.createNotebook.parse(input);
        const kind = parsed.kind;
        const state = create({
          kind,
          title: parsed.title,
          summary: parsed.summary,
          severity: parsed.severity ?? defaultSeverityFor(kind),
          creatorName: creatorName(),
          demo: false,
        });
        openInTab(state.id);
        return result("Created notebook", {
          id: state.id,
          title: state.title,
          kind: state.kind,
        });
      },
    },
  ];

  const ready = Promise.all(
    tools.map((tool) =>
      modelContext.registerTool(tool, { signal: controller.signal }),
    ),
  );

  return {
    ready,
    toolNames: tools.map(({ name }) => name),
    dispose: () => controller.abort(),
  };
}
