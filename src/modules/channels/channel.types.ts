export type ChannelType = "custom_webhook" | "telegram" | "whatsapp" | "wechat" | "web_chat";

export type ChannelStatus = "active" | "disabled" | "error";

export type ChannelAccount = {
  id: string;
  channelType: ChannelType;
  displayName: string;
  externalAccountId: string | null;
  credentialCiphertext: string | null;
  webhookSecretCiphertext: string | null;
  outboundUrl: string | null;
  status: ChannelStatus;
  createdAt: string;
  updatedAt: string;
};

export type ChannelAccountRow = {
  id: string;
  channel_type: ChannelType;
  display_name: string;
  external_account_id: string | null;
  credential_ciphertext: string | null;
  webhook_secret_ciphertext: string | null;
  outbound_url: string | null;
  status: ChannelStatus;
  created_at: string;
  updated_at: string;
};

export type CreateChannelAccountInput = {
  channelType: ChannelType;
  displayName: string;
  externalAccountId?: string;
  credentialCiphertext?: string;
  webhookSecretCiphertext?: string;
  outboundUrl?: string;
};

export function mapChannelAccount(row: ChannelAccountRow): ChannelAccount {
  return {
    id: row.id,
    channelType: row.channel_type,
    displayName: row.display_name,
    externalAccountId: row.external_account_id,
    credentialCiphertext: row.credential_ciphertext,
    webhookSecretCiphertext: row.webhook_secret_ciphertext,
    outboundUrl: row.outbound_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
