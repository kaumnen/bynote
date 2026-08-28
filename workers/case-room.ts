import { DurableObject } from "cloudflare:workers";

import {
  applyCaseAction,
  createCaseState,
} from "../src/shared/case-state";
import {
  CaseActionSchema,
  CaseStateSchema,
  CreateCaseInputSchema,
  type CaseState,
} from "../src/shared/schemas";

const STATE_KEY = "case";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export class CaseRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/init") {
      return this.initialize(request, url.searchParams.get("id") ?? "");
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const state = await this.readState();
      return state ? json(state) : json({ error: "Case not found" }, 404);
    }

    if (request.method === "POST" && url.pathname === "/actions") {
      return this.mutate(request);
    }

    if (request.method === "GET" && url.pathname === "/live") {
      return this.connectSocket(request);
    }

    return json({ error: "Route not found" }, 404);
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string) {
    if (message === "ping") {
      socket.send(JSON.stringify({ type: "pong" }));
    }
  }

  async webSocketError(socket: WebSocket) {
    socket.close(1011, "Connection error");
  }

  private async readState() {
    const value = await this.ctx.storage.get(STATE_KEY);
    if (!value) {
      return null;
    }

    return CaseStateSchema.parse(value);
  }

  private async initialize(request: Request, caseId: string) {
    if (!caseId) {
      return json({ error: "Case ID is required" }, 400);
    }

    const parsed = CreateCaseInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: "Invalid case details" }, 400);
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const existing = await this.readState();
      if (existing) {
        return json(existing);
      }

      const state = createCaseState(caseId, parsed.data);
      await this.ctx.storage.put(STATE_KEY, state);
      return json(state, 201);
    });
  }

  private async mutate(request: Request) {
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const parsed = CaseActionSchema.safeParse(input);
    if (!parsed.success) {
      return json(
        {
          error: "Invalid action",
          issues: parsed.error.issues.map(({ path, message }) => ({
            path: path.join("."),
            message,
          })),
        },
        400,
      );
    }

    try {
      return await this.ctx.blockConcurrencyWhile(async () => {
        const current = await this.readState();
        if (!current) {
          return json({ error: "Case not found" }, 404);
        }

        const next = applyCaseAction(current, parsed.data);
        await this.ctx.storage.put(STATE_KEY, next);
        this.broadcast(next);
        return json(next);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Action could not be applied";
      return json({ error: message }, 409);
    }
  }

  private connectSocket(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WebSocket upgrade required" }, 426);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(state: CaseState) {
    const message = JSON.stringify({ type: "case.updated", state });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        socket.close(1011, "Update failed");
      }
    }
  }
}
