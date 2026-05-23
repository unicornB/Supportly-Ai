import type { ChannelService } from "../channels/channel.service";
import type { ConversationRepository } from "../conversations/conversation.repository";
import { AppError } from "../../shared/errors";
import { createId } from "../../shared/ids";
import type { RealtimeService } from "../realtime/realtime.service";
import type { MediaService } from "../media/media.service";
import { MessageRepository } from "./message.repository";

export class MessageService {
  constructor(
    private readonly channels: ChannelService,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly realtime: RealtimeService,
    private readonly media: MediaService
  ) {}

  async listConversationMessages(conversationId: string, afterMessageId?: string) {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }
    await this.conversations.markRead(conversationId);
    return this.messages.listByConversationAfter(conversationId, afterMessageId);
  }

  async sendAgentMessage(input: { conversationId: string; adminUserId?: string; clientMessageId?: string; content: string }) {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }

    if (input.clientMessageId) {
      const existingMessage = await this.messages.findByClientMessageId({
        conversationId: conversation.id,
        senderType: "agent",
        senderAdminUserId: input.adminUserId,
        clientMessageId: input.clientMessageId,
      });
      if (existingMessage) return existingMessage;
    }

    const account = await this.channels.getAccount(conversation.channelAccountId);
    const adapter = this.channels.getAdapter(account);

    const message = await this.messages.createOutbound({
      conversationId: conversation.id,
      channelAccountId: account.id,
      senderAdminUserId: input.adminUserId,
      senderType: "agent",
      clientMessageId: input.clientMessageId,
      content: input.content,
      attachments: [],
      status: "sending",
    });

    try {
      const result = await adapter.sendMessage(account, {
        conversationId: conversation.id,
        externalThreadId: conversation.externalThreadId,
        messageId: message.id,
        messageType: "text",
        content: input.content,
        attachments: [],
      });
      await this.messages.markSent(message.id, result.externalMessageId);
      await this.conversations.touchAfterOutbound(conversation.id, message.id, message.createdAt);
      const sentMessage = await this.messages.findById(message.id);
      const updatedConversation = await this.conversations.findById(conversation.id);
      if (sentMessage && updatedConversation) {
        await this.realtime.notifyMessageCreated({
          conversation: updatedConversation,
          message: sentMessage,
        });
      }
      return sentMessage ?? { ...message, status: "sent" as const, externalMessageId: result.externalMessageId ?? null };
    } catch (error) {
      await this.messages.markFailed(message.id, error instanceof Error ? error.message : "Message send failed");
      throw error;
    }
  }

  async sendAgentMediaMessage(input: {
    conversationId: string;
    adminUserId?: string;
    clientMessageId?: string;
    content?: string;
    file: File;
    fileName?: string;
    mimeType?: string;
  }) {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }

    if (input.clientMessageId) {
      const existingMessage = await this.messages.findByClientMessageId({
        conversationId: conversation.id,
        senderType: "agent",
        senderAdminUserId: input.adminUserId,
        clientMessageId: input.clientMessageId,
      });
      if (existingMessage) return existingMessage;
    }

    const account = await this.channels.getAccount(conversation.channelAccountId);
    const adapter = this.channels.getAdapter(account);
    const messageId = createId("msg");
    const upload = await this.media.storeUpload({
      conversationId: conversation.id,
      messageId,
      file: input.file,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });

    const content = normalizeOptionalContent(input.content);
    const message = await this.messages.createOutbound({
      id: messageId,
      conversationId: conversation.id,
      channelAccountId: account.id,
      senderAdminUserId: input.adminUserId,
      senderType: "agent",
      clientMessageId: input.clientMessageId,
      messageType: upload.messageType,
      content,
      attachments: [upload.attachment],
      status: "sending",
    });

    try {
      const result = await adapter.sendMessage(account, {
        conversationId: conversation.id,
        externalThreadId: conversation.externalThreadId,
        messageId: message.id,
        messageType: upload.messageType,
        content,
        attachments: [upload.attachment],
      });
      await this.messages.markSent(message.id, result.externalMessageId);
      await this.conversations.touchAfterOutbound(conversation.id, message.id, message.createdAt);
      const sentMessage = await this.messages.findById(message.id);
      const updatedConversation = await this.conversations.findById(conversation.id);
      if (sentMessage && updatedConversation) {
        await this.realtime.notifyMessageCreated({
          conversation: updatedConversation,
          message: sentMessage,
        });
      }
      return sentMessage ?? { ...message, status: "sent" as const, externalMessageId: result.externalMessageId ?? null };
    } catch (error) {
      await this.messages.markFailed(message.id, error instanceof Error ? error.message : "Message send failed");
      throw error;
    }
  }

  markSent(id: string, externalMessageId?: string) {
    return this.messages.markSent(id, externalMessageId);
  }

  markFailed(id: string, errorMessage: string) {
    return this.messages.markFailed(id, errorMessage);
  }
}

function normalizeOptionalContent(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
