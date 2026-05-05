import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";
import { AppError } from "../../shared/errors";
import { created, ok } from "../responses";

const createConversationSchema = z.object({
  channelAccountId: z.string().min(1),
  visitorId: z.string().min(1).max(128),
  pageUrl: z.string().max(2048).optional(),
  pageTitle: z.string().max(300).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  pageUrl: z.string().max(2048).optional(),
  pageTitle: z.string().max(300).optional(),
});

export const widgetRoutes = new Hono<AppContext>();

widgetRoutes.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  c.header("Access-Control-Allow-Headers", "authorization,content-type");
  c.header("Access-Control-Max-Age", "86400");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
});

widgetRoutes.post("/conversations", async (c) => {
  const input = createConversationSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return created(await services.widget.createConversation(input));
});

widgetRoutes.post("/conversations/:conversationId/messages", async (c) => {
  const input = sendMessageSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return ok(
    await services.widget.sendVisitorMessage({
      conversationId: c.req.param("conversationId"),
      token: getBearerToken(c.req.raw),
      content: input.content,
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle,
    })
  );
});

widgetRoutes.get("/conversations/:conversationId/messages", async (c) => {
  const services = createServices(c.env);
  return ok({
    messages: await services.widget.listMessages({
      conversationId: c.req.param("conversationId"),
      token: getBearerToken(c.req.raw),
      afterMessageId: c.req.query("after") || undefined,
    }),
  });
});

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) {
    throw new AppError("VISITOR_TOKEN_REQUIRED", "Visitor token is required", 401);
  }
  return header.slice(prefix.length).trim();
}
