export type MaybeReplyInput = {
  conversationId: string;
  channelAccountId: string;
  messageContent: string | null;
  handoffStatus: "bot" | "agent";
};
