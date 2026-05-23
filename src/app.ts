import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "./config/env";
import { errorMiddleware, errorResponse } from "./http/middleware/error.middleware";
import { requestIdMiddleware } from "./http/middleware/request-id.middleware";
import { adminRoutes } from "./http/routes/admin.routes";
import { authRoutes } from "./http/routes/auth.routes";
import { channelsRoutes } from "./http/routes/channels.routes";
import { conversationsRoutes } from "./http/routes/conversations.routes";
import { healthRoutes } from "./http/routes/health.routes";
import { knowledgeRoutes } from "./http/routes/knowledge.routes";
import { webhookRoutes } from "./http/routes/webhook.routes";
import { widgetRoutes } from "./http/routes/widget.routes";

export const app = new Hono<AppContext>();

app.use("*", requestIdMiddleware());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "Range",
      "X-Admin-User-Id",
      "X-Debug-Response",
      "X-Request-Id",
      "X-Supportly-Signature",
      "X-Telegram-Bot-Api-Secret-Token",
    ],
    exposeHeaders: ["Accept-Ranges", "Content-Length", "Content-Range", "Content-Type", "X-Request-Id"],
    maxAge: 86400,
  })
);
app.use("*", errorMiddleware());

app.route("/health", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/channels", channelsRoutes);
app.route("/api/conversations", conversationsRoutes);
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/widget", widgetRoutes);
app.route("/webhooks", webhookRoutes);

app.onError((error, c) => errorResponse(error, c));

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));
