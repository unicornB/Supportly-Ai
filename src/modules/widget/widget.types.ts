import type { Message } from "../messages/message.types";

export type VisitorTokenClaims = {
  version: 1;
  conversationId: string;
  channelAccountId: string;
  visitorId: string;
  exp: number;
};

export type WidgetConversationSession = {
  conversationId: string;
  channelAccountId: string;
  visitorId: string;
  visitorToken: string;
  expiresAt: string;
};

export type WidgetMessage = {
  id: string;
  direction: Message["direction"];
  senderType: Message["senderType"];
  messageType: Message["messageType"];
  content: string | null;
  status: Message["status"];
  createdAt: string;
};

export function toWidgetMessage(message: Message): WidgetMessage {
  return {
    id: message.id,
    direction: message.direction,
    senderType: message.senderType,
    messageType: message.messageType,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt,
  };
}
