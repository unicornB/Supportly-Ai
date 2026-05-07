import type { Conversation } from "../conversations/conversation.types";
import type { Message } from "../messages/message.types";
import type { WidgetMessage } from "../widget/widget.types";

export type ConnectedEvent = {
  type: "connected";
  connectionKind: "visitor" | "admin";
  serverTime: string;
};

export type ErrorEvent = {
  type: "error";
  code: string;
  message: string;
};

export type PongEvent = {
  type: "pong";
  serverTime: string;
};

export type VisitorMessageNewEvent = {
  type: "message.new";
  conversationId: string;
  message: WidgetMessage;
};

export type AdminMessageNewEvent = {
  type: "message.new";
  conversationId: string;
  message: Message;
};

export type AdminConversationUpdatedEvent = {
  type: "conversation.updated";
  conversation: Conversation;
};

export type VisitorRealtimeEvent = ConnectedEvent | ErrorEvent | PongEvent | VisitorMessageNewEvent;

export type AdminRealtimeEvent =
  | ConnectedEvent
  | ErrorEvent
  | PongEvent
  | AdminMessageNewEvent
  | AdminConversationUpdatedEvent;

