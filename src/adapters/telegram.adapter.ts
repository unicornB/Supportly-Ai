import { z } from "zod";
import type { ChannelAccount } from "../modules/channels/channel.types";
import { AppError } from "../shared/errors";
import { timingSafeEqual } from "../gateways/crypto.gateway";
import type { ChannelAdapter, InboundMessage, OutboundMessage, SendMessageResult } from "./channel-adapter";

const telegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

const telegramChatSchema = z.object({
  id: z.number(),
  type: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  title: z.string().optional(),
});

const telegramMessageSchema = z.object({
  message_id: z.number(),
  date: z.number(),
  chat: telegramChatSchema,
  from: telegramUserSchema.optional(),
  text: z.string().optional(),
});

const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
});

const telegramSendMessageResponseSchema = z.object({
  ok: z.boolean(),
  result: z
    .object({
      message_id: z.number(),
    })
    .optional(),
  description: z.string().optional(),
});

const telegramSetWebhookResponseSchema = z.object({
  ok: z.boolean(),
  result: z.boolean().optional(),
  description: z.string().optional(),
});

const telegramGetMeResponseSchema = z.object({
  ok: z.boolean(),
  result: telegramUserSchema
    .extend({
      can_join_groups: z.boolean().optional(),
      can_read_all_group_messages: z.boolean().optional(),
      supports_inline_queries: z.boolean().optional(),
    })
    .optional(),
  description: z.string().optional(),
});

const telegramWebhookInfoResponseSchema = z.object({
  ok: z.boolean(),
  result: z
    .object({
      url: z.string(),
      has_custom_certificate: z.boolean().optional(),
      pending_update_count: z.number(),
      ip_address: z.string().optional(),
      last_error_date: z.number().optional(),
      last_error_message: z.string().optional(),
      last_synchronization_error_date: z.number().optional(),
      max_connections: z.number().optional(),
      allowed_updates: z.array(z.string()).optional(),
    })
    .optional(),
  description: z.string().optional(),
});

export type TelegramSetWebhookResult = {
  ok: boolean;
  description?: string;
  webhookUrl: string;
  webhookInfo: TelegramWebhookInfo;
};

export type TelegramBotInfo = {
  id: number;
  isBot?: boolean;
  firstName?: string;
  username?: string;
};

export type TelegramWebhookInfo = {
  url: string;
  pendingUpdateCount: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
  allowedUpdates?: string[];
};

export type TelegramTestResult = {
  bot: TelegramBotInfo;
  webhookInfo: TelegramWebhookInfo;
  webhookUrlMatches: boolean;
  expectedWebhookUrl?: string;
};

export class TelegramAdapter implements ChannelAdapter {
  readonly type = "telegram" as const;

  async verify(request: Request, account: ChannelAccount): Promise<void> {
    if (!account.webhookSecretCiphertext) return;

    const token = request.headers.get("x-telegram-bot-api-secret-token");
    if (!token || !timingSafeEqual(token, account.webhookSecretCiphertext)) {
      throw new AppError("SIGNATURE_INVALID", "Invalid Telegram webhook secret", 401);
    }
  }

  async parseInbound(request: Request): Promise<InboundMessage[]> {
    const update = telegramUpdateSchema.parse(await request.json());
    const message = update.message;

    if (!message?.text?.trim() || !message.from) {
      return [];
    }

    return [
      {
        externalMessageId: String(update.update_id),
        externalContactId: String(message.from.id),
        externalThreadId: String(message.chat.id),
        contactName: buildTelegramName(message.from) ?? buildTelegramName(message.chat),
        isAnonymous: false,
        messageType: "text",
        content: message.text,
        attachments: [],
        rawPayload: update,
        receivedAt: new Date(message.date * 1000).toISOString(),
      },
    ];
  }

