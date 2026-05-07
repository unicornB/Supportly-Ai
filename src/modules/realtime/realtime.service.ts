import type { Env } from "../../config/env";
import { logger } from "../../shared/logger";
import type { Conversation } from "../conversations/conversation.types";
import type { Message } from "../messages/message.types";
import { toWidgetMessage } from "../widget/widget.types";
import type { AdminRealtimeEvent, VisitorRealtimeEvent } from "./realtime.types";

const ADMIN_STREAM_NAME = "admin";
const INTERNAL_NOTIFY_URL = "https://supportly.internal/__notify";

export class RealtimeService {
  constructor(private readonly env: Env) {}

  async notifyMessageCreated(input: { conversation: Conversation; message: Message }): Promise<void> {
    const visitorEvent: VisitorRealtimeEvent = {
      type: "message.new",
      conversationId: input.conversation.id,
      message: toWidgetMessage(input.message),
    };

    const adminMessageEvent: AdminRealtimeEvent = {
      type: "message.new",
      conversationId: input.conversation.id,
      message: input.message,
    };

    const adminConversationEvent: AdminRealtimeEvent = {
      type: "conversation.updated",
      conversation: input.conversation,
    };

    const results = await Promise.allSettled([
      this.notifyVisitor(input.conversation.id, visitorEvent),
      this.notifyAdmin(adminMessageEvent),
      this.notifyAdmin(adminConversationEvent),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn("realtime_notify_failed", {
          conversationId: input.conversation.id,
          messageId: input.message.id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  private async notifyVisitor(conversationId: string, event: VisitorRealtimeEvent): Promise<void> {
    const id = this.env.VISITOR_STREAM.idFromName(conversationId);
    const stub = this.env.VISITOR_STREAM.get(id);
    await this.notify(stub, event);
  }

  private async notifyAdmin(event: AdminRealtimeEvent): Promise<void> {
    const id = this.env.ADMIN_STREAM.idFromName(ADMIN_STREAM_NAME);
    const stub = this.env.ADMIN_STREAM.get(id);
    await this.notify(stub, event);
  }

  private async notify(stub: DurableObjectStub, event: VisitorRealtimeEvent | AdminRealtimeEvent): Promise<void> {
    const response = await stub.fetch(INTERNAL_NOTIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Realtime notify failed with status ${response.status}`);
    }
  }
}

