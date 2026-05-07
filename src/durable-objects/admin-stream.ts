import type { Env } from "../config/env";
import type { AdminRealtimeEvent } from "../modules/realtime/realtime.types";
import { nowIso } from "../shared/time";

type AdminConnectionAttachment = {
  kind: "admin";
  adminUserId: string;
  connectedAt: string;
};

export class AdminStream {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/__notify") {
      return this.handleNotify(request);
    }

    if (request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return this.handleWebSocket(request);
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    if (typeof message !== "string") {
      sendJson(ws, { type: "error", code: "INVALID_EVENT", message: "Unsupported binary event" });
      return;
    }

    try {
      const event = JSON.parse(message) as { type?: unknown };
      if (event.type === "ping") {
        sendJson(ws, { type: "pong", serverTime: nowIso() });
        return;
      }

      sendJson(ws, { type: "error", code: "INVALID_EVENT", message: "Unsupported event" });
    } catch {
      sendJson(ws, { type: "error", code: "INVALID_JSON", message: "Invalid JSON event" });
    }
  }

  webSocketError(ws: WebSocket): void {
    ws.close(1011, "WebSocket error");
  }

  private handleWebSocket(request: Request): Response {
    const adminUserId = request.headers.get("x-supportly-admin-user-id");

    if (!adminUserId) {
      return new Response("Missing admin identity", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const attachment: AdminConnectionAttachment = {
      kind: "admin",
      adminUserId,
      connectedAt: nowIso(),
    };

    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);
    sendJson(server, { type: "connected", connectionKind: "admin", serverTime: nowIso() });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleNotify(request: Request): Promise<Response> {
    const event = (await request.json().catch(() => null)) as AdminRealtimeEvent | null;
    if (!event || (event.type !== "message.new" && event.type !== "conversation.updated")) {
      return new Response("Invalid notify event", { status: 400 });
    }

    this.broadcast(event);
    return new Response(null, { status: 204 });
  }

  private broadcast(event: AdminRealtimeEvent): void {
    for (const ws of this.state.getWebSockets()) {
      sendJson(ws, event);
    }
  }
}

function sendJson(ws: WebSocket, event: unknown): void {
  if (ws.readyState !== 1) return;

  try {
    ws.send(JSON.stringify(event));
  } catch {
    ws.close(1011, "Send failed");
  }
}