  async sendMessage(account: ChannelAccount, message: OutboundMessage): Promise<SendMessageResult> {
    if (message.messageType !== "text") {
      throw new AppError("MESSAGE_TYPE_NOT_SUPPORTED", "Telegram media outbound is not supported yet", 400);
    }

    const token = account.credentialCiphertext;
    if (!token) {
      throw new AppError("CHANNEL_CREDENTIAL_MISSING", "Telegram bot token is missing", 400);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: message.externalThreadId,
        text: message.content ?? "",
      }),
    });

    const body = telegramSendMessageResponseSchema.parse(await response.json().catch(() => ({ ok: false })));
    if (!response.ok || !body.ok || !body.result) {
      throw new AppError(
        "MESSAGE_SEND_FAILED",
        `Telegram sendMessage failed: ${response.status}${body.description ? ` ${body.description}` : ""}`,
        502
      );
    }

    return { externalMessageId: String(body.result.message_id) };
  }

  async setWebhook(
    account: ChannelAccount,
    input: { webhookUrl: string; dropPendingUpdates?: boolean }
  ): Promise<TelegramSetWebhookResult> {
    const body = telegramSetWebhookResponseSchema.parse(
      await this.callTelegram(account, "setWebhook", {
        url: input.webhookUrl,
        secret_token: account.webhookSecretCiphertext || undefined,
        allowed_updates: ["message"],
        drop_pending_updates: input.dropPendingUpdates ?? false,
      })
    );

    if (!body.ok || !body.result) {
      throw new AppError("TELEGRAM_SET_WEBHOOK_FAILED", body.description ?? "Telegram setWebhook failed", 502);
    }

    return {
      ok: true,
      description: body.description,
      webhookUrl: input.webhookUrl,
      webhookInfo: await this.getWebhookInfo(account),
    };
  }

  async testConnection(account: ChannelAccount, expectedWebhookUrl?: string): Promise<TelegramTestResult> {
    const bot = await this.getMe(account);
    const webhookInfo = await this.getWebhookInfo(account);
    return {
      bot,
      webhookInfo,
      webhookUrlMatches: expectedWebhookUrl ? webhookInfo.url === expectedWebhookUrl : Boolean(webhookInfo.url),
      expectedWebhookUrl,
    };
  }

  async getMe(account: ChannelAccount): Promise<TelegramBotInfo> {
    const body = telegramGetMeResponseSchema.parse(await this.callTelegram(account, "getMe"));
    if (!body.ok || !body.result) {
      throw new AppError("TELEGRAM_GET_ME_FAILED", body.description ?? "Telegram getMe failed", 502);
    }

    return {
      id: body.result.id,
      isBot: body.result.is_bot,
      firstName: body.result.first_name,
      username: body.result.username,
    };
  }

  async getWebhookInfo(account: ChannelAccount): Promise<TelegramWebhookInfo> {
    const body = telegramWebhookInfoResponseSchema.parse(await this.callTelegram(account, "getWebhookInfo"));
    if (!body.ok || !body.result) {
      throw new AppError("TELEGRAM_GET_WEBHOOK_INFO_FAILED", body.description ?? "Telegram getWebhookInfo failed", 502);
    }

    return {
      url: body.result.url,
      pendingUpdateCount: body.result.pending_update_count,
      lastErrorDate: body.result.last_error_date,
      lastErrorMessage: body.result.last_error_message,
      allowedUpdates: body.result.allowed_updates,
    };
  }

  private async callTelegram(account: ChannelAccount, method: string, payload?: Record<string, unknown>): Promise<unknown> {
    const token = account.credentialCiphertext;
    if (!token) {
      throw new AppError("CHANNEL_CREDENTIAL_MISSING", "Telegram bot token is missing", 400);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const body = await response.json().catch(() => ({ ok: false }));
    if (!response.ok) {
      const description =
        typeof body === "object" && body && "description" in body ? String(body.description) : `HTTP ${response.status}`;
      throw new AppError("TELEGRAM_API_FAILED", `Telegram ${method} failed: ${description}`, 502);
    }

    return body;
  }
}

function buildTelegramName(user: {
  first_name?: string;
  last_name?: string;
  username?: string;
  title?: string;
}): string | undefined {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || user.title || undefined;
}
