import { AppError } from "../shared/errors";
import type { ChannelAccount, ChannelType } from "../modules/channels/channel.types";
import type { MessageAttachment, MessageType } from "../modules/messages/message.types";

export type InboundMessage = {
  externalMessageId?: string;
  externalContactId: string;
  externalThreadId: string;
  contactName?: string;
  contactAvatarUrl?: string;
  isAnonymous: boolean;
  messageType: MessageType;
  content?: string;
  attachments: MessageAttachment[];
  rawPayload: unknown;
  receivedAt: string;
};

export type OutboundMessage = {
  conversationId: string;
  externalThreadId: string;
  messageId: string;
  messageType: MessageType;
  content: string | null;
  attachments?: MessageAttachment[];
};

export type SendMessageResult = {
  externalMessageId?: string;
};

export interface ChannelAdapter {
  readonly type: ChannelType;
  verify(request: Request, account: ChannelAccount): Promise<void>;
  parseInbound(request: Request, account: ChannelAccount): Promise<InboundMessage[]>;
  sendMessage(account: ChannelAccount, message: OutboundMessage): Promise<SendMessageResult>;
}

export class AdapterRegistry {
  constructor(private readonly adapters: ChannelAdapter[]) {}

  get(type: ChannelType): ChannelAdapter {
    const adapter = this.adapters.find((item) => item.type === type);
    if (!adapter) {
      throw new AppError("CHANNEL_NOT_SUPPORTED", `Unsupported channel: ${type}`, 400);
    }
    return adapter;
  }
}
