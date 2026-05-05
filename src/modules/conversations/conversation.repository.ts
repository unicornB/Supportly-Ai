import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import type { Conversation, ConversationRow, CreateConversationInput, HandoffStatus } from "./conversation.types";
import { mapConversation } from "./conversation.types";

export class ConversationRepository {
  constructor(private readonly db: D1Database) {}

  async listOpen(limit = 50): Promise<Conversation[]> {
    const result = await this.db
      .prepare(
        `
        SELECT *
        FROM conversations
        WHERE status = 'open'
        ORDER BY last_message_at DESC
        LIMIT ?
        `
      )
      .bind(limit)
      .all<ConversationRow>();

    return result.results.map(mapConversation);
  }

  async findById(id: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare("SELECT * FROM conversations WHERE id = ? LIMIT 1")
      .bind(id)
      .first<ConversationRow>();

    return row ? mapConversation(row) : null;
  }

  async findByExternalThread(channelAccountId: string, externalThreadId: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare(
        `
        SELECT *
        FROM conversations
        WHERE channel_account_id = ?
          AND external_thread_id = ?
        LIMIT 1
        `
      )
      .bind(channelAccountId, externalThreadId)
      .first<ConversationRow>();

    return row ? mapConversation(row) : null;
  }

  async create(input: CreateConversationInput): Promise<Conversation> {
    const id = createId("conv");
    const now = nowIso();

    await this.db
      .prepare(
        `
        INSERT INTO conversations (
          id,
          channel_account_id,
          external_contact_id,
          external_thread_id,
          contact_name,
          contact_avatar_url,
          is_anonymous,
          status,
          handoff_status,
          unread_count,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'bot', 0, ?, ?)
        `
      )
      .bind(
        id,
        input.channelAccountId,
        input.externalContactId,
        input.externalThreadId,
        input.contactName ?? null,
        input.contactAvatarUrl ?? null,
        input.isAnonymous ? 1 : 0,
        now,
        now
      )
      .run();

    const conversation = await this.findById(id);
    if (!conversation) throw new Error("Created conversation not found");
    return conversation;
  }

  async findOrCreateByExternalThread(input: CreateConversationInput): Promise<Conversation> {
    const existing = await this.findByExternalThread(input.channelAccountId, input.externalThreadId);
    return existing ?? this.create(input);
  }

  async touchAfterInbound(conversationId: string, messageId: string, at: string): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE conversations
        SET last_message_id = ?,
            last_message_at = ?,
            unread_count = unread_count + 1,
            updated_at = ?
        WHERE id = ?
        `
      )
      .bind(messageId, at, at, conversationId)
      .run();
  }

  async touchAfterOutbound(conversationId: string, messageId: string, at: string): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE conversations
        SET last_message_id = ?,
            last_message_at = ?,
            updated_at = ?
        WHERE id = ?
        `
      )
      .bind(messageId, at, at, conversationId)
      .run();
  }

  async markRead(conversationId: string): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE conversations
        SET unread_count = 0,
            updated_at = ?
        WHERE id = ?
          AND unread_count > 0
        `
      )
      .bind(nowIso(), conversationId)
      .run();
  }

  async setHandoffStatus(conversationId: string, status: HandoffStatus): Promise<void> {
    await this.db
      .prepare("UPDATE conversations SET handoff_status = ?, updated_at = ? WHERE id = ?")
      .bind(status, nowIso(), conversationId)
      .run();
  }

  async resolve(conversationId: string): Promise<void> {
    const now = nowIso();
    await this.db
      .prepare("UPDATE conversations SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, conversationId)
      .run();
  }
}
