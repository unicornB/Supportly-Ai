import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";
import { AppError } from "../../shared/errors";
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

conversationsRoutes.get("/:id/messages/:messageId/attachments/:index", async (c) => {
  const services = createServices(c.env);
  const token = c.req.query("token")?.trim();
  await services.auth.requireAdminUser({
    adminUserId: c.req.query("adminUserId")?.trim() || c.req.header("x-admin-user-id"),
    authorization: token ? `Bearer ${token}` : c.req.header("authorization"),
  });

  return services.media.getMessageAttachmentResponse({
    conversationId: c.req.param("id"),
    messageId: c.req.param("messageId"),
    attachmentIndex: parseAttachmentIndex(c.req.param("index")),
    request: c.req.raw,
  });
});

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

conversationsRoutes.post("/:id/messages/media", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    throw new AppError("VALIDATION_ERROR", "file is required", 400);
  }

  const services = createServices(c.env);
  return ok(
    await services.messages.sendAgentMediaMessage({
      conversationId: c.req.param("id"),
      adminUserId: c.get("adminUserId"),
      clientMessageId: readOptionalFormString(formData, "clientMessageId", 128),
      content: readOptionalFormString(formData, "content", 2000),
      file,
      fileName: readOptionalFormString(formData, "fileName", 300),
      mimeType: readOptionalFormString(formData, "mimeType", 100),
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

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "stream" in value
  );
}

function readOptionalFormString(formData: FormData, name: string, maxLength: number): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new AppError("VALIDATION_ERROR", `${name} is too long`, 400);
  }
  return trimmed;
}

function parseAttachmentIndex(value: string): number {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) {
    throw new AppError("VALIDATION_ERROR", "Invalid attachment index", 400);
  }
  return index;
}
