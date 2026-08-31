import { afterEach, describe, expect, it } from "vitest";

import { CreateCaseInputSchema } from "../../src/shared/schemas";
import {
  createLocalNotebook,
  listLocalNotebooks,
  readOpenNotebookId,
} from "../lib/local-notebook";
import { registerLibraryTools } from "./register-library-tools";
import type { ModelContext, WebMcpTool } from "./types";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    get length() {
      return data.size;
    },
  } satisfies Storage;
}

function installMemoryStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memoryStorage(),
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
});

describe("WebMCP library tools", () => {
  it("lists, creates, and opens notebooks on this browser", async () => {
    installMemoryStorage();
    const tools = new Map<string, WebMcpTool>();
    const opened: string[] = [];
    const modelContext: ModelContext = {
      async registerTool(tool) {
        tools.set(tool.name, tool);
      },
    };

    const first = createLocalNotebook(
      CreateCaseInputSchema.parse({
        kind: "bug",
        title: "Search skips page two",
        creatorName: "Alex",
      }),
    );

    const registration = registerLibraryTools({
      modelContext,
      list: listLocalNotebooks,
      create: createLocalNotebook,
      openInTab: (id) => {
        opened.push(id);
      },
      openId: readOpenNotebookId,
      creatorName: () => "Alex",
    });
    await registration.ready;

    expect(registration.toolNames).toEqual([
      "list_notebooks",
      "set_notebook",
      "create_notebook",
    ]);

    const listed = await tools.get("list_notebooks")?.execute({});
    expect(listed?.structuredContent).toMatchObject({
      notebooks: [expect.objectContaining({ id: first.id, title: first.title })],
      openId: null,
    });

    await tools.get("set_notebook")?.execute({ notebookId: first.id });
    expect(opened).toEqual([first.id]);

    const created = await tools.get("create_notebook")?.execute({
      kind: "custom",
      title: "Release notes",
    });
    expect(created?.structuredContent).toMatchObject({
      title: "Release notes",
      kind: "custom",
    });
    expect(opened).toHaveLength(2);
    expect(listLocalNotebooks().map(({ title }) => title)).toContain(
      "Release notes",
    );

    await expect(
      tools.get("set_notebook")?.execute({ notebookId: "nope" }),
    ).rejects.toThrow("Unknown notebook id");

    expect(tools.get("list_notebooks")?.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(tools.get("set_notebook")?.annotations?.readOnlyHint).not.toBe(
      true,
    );
    expect(tools.get("set_notebook")?.inputSchema).toMatchObject({
      properties: {
        notebookId: { type: "string", description: expect.any(String) },
      },
    });
    expect(tools.get("create_notebook")?.inputSchema).toMatchObject({
      properties: {
        kind: { description: expect.any(String) },
        title: { description: expect.any(String) },
        summary: { description: expect.any(String) },
        severity: { description: expect.any(String) },
      },
    });

    registration.dispose();
  });
});
