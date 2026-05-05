export type ConversationStatus = "open" | "pending" | "resolved";
export type HandoffStatus = "bot" | "agent";

export type Conversation = {
  id: string;
  channelAccountId: string;
  externalContactId: string;
  externalThreadId: string;
  contactName: string | null;
  contactAvatarUrl: string | null;
  isAnonymous: boolean;
  status: ConversationStatus;
  handoffStatus: HandoffStatus;
  assigneeAdminUserId: string | null;
  lastMessageId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type ConversationRow = {
  id: string;
  channel_account_id: string;
  external_contact_id: string;
  external_thread_id: string;
  contact_name: string | null;
  contact_avatar_url: string | null;
  is_anonymous: number;
  status: ConversationStatus;
  handoff_status: HandoffStatus;
  assignee_admin_user_id: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type CreateConversationInput = {
  channelAccountId: string;
  externalContactId: string;
  externalThreadId: string;
  contactName?: string;
  contactAvatarUrl?: string;
  isAnonymous: boolean;
};

export function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    channelAccountId: row.channel_account_id,
    externalContactId: row.external_contact_id,
    externalThreadId: row.external_thread_id,
    contactName: row.contact_name,
    contactAvatarUrl: row.contact_avatar_url,
    isAnonymous: row.is_anonymous === 1,
    status: row.status,
    handoffStatus: row.handoff_status,
    assigneeAdminUserId: row.assignee_admin_user_id,
    lastMessageId: row.last_message_id,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}
