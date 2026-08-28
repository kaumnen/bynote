export type WebMcpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (
    input: unknown,
    options?: { signal?: AbortSignal },
  ) => Promise<WebMcpToolResult> | WebMcpToolResult;
};

export type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}
