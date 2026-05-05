import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import type { ChannelAccount, ChannelAccountRow, CreateChannelAccountInput } from "./channel.types";
import { mapChannelAccount } from "./channel.types";

export class ChannelRepository {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<ChannelAccount[]> {
    const result = await this.db
      .prepare(
        `
        SELECT *
        FROM channel_accounts
        ORDER BY created_at DESC
        `
      )
      .all<ChannelAccountRow>();

    return result.results.map(mapChannelAccount);
  }

  async findById(id: string): Promise<ChannelAccount | null> {
    const row = await this.db
      .prepare(
        `
        SELECT *
        FROM channel_accounts
        WHERE id = ?
        LIMIT 1
        `
      )
      .bind(id)
      .first<ChannelAccountRow>();

    return row ? mapChannelAccount(row) : null;
  }

  async create(input: CreateChannelAccountInput): Promise<ChannelAccount> {
    const id = createId("ch");
    const now = nowIso();

    await this.db
      .prepare(
        `
        INSERT INTO channel_accounts (
          id,
          channel_type,
          display_name,
          external_account_id,
          credential_ciphertext,
          webhook_secret_ciphertext,
          outbound_url,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        `
      )
      .bind(
        id,
        input.channelType,
        input.displayName,
        input.externalAccountId ?? null,
        input.credentialCiphertext ?? null,
        input.webhookSecretCiphertext ?? null,
        input.outboundUrl ?? null,
        now,
        now
      )
      .run();

    const account = await this.findById(id);
    if (!account) throw new Error("Created channel account not found");
    return account;
  }
}
