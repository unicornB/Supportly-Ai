import type { ChannelAccount } from "../modules/channels/channel.types";
import type { ChannelAdapter, InboundMessage, OutboundMessage, SendMessageResult } from "./channel-adapter";

export class WebChatAdapter implements ChannelAdapter {
  readonly type = "web_chat" as const;

  async verify(): Promise<void> {
    return undefined;
  }

  async parseInbound(): Promise<InboundMessage[]> {
    return [];
  }

  async sendMessage(_account: ChannelAccount, message: OutboundMessage): Promise<SendMessageResult> {
    return { externalMessageId: message.messageId };
  }
}
