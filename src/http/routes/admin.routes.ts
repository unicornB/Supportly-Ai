import { Hono } from "hono";
import type { AppContext } from "../../config/env";
import { AppError } from "../../shared/errors";
import { createServices } from "../../services";
import { authMiddleware } from "../middleware/auth.middleware";
import { ok } from "../responses";

export const adminRoutes = new Hono<AppContext>();

adminRoutes.get("/ws", async (c) => {
  assertWebSocketRequest(c.req.raw);
  const services = createServices(c.env);
  const token = c.req.query("token")?.trim();
  const user = await services.auth.requireAdminUser({
    adminUserId: c.req.query("adminUserId")?.trim() || c.req.header("x-admin-user-id"),
    authorization: token ? `Bearer ${token}` : c.req.header("authorization"),
  });

  const id = c.env.ADMIN_STREAM.idFromName("admin");
  const stub = c.env.ADMIN_STREAM.get(id);
  const request = createRealtimeRequest(c.req.raw, {
    "x-supportly-admin-user-id": user.id,
  });

  return stub.fetch(request);
});

adminRoutes.use("*", authMiddleware());
adminRoutes.get("/", (c) => ok({ ok: true }));

function assertWebSocketRequest(request: Request): void {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    throw new AppError("WEBSOCKET_REQUIRED", "WebSocket upgrade is required", 426);
  }
}

function createRealtimeRequest(request: Request, identityHeaders: Record<string, string>): Request {
  const url = new URL(request.url);
  url.searchParams.delete("token");
  url.searchParams.delete("adminUserId");

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("x-admin-user-id");
  for (const [key, value] of Object.entries(identityHeaders)) {
    headers.set(key, value);
  }

  return new Request(url.toString(), {
    method: request.method,
    headers,
  });
}
