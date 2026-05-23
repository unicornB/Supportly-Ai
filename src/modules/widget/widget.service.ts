import { AppError } from "../../shared/errors";
import {
  base64UrlDecodeToString,
  base64UrlEncode,
  hmacSha256Base64Url,
  timingSafeEqual,
} from "../../gateways/crypto.gateway";
import { createId } from "../../shared/ids";
import { logger } from "../../shared/logger";
import { nowIso } from "../../shared/time";
import type { ChannelAccount } from "../channels/channel.types";
import type { ChannelService } from "../channels/channel.service";
import type { ConversationRepository } from "../conversations/conversation.repository";
import type { ConversationService } from "../conversations/conversation.service";
import type { MediaService } from "../media/media.service";
import type { MessageRepository } from "../messages/message.repository";
import type { Message } from "../messages/message.types";
import type { RealtimeService } from "../realtime/realtime.service";
import type { VisitorTokenClaims } from "./widget.types";
import { toWidgetMessage } from "./widget.types";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export class WidgetService {
  constructor(
    private readonly channels: ChannelService,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly conversationService: ConversationService,
    private readonly realtime: RealtimeService,
    private readonly media: MediaService,
    private readonly tokenSecret: string
  ) {}

  async createConversation(input: {
    channelAccountId: string;
    visitorId: string;
    pageUrl?: string;
    pageTitle?: string;
  }) {
    const account = await this.channels.getAccount(input.channelAccountId);
    this.assertWebChatChannel(account);

    const visitorId = normalizeVisitorId(input.visitorId);
    const conversation = await this.conversations.findOrCreateByExternalThread({
      channelAccountId: account.id,
      externalContactId: visitorId,
      externalThreadId: visitorId,
      contactName: "匿名访客",
      isAnonymous: true,
    });

    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const visitorToken = await this.signToken({
      version: 1,
      conversationId: conversation.id,
      channelAccountId: account.id,
      visitorId,
      exp: expiresAt,
    });

    return {
      conversationId: conversation.id,
      channelAccountId: account.id,
      visitorId,
      visitorToken,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  async sendVisitorMediaMessage(input: {
    conversationId: string;
    token: string;
    clientMessageId?: string;
    content?: string;
    file: File;
    fileName?: string;
    mimeType?: string;
    pageUrl?: string;
    pageTitle?: string;
  }) {
    const claims = await this.verifyConversationAccess(input.conversationId, input.token);
    const account = await this.channels.getAccount(claims.channelAccountId);
    this.assertWebChatChannel(account);

    const externalMessageId = input.clientMessageId
      ? `widget:${claims.visitorId}:${input.clientMessageId}`
      : createId("widget_evt");
    const existingMessage = await this.messages.findByExternalMessageId(account.id, externalMessageId);
    if (existingMessage) {
      return {
        conversationId: existingMessage.conversationId,
        inboundMessage: toWidgetMessage(existingMessage),
        aiMessage: null,
        duplicate: true,
      };
    }

    const messageId = createId("msg");
    const upload = await this.media.storeUpload({
      conversationId: input.conversationId,
      messageId,
      file: input.file,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });

    const result = await this.conversationService.receiveInboundMessage({
      channelAccount: account,
      inbound: {
        externalMessageId,
        externalContactId: claims.visitorId,
        externalThreadId: claims.visitorId,
        contactName: "匿名访客",
        isAnonymous: true,
        messageType: upload.messageType,
        content: normalizeOptionalContent(input.content),
        attachments: [upload.attachment],
        rawPayload: {
          source: "web_chat_widget",
          pageUrl: input.pageUrl,
          pageTitle: input.pageTitle,
        },
        receivedAt: nowIso(),
      },
      messageId,
    }, { createAiReply: false });

    if (!result.duplicate) {
      await this.notifyVisitorMessageResult(result);
    }

    return {
      conversationId: result.conversationId,
      inboundMessage: toWidgetMessage(result.inboundMessage),
      aiMessage: null,
      duplicate: result.duplicate,
    };
  }

  async sendVisitorMessage(input: {
    conversationId: string;
    token: string;
    clientMessageId?: string;
    content: string;
    pageUrl?: string;
    pageTitle?: string;
  }, options: { createAiReply?: boolean; notifyRealtime?: boolean } = {}) {
    const claims = await this.verifyConversationAccess(input.conversationId, input.token);
    const account = await this.channels.getAccount(claims.channelAccountId);
    this.assertWebChatChannel(account);

    const result = await this.conversationService.receiveInboundMessage({
      channelAccount: account,
      inbound: {
        externalMessageId: input.clientMessageId
          ? `widget:${claims.visitorId}:${input.clientMessageId}`
          : createId("widget_evt"),
        externalContactId: claims.visitorId,
        externalThreadId: claims.visitorId,
        contactName: "匿名访客",
        isAnonymous: true,
        messageType: "text",
        content: input.content.trim(),
        attachments: [],
        rawPayload: {
          source: "web_chat_widget",
          pageUrl: input.pageUrl,
          pageTitle: input.pageTitle,
        },
        receivedAt: nowIso(),
      },
    }, { createAiReply: options.createAiReply });

    if (result.aiMessage) {
      await this.messages.markSent(result.aiMessage.id, result.aiMessage.id);
    }

    if (options.notifyRealtime !== false) {
      await this.notifyVisitorMessageResult(result);
    }

    return {
      conversationId: result.conversationId,
      inboundMessage: toWidgetMessage(result.inboundMessage),
      aiMessage: result.aiMessage ? toWidgetMessage({ ...result.aiMessage, status: "sent" }) : null,
      duplicate: result.duplicate,
    };
  }

  async completeVisitorMessage(input: { conversationId: string; inboundMessageId: string }): Promise<void> {
    try {
      const conversation = await this.conversations.findById(input.conversationId);
      const inboundMessage = await this.messages.findById(input.inboundMessageId);
      if (!conversation || !inboundMessage || inboundMessage.conversationId !== conversation.id) return;

      await this.realtime.notifyMessageCreated({
        conversation,
        message: inboundMessage,
      });

      const aiMessage = await this.conversationService.createAiReply({
        conversationId: conversation.id,
        channelAccountId: conversation.channelAccountId,
        messageContent: inboundMessage.content,
        handoffStatus: conversation.handoffStatus,
      });
      if (!aiMessage) return;

      await this.messages.markSent(aiMessage.id, aiMessage.id);

      const updatedConversation = (await this.conversations.findById(conversation.id)) ?? conversation;
      await this.realtime.notifyMessageCreated({
        conversation: updatedConversation,
        message: { ...aiMessage, status: "sent" },
      });
    } catch (error) {
      logger.warn("widget_message_background_failed", {
        conversationId: input.conversationId,
        inboundMessageId: input.inboundMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async notifyVisitorMessageResult(result: {
    conversationId: string;
    inboundMessage: Message;
    aiMessage: Message | null;
    duplicate: boolean;
  }): Promise<void> {
    const conversation = result.duplicate ? null : await this.conversations.findById(result.conversationId);
    if (conversation) {
      await this.realtime.notifyMessageCreated({
        conversation,
        message: result.inboundMessage,
      });

      if (result.aiMessage) {
        await this.realtime.notifyMessageCreated({
          conversation,
          message: { ...result.aiMessage, status: "sent" },
        });
      }
    }
  }

  async listMessages(input: { conversationId: string; token: string; afterMessageId?: string }) {
    await this.verifyConversationAccess(input.conversationId, input.token);
    const messages = await this.messages.listByConversationAfter(input.conversationId, input.afterMessageId, 100);
    return messages.map(toWidgetMessage);
  }

  requireConversationAccess(conversationId: string, token: string): Promise<VisitorTokenClaims> {
    return this.verifyConversationAccess(conversationId, token);
  }

  private assertWebChatChannel(account: ChannelAccount): void {
    if (account.channelType !== "web_chat") {
      throw new AppError("CHANNEL_NOT_WEB_CHAT", "Channel is not a Web Chat channel", 400);
    }
    if (account.status !== "active") {
      throw new AppError("CHANNEL_INACTIVE", "Channel is not active", 400);
    }
  }

  private async verifyConversationAccess(conversationId: string, token: string): Promise<VisitorTokenClaims> {
    const claims = await this.verifyToken(token);
    if (claims.conversationId !== conversationId) {
      throw new AppError("VISITOR_TOKEN_INVALID", "Visitor token does not match conversation", 401);
    }

    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }
    if (
      conversation.channelAccountId !== claims.channelAccountId ||
      conversation.externalContactId !== claims.visitorId ||
      conversation.externalThreadId !== claims.visitorId
    ) {
      throw new AppError("VISITOR_TOKEN_INVALID", "Visitor token does not match conversation", 401);
    }

    return claims;
  }

  private async signToken(claims: VisitorTokenClaims): Promise<string> {
    const payload = base64UrlEncode(JSON.stringify(claims));
    const signature = await hmacSha256Base64Url(this.tokenSecret, payload);
    return `${payload}.${signature}`;
  }

  private async verifyToken(token: string): Promise<VisitorTokenClaims> {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) {
      throw new AppError("VISITOR_TOKEN_INVALID", "Visitor token is invalid", 401);
    }

    const expectedSignature = await hmacSha256Base64Url(this.tokenSecret, payload);
    if (!timingSafeEqual(signature, expectedSignature)) {
      throw new AppError("VISITOR_TOKEN_INVALID", "Visitor token is invalid", 401);
    }

    const claims = parseClaims(payload);
    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new AppError("VISITOR_TOKEN_EXPIRED", "Visitor token has expired", 401);
    }

    return claims;
  }
}

function normalizeOptionalContent(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeVisitorId(visitorId: string): string {
  const normalized = visitorId.trim();
  if (!normalized) {
    throw new AppError("VISITOR_ID_REQUIRED", "Visitor id is required", 400);
  }
  return normalized;
}

function parseClaims(payload: string): VisitorTokenClaims {
  try {
    const value = JSON.parse(base64UrlDecodeToString(payload)) as Partial<VisitorTokenClaims>;
    if (
      value.version !== 1 ||
      typeof value.conversationId !== "string" ||
      typeof value.channelAccountId !== "string" ||
      typeof value.visitorId !== "string" ||
      typeof value.exp !== "number"
    ) {
      throw new Error("Invalid claims");
    }

    return value as VisitorTokenClaims;
  } catch {
    throw new AppError("VISITOR_TOKEN_INVALID", "Visitor token is invalid", 401);
  }
}
