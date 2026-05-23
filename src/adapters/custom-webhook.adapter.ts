import { z } from "zod";
import { hmacSha256Hex, sha256Hex, timingSafeEqual } from "../gateways/crypto.gateway";
import { AppError } from "../shared/errors";
import { nowIso } from "../shared/time";
import type { ChannelAccount } from "../modules/channels/channel.types";
import type { ChannelAdapter, InboundMessage, OutboundMessage, SendMessageResult } from "./channel-adapter";

const customWebhookSchema = z.object({
  event_id: z.string().optional(),
  event_type: z.string().default("message.created"),
  contact: z
    .object({
      external_id: z.string().optional(),
      name: z.string().optional(),
      avatar_url: z.string().optional(),
    })
    .optional(),
  message: z.object({
    external_id: z.string().optional(),
    type: z.enum(["text", "image", "file", "audio", "video", "event"]).default("text"),
    text: z.string().optional(),
    attachments: z.array(z.record(z.unknown())).default([]),
  }),
  timestamp: z.string().optional(),
});

export class CustomWebhookAdapter implements ChannelAdapter {
  readonly type = "custom_webhook" as const;

  async verify(request: Request, account: ChannelAccount): Promise<void> {
    if (!account.webhookSecretCiphertext) return;

    const signature = request.headers.get("x-supportly-signature");
    if (!signature) {
      throw new AppError("SIGNATURE_INVALID", "Missing webhook signature", 401);
    }

    const rawBody = await request.text();
    const expected = await hmacSha256Hex(account.webhookSecretCiphertext, rawBody);
    if (!timingSafeEqual(signature, expected)) {
      throw new AppError("SIGNATURE_INVALID", "Invalid webhook signature", 401);
    }
  }

  async parseInbound(request: Request, account: ChannelAccount): Promise<InboundMessage[]> {
    const payload = customWebhookSchema.parse(await request.json());
    const externalThreadId = payload.contact?.external_id ?? payload.event_id ?? (await sha256Hex(JSON.stringify(payload)));
    const externalContactId = payload.contact?.external_id ?? `anonymous:${await sha256Hex(`${account.id}:${externalThreadId}`)}`;

    return [
      {
        externalMessageId: payload.message.external_id ?? payload.event_id,
        externalContactId,
        externalThreadId,
        contactName: payload.contact?.name,
        contactAvatarUrl: payload.contact?.avatar_url,
        isAnonymous: !payload.contact?.external_id,
        messageType: payload.message.type,
        content: payload.message.text,
        attachments: payload.message.attachments.map((item) => ({
          type: (typeof item.type === "string" ? item.type : "file") as "image" | "file" | "audio" | "video",
          url: typeof item.url === "string" ? item.url : undefined,
          fileId: typeof item.file_id === "string" ? item.file_id : undefined,
          mimeType: typeof item.mime_type === "string" ? item.mime_type : undefined,
          fileName: typeof item.file_name === "string" ? item.file_name : undefined,
          size: typeof item.size === "number" ? item.size : undefined,
        })),
        rawPayload: payload,
        receivedAt: payload.timestamp ?? nowIso(),
      },
    ];
  }

  async sendMessage(account: ChannelAccount, message: OutboundMessage): Promise<SendMessageResult> {
    if (!account.outboundUrl) {
      return { externalMessageId: message.messageId };
    }

    const payload = {
      event_type: "message.send",
      conversation_id: message.conversationId,
      message_id: message.messageId,
      message: {
        type: message.messageType,
        text: message.content,
        attachments: message.attachments ?? [],
      },
    };

    const body = JSON.stringify(payload);
    const headers = new Headers({ "content-type": "application/json" });
    if (account.webhookSecretCiphertext) {
      headers.set("x-supportly-signature", await hmacSha256Hex(account.webhookSecretCiphertext, body));
    }

    const response = await fetch(account.outboundUrl, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new AppError("MESSAGE_SEND_FAILED", `Outbound webhook failed: ${response.status}`, 502);
    }

    return { externalMessageId: message.messageId };
  }
}
