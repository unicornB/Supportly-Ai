import { Hono } from "hono";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";
import { logger } from "../../shared/logger";
import { ok } from "../responses";

export const webhookRoutes = new Hono<AppContext>();

webhookRoutes.post("/:channelAccountId", async (c) => {
  const debugResponse = c.req.query("debug") === "1" || c.req.header("x-debug-response") === "true";
  const services = createServices(c.env);
  const account = await services.channels.getAccount(c.req.param("channelAccountId"));
  const adapter = services.channels.getAdapter(account);

  await adapter.verify(c.req.raw.clone(), account);
  const inboundMessages = await adapter.parseInbound(c.req.raw.clone(), account);

  let accepted = 0;
  let duplicates = 0;
  let aiReplies = 0;
  let aiReplySendFailures = 0;
  const debugResults: Array<{
    conversationId: string;
    inboundMessageId: string;
    duplicate: boolean;
    aiMessage: { id: string; content: string | null; status: string } | null;
    aiReplySent: boolean;
    aiReplySendError?: string;
  }> = [];

  for (const inbound of inboundMessages) {
    const result = await services.conversations.receiveInboundMessage({ channelAccount: account, inbound });
    let aiReplySent = false;
    let aiReplySendError: string | undefined;

    if (result.duplicate) {
      duplicates += 1;
    } else {
      accepted += 1;
    }

    if (result.aiMessage) {
      aiReplies += 1;
      try {
        const sendResult = await adapter.sendMessage(account, {
          conversationId: result.conversationId,
          externalThreadId: inbound.externalThreadId,
          messageId: result.aiMessage.id,
          messageType: "text",
          content: result.aiMessage.content ?? "",
        });
        await services.messages.markSent(result.aiMessage.id, sendResult.externalMessageId);
        aiReplySent = true;
        logger.info("ai_reply_sent", {
          requestId: c.get("requestId"),
          conversationId: result.conversationId,
          messageId: result.aiMessage.id,
          externalMessageId: sendResult.externalMessageId,
        });
      } catch (error) {
        await services.messages.markFailed(
          result.aiMessage.id,
          error instanceof Error ? error.message : "AI reply send failed"
        );
        aiReplySendFailures += 1;
        aiReplySendError = error instanceof Error ? error.message : String(error);
        logger.warn("ai_reply_send_failed", {
          requestId: c.get("requestId"),
          conversationId: result.conversationId,
          messageId: result.aiMessage.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (debugResponse) {
      debugResults.push({
        conversationId: result.conversationId,
        inboundMessageId: result.inboundMessage.id,
        duplicate: result.duplicate,
        aiMessage: result.aiMessage
          ? {
              id: result.aiMessage.id,
              content: result.aiMessage.content,
              status: aiReplySent ? "sent" : result.aiMessage.status,
            }
          : null,
        aiReplySent,
        aiReplySendError,
      });
    }
  }

  const summary = {
    received: inboundMessages.length,
    accepted,
    duplicates,
    aiReplies,
    aiReplySendFailures,
  };

  return ok(debugResponse ? { ...summary, results: debugResults } : summary);
});
