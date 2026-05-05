import { AppError } from "../shared/errors";
import type { ChannelAccount, ChannelType } from "../modules/channels/channel.types";

export type MessageAttachment = {
  type: "image" | "file" | "audio" | "video";
  url?: string;
  fileId?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
};

export type InboundMessage = {
  externalMessageId?: string;
  externalContactId: string;
  externalThreadId: string;
  contactName?: string;
  contactAvatarUrl?: string;
  isAnonymous: boolean;
  messageType: "text" | "image" | "file" | "audio" | "event";
  content?: string;
  attachments: MessageAttachment[];
  rawPayload: unknown;
  receivedAt: string;
};

export type OutboundMessage = {
  conversationId: string;
  externalThreadId: string;
  messageId: string;
  messageType: "text";
  content: string;
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
