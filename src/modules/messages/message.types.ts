export type MessageDirection = "inbound" | "outbound" | "internal" | "system";
export type SenderType = "customer" | "agent" | "ai" | "system";
export type MessageStatus = "received" | "sending" | "sent" | "failed";
export type MessageType = "text" | "image" | "file" | "audio" | "video" | "event";

export type MessageAttachment = {
  type: "image" | "file" | "audio" | "video";
  url?: string;
  fileId?: string;
  r2Key?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailR2Key?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  channelAccountId: string;
  externalMessageId: string | null;
  direction: MessageDirection;
  senderType: SenderType;
  senderAdminUserId: string | null;
  clientMessageId: string | null;
  messageType: MessageType;
  content: string | null;
  attachmentsJson: string;
  rawPayloadJson: string | null;
  aiMetadataJson: string;
  aiReferencesJson: string;
  status: MessageStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  channel_account_id: string;
  external_message_id: string | null;
  direction: MessageDirection;
  sender_type: SenderType;
  sender_admin_user_id: string | null;
  client_message_id: string | null;
  message_type: MessageType;
  content: string | null;
  attachments_json: string;
  raw_payload_json: string | null;
  ai_metadata_json: string;
  ai_references_json: string;
  status: MessageStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    channelAccountId: row.channel_account_id,
    externalMessageId: row.external_message_id,
    direction: row.direction,
    senderType: row.sender_type,
    senderAdminUserId: row.sender_admin_user_id,
    clientMessageId: row.client_message_id,
    messageType: row.message_type,
    content: row.content,
    attachmentsJson: row.attachments_json,
    rawPayloadJson: row.raw_payload_json,
    aiMetadataJson: row.ai_metadata_json,
    aiReferencesJson: row.ai_references_json,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseMessageAttachments(value: string | null | undefined): MessageAttachment[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMessageAttachment);
  } catch {
    return [];
  }
}

function isMessageAttachment(value: unknown): value is MessageAttachment {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  if (
    candidate.type !== "image" &&
    candidate.type !== "file" &&
    candidate.type !== "audio" &&
    candidate.type !== "video"
  ) {
    return false;
  }

  return (
    optionalString(candidate.url) &&
    optionalString(candidate.fileId) &&
    optionalString(candidate.r2Key) &&
    optionalString(candidate.mimeType) &&
    optionalString(candidate.fileName) &&
    optionalNumber(candidate.size) &&
    optionalNumber(candidate.width) &&
    optionalNumber(candidate.height) &&
    optionalNumber(candidate.durationMs) &&
    optionalString(candidate.thumbnailR2Key)
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}
