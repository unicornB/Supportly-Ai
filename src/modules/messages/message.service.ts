import type { ChannelService } from "../channels/channel.service";
import type { ConversationRepository } from "../conversations/conversation.repository";
import { AppError } from "../../shared/errors";
import { MessageRepository } from "./message.repository";

export class MessageService {
  constructor(
    private readonly channels: ChannelService,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository
  ) {}

  async listConversationMessages(conversationId: string) {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }
    await this.conversations.markRead(conversationId);
    return this.messages.listByConversation(conversationId);
  }

  async sendAgentMessage(input: { conversationId: string; adminUserId?: string; content: string }) {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }

    const account = await this.channels.getAccount(conversation.channelAccountId);
    const adapter = this.channels.getAdapter(account);

    const message = await this.messages.createOutbound({
      conversationId: conversation.id,
      channelAccountId: account.id,
      senderAdminUserId: input.adminUserId,
      senderType: "agent",
      content: input.content,
      status: "sending",
    });

    try {
      const result = await adapter.sendMessage(account, {
        conversationId: conversation.id,
        externalThreadId: conversation.externalThreadId,
        messageId: message.id,
        messageType: "text",
        content: input.content,
      });
      await this.messages.markSent(message.id, result.externalMessageId);
      await this.conversations.touchAfterOutbound(conversation.id, message.id, message.createdAt);
    } catch (error) {
      await this.messages.markFailed(message.id, error instanceof Error ? error.message : "Message send failed");
      throw error;
    }

    return message;
  }

  markSent(id: string, externalMessageId?: string) {
    return this.messages.markSent(id, externalMessageId);
  }

  markFailed(id: string, errorMessage: string) {
    return this.messages.markFailed(id, errorMessage);
  }
}
