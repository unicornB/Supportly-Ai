import type { InboundMessage } from "../../adapters/channel-adapter";
import { createId } from "../../shared/ids";
import { stringifyJson } from "../../shared/json";
import { nowIso } from "../../shared/time";
import type { Message, MessageAttachment, MessageRow, MessageType } from "./message.types";
import { mapMessage } from "./message.types";

export type CreateInboundMessageInput = {
  id?: string;
  conversationId: string;
  channelAccountId: string;
  inbound: InboundMessage;
};

export type CreateInboundMessageResult = {
  message: Message;
  created: boolean;
};

export type CreateOutboundMessageInput = {
  id?: string;
  conversationId: string;
  channelAccountId: string;
  senderAdminUserId?: string;
  senderType: "agent" | "ai";
  clientMessageId?: string;
  messageType?: MessageType;
  content: string | null;
  attachments?: MessageAttachment[];
  status: "sending" | "sent" | "failed";
  aiMetadata?: unknown;
  aiReferences?: unknown;
};

export class MessageRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<Message | null> {
    const row = await this.db.prepare("SELECT * FROM messages WHERE id = ? LIMIT 1").bind(id).first<MessageRow>();
    return row ? mapMessage(row) : null;
  }

  async findByExternalMessageId(channelAccountId: string, externalMessageId: string): Promise<Message | null> {
    const row = await this.db
      .prepare(
        `
        SELECT *
        FROM messages
        WHERE channel_account_id = ?
          AND external_message_id = ?
        LIMIT 1
        `
      )
      .bind(channelAccountId, externalMessageId)
      .first<MessageRow>();

    return row ? mapMessage(row) : null;
  }

  async findByClientMessageId(input: {
    conversationId: string;
    senderType: "agent" | "ai";
    senderAdminUserId?: string;
    clientMessageId: string;
  }): Promise<Message | null> {
    const row = await this.db
      .prepare(
        `
        SELECT *
        FROM messages
        WHERE conversation_id = ?
          AND sender_type = ?
          AND (
            (? IS NULL AND sender_admin_user_id IS NULL)
            OR sender_admin_user_id = ?
          )
          AND client_message_id = ?
        LIMIT 1
        `
      )
      .bind(
        input.conversationId,
        input.senderType,
        input.senderAdminUserId ?? null,
        input.senderAdminUserId ?? null,
        input.clientMessageId
      )
      .first<MessageRow>();

    return row ? mapMessage(row) : null;
  }

  async listByConversation(conversationId: string, limit = 100): Promise<Message[]> {
    const result = await this.db
      .prepare(
        `
        SELECT *
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        LIMIT ?
        `
      )
      .bind(conversationId, limit)
      .all<MessageRow>();

    return result.results.map(mapMessage);
  }

  async listByConversationAfter(conversationId: string, afterMessageId?: string, limit = 100): Promise<Message[]> {
    if (!afterMessageId) {
      return this.listByConversation(conversationId, limit);
    }

    const anchor = await this.findById(afterMessageId);
    if (!anchor || anchor.conversationId !== conversationId) {
      return [];
    }

    const result = await this.db
      .prepare(
        `
        SELECT *
        FROM messages
        WHERE conversation_id = ?
          AND (
            created_at > ?
            OR (created_at = ? AND id > ?)
          )
        ORDER BY created_at ASC, id ASC
        LIMIT ?
        `
      )
      .bind(conversationId, anchor.createdAt, anchor.createdAt, anchor.id, limit)
      .all<MessageRow>();

    return result.results.map(mapMessage);
  }

  async createInbound(input: CreateInboundMessageInput): Promise<CreateInboundMessageResult> {
    const id = input.id ?? createId("msg");
    const now = input.inbound.receivedAt || nowIso();

    await this.db
      .prepare(
        `
        INSERT OR IGNORE INTO messages (
          id,
          conversation_id,
          channel_account_id,
          external_message_id,
          direction,
          sender_type,
          message_type,
          content,
          attachments_json,
          raw_payload_json,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 'inbound', 'customer', ?, ?, ?, ?, 'received', ?, ?)
        `
      )
      .bind(
        id,
        input.conversationId,
        input.channelAccountId,
        input.inbound.externalMessageId ?? null,
        input.inbound.messageType,
        input.inbound.content ?? null,
        stringifyJson(input.inbound.attachments),
        stringifyJson(input.inbound.rawPayload),
        now,
        now
      )
      .run();

    const message = await this.findById(id);
    if (message) return { message, created: true };

    if (input.inbound.externalMessageId) {
      const existingMessage = await this.findByExternalMessageId(input.channelAccountId, input.inbound.externalMessageId);
      if (existingMessage) return { message: existingMessage, created: false };
    }

    throw new Error("Created inbound message not found");
  }

  async createOutbound(input: CreateOutboundMessageInput): Promise<Message> {
    const id = input.id ?? createId("msg");
    const now = nowIso();

    await this.db
      .prepare(
        `
        INSERT INTO messages (
          id,
          conversation_id,
          channel_account_id,
          direction,
          sender_type,
          sender_admin_user_id,
          client_message_id,
          message_type,
          content,
          attachments_json,
          ai_metadata_json,
          ai_references_json,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        id,
        input.conversationId,
        input.channelAccountId,
        input.senderType,
        input.senderAdminUserId ?? null,
        input.clientMessageId ?? null,
        input.messageType ?? "text",
        input.content,
        stringifyJson(input.attachments ?? []),
        stringifyJson(input.aiMetadata ?? {}),
        stringifyJson(input.aiReferences ?? []),
        input.status,
        now,
        now
      )
      .run();

    const message = await this.findById(id);
    if (!message) throw new Error("Created outbound message not found");
    return message;
  }

  async markSent(id: string, externalMessageId?: string): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE messages
        SET status = 'sent',
            external_message_id = COALESCE(?, external_message_id),
            updated_at = ?
        WHERE id = ?
        `
      )
      .bind(externalMessageId ?? null, nowIso(), id)
      .run();
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE messages
        SET status = 'failed',
            error_message = ?,
            updated_at = ?
        WHERE id = ?
        `
      )
      .bind(errorMessage, nowIso(), id)
      .run();
  }
}
