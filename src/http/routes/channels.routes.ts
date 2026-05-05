import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";
import type { ChannelAccount } from "../../modules/channels/channel.types";
import { TelegramAdapter } from "../../adapters/telegram.adapter";
import { AppError } from "../../shared/errors";
import { authMiddleware } from "../middleware/auth.middleware";
import { created, ok } from "../responses";

const createChannelSchema = z.object({
  channelType: z.enum(["custom_webhook", "telegram", "whatsapp", "wechat", "web_chat"]),
  displayName: z.string().min(1),
  externalAccountId: z.string().optional(),
  credentialCiphertext: z.string().optional(),
  webhookSecretCiphertext: z.string().optional(),
  outboundUrl: z.string().url().optional(),
});

const telegramWebhookSchema = z.object({
  webhookUrl: z.string().url().optional(),
  dropPendingUpdates: z.boolean().optional(),
});

export const channelsRoutes = new Hono<AppContext>();

channelsRoutes.use("*", authMiddleware());

channelsRoutes.get("/", async (c) => {
  const services = createServices(c.env);
  return ok((await services.channels.listAccounts()).map(toChannelView));
});

channelsRoutes.post("/", async (c) => {
  const input = createChannelSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return created(toChannelView(await services.channels.createAccount(input)));
});

channelsRoutes.post("/:id/telegram/set-webhook", async (c) => {
  const input = telegramWebhookSchema.parse(await c.req.json().catch(() => ({})));
  const services = createServices(c.env);
  const account = await services.channels.getAccount(c.req.param("id"));
  const adapter = getTelegramAdapter(services.channels.getAdapter(account));

  return ok(
    await adapter.setWebhook(account, {
      webhookUrl: input.webhookUrl ?? buildWebhookUrl(c.req.url, account.id),
      dropPendingUpdates: input.dropPendingUpdates,
    })
  );
});

channelsRoutes.post("/:id/telegram/test", async (c) => {
  const input = telegramWebhookSchema.pick({ webhookUrl: true }).parse(await c.req.json().catch(() => ({})));
  const services = createServices(c.env);
  const account = await services.channels.getAccount(c.req.param("id"));
  const adapter = getTelegramAdapter(services.channels.getAdapter(account));
  return ok(await adapter.testConnection(account, input.webhookUrl ?? buildWebhookUrl(c.req.url, account.id)));
});

function toChannelView(account: ChannelAccount) {
  return {
    ...account,
    credentialCiphertext: null,
  };
}

function getTelegramAdapter(adapter: unknown): TelegramAdapter {
  if (adapter instanceof TelegramAdapter) return adapter;
  throw new AppError("CHANNEL_NOT_TELEGRAM", "Channel is not a Telegram channel", 400);
}

function buildWebhookUrl(requestUrl: string, channelAccountId: string) {
  const url = new URL(requestUrl);
  return `${url.origin}/webhooks/${channelAccountId}`;
}
