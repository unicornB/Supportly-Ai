import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";
import { authMiddleware } from "../middleware/auth.middleware";
import { ok } from "../responses";

const sendMessageSchema = z.object({
  clientMessageId: z.string().trim().min(1).max(128).optional(),
  content: z.string().min(1),
});

const handoffSchema = z.object({
  status: z.enum(["bot", "agent"]),
});

export const conversationsRoutes = new Hono<AppContext>();

conversationsRoutes.use("*", authMiddleware());

conversationsRoutes.get("/", async (c) => {
  const services = createServices(c.env);
  return ok(await services.conversations.listOpenConversations());
});

conversationsRoutes.get("/:id", async (c) => {
  const services = createServices(c.env);
  return ok(await services.conversations.getConversation(c.req.param("id")));
});

conversationsRoutes.get("/:id/messages", async (c) => {
  const services = createServices(c.env);
  return ok(await services.messages.listConversationMessages(c.req.param("id"), c.req.query("after") || undefined));
});

conversationsRoutes.post("/:id/messages", async (c) => {
  const input = sendMessageSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return ok(
    await services.messages.sendAgentMessage({
      conversationId: c.req.param("id"),
      adminUserId: c.get("adminUserId"),
      clientMessageId: input.clientMessageId,
      content: input.content,
    })
  );
});

conversationsRoutes.post("/:id/handoff", async (c) => {
  const input = handoffSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return ok(await services.conversations.setHandoff(c.req.param("id"), input.status));
});

conversationsRoutes.post("/:id/resolve", async (c) => {
  const services = createServices(c.env);
  return ok(await services.conversations.resolve(c.req.param("id")));
});
