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
  clientMessageId: z.string().trim().min(1).max(128).optional(),
  content: z.string().trim().min(1).max(2000),
  pageUrl: z.string().max(2048).optional(),
  pageTitle: z.string().max(300).optional(),
});

export const widgetRoutes = new Hono<AppContext>();

widgetRoutes.get("/ws", async (c) => {
  assertWebSocketRequest(c.req.raw);
  const conversationId = c.req.query("conversationId")?.trim();
  if (!conversationId) {
    throw new AppError("CONVERSATION_ID_REQUIRED", "Conversation id is required", 400);
  }

  const services = createServices(c.env);
  const claims = await services.widget.requireConversationAccess(conversationId, getVisitorToken(c.req.raw, c.req.query("token")));
  const id = c.env.VISITOR_STREAM.idFromName(conversationId);
  const stub = c.env.VISITOR_STREAM.get(id);
  const request = createRealtimeRequest(c.req.raw, {
    "x-supportly-conversation-id": conversationId,
    "x-supportly-visitor-id": claims.visitorId,
  });

  return stub.fetch(request);
});

widgetRoutes.post("/conversations", async (c) => {
  const input = createConversationSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return created(await services.widget.createConversation(input));
});

widgetRoutes.post("/conversations/:conversationId/messages", async (c) => {
  const input = sendMessageSchema.parse(await c.req.json());
  const services = createServices(c.env);
  const result = await services.widget.sendVisitorMessage(
    {
      conversationId: c.req.param("conversationId"),
      token: getBearerToken(c.req.raw),
      clientMessageId: input.clientMessageId,
      content: input.content,
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle,
    },
    { createAiReply: false, notifyRealtime: false }
  );

  if (!result.duplicate) {
    c.executionCtx.waitUntil(
      services.widget.completeVisitorMessage({
        conversationId: result.conversationId,
        inboundMessageId: result.inboundMessage.id,
      })
    );
  }

  return ok(result);
});

widgetRoutes.post("/conversations/:conversationId/messages/media", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    throw new AppError("VALIDATION_ERROR", "file is required", 400);
  }

  const services = createServices(c.env);
  const result = await services.widget.sendVisitorMediaMessage({
    conversationId: c.req.param("conversationId"),
    token: getBearerToken(c.req.raw),
    clientMessageId: readOptionalFormString(formData, "clientMessageId", 128),
    content: readOptionalFormString(formData, "content", 2000),
    file,
    fileName: readOptionalFormString(formData, "fileName", 300),
    mimeType: readOptionalFormString(formData, "mimeType", 100),
    pageUrl: readOptionalFormString(formData, "pageUrl", 2048),
    pageTitle: readOptionalFormString(formData, "pageTitle", 300),
  });

  return ok(result);
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

widgetRoutes.get("/conversations/:conversationId/messages/:messageId/attachments/:index", async (c) => {
  const services = createServices(c.env);
  const conversationId = c.req.param("conversationId");
  await services.widget.requireConversationAccess(conversationId, getVisitorToken(c.req.raw, c.req.query("token")));

  return services.media.getMessageAttachmentResponse({
    conversationId,
    messageId: c.req.param("messageId"),
    attachmentIndex: parseAttachmentIndex(c.req.param("index")),
    request: c.req.raw,
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

function getVisitorToken(request: Request, queryToken?: string): string {
  if (queryToken?.trim()) return queryToken.trim();
  return getBearerToken(request);
}

function assertWebSocketRequest(request: Request): void {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    throw new AppError("WEBSOCKET_REQUIRED", "WebSocket upgrade is required", 426);
  }
}

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

function createRealtimeRequest(request: Request, identityHeaders: Record<string, string>): Request {
  const url = new URL(request.url);
  url.searchParams.delete("token");

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  for (const [key, value] of Object.entries(identityHeaders)) {
    headers.set(key, value);
  }

  return new Request(url.toString(), {
    method: request.method,
    headers,
  });
}
