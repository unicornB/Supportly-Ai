import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  MEDIA_FOLDER_PREFIX,
} from "../../config/constants";
import { AppError } from "../../shared/errors";
import { createId } from "../../shared/ids";
import { MessageRepository } from "../messages/message.repository";
import type { MessageAttachment } from "../messages/message.types";
import { parseMessageAttachments } from "../messages/message.types";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type StoredMediaUpload = {
  messageType: "image" | "video";
  attachment: MessageAttachment;
};

export class MediaService {
  constructor(
    private readonly bucket: R2Bucket | undefined,
    private readonly messages: MessageRepository
  ) {}

  async storeUpload(input: {
    conversationId: string;
    messageId: string;
    file: File;
    fileName?: string;
    mimeType?: string;
  }): Promise<StoredMediaUpload> {
    const bucket = this.requireBucket();
    const originalFileName = input.fileName?.trim() || input.file.name || "upload";
    const mimeType = normalizeMimeType(input.mimeType || input.file.type, originalFileName);
    const messageType = getMessageType(mimeType);
    const maxBytes = messageType === "image" ? MAX_IMAGE_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES;

    if (input.file.size > maxBytes) {
      throw new AppError(
        "MEDIA_FILE_TOO_LARGE",
        `${messageType === "image" ? "Image" : "Video"} file is too large`,
        400,
        { maxBytes }
      );
    }

    const attachmentId = createId("att");
    const safeFileName = sanitizeFileName(originalFileName || attachmentId);
    const key = `${MEDIA_FOLDER_PREFIX}${input.conversationId}/${input.messageId}/${attachmentId}/${safeFileName}`;

    await bucket.put(key, input.file.stream(), {
      httpMetadata: {
        contentType: mimeType,
        contentDisposition: contentDisposition(originalFileName || safeFileName),
      },
      customMetadata: {
        conversationId: input.conversationId,
        messageId: input.messageId,
        attachmentId,
        fileName: originalFileName || safeFileName,
      },
    });

    return {
      messageType,
      attachment: {
        type: messageType,
        r2Key: key,
        fileName: originalFileName || safeFileName,
        mimeType,
        size: input.file.size,
      },
    };
  }

  async getMessageAttachmentResponse(input: {
    conversationId: string;
    messageId: string;
    attachmentIndex: number;
    request: Request;
  }): Promise<Response> {
    const message = await this.messages.findById(input.messageId);
    if (!message || message.conversationId !== input.conversationId) {
      throw new AppError("MESSAGE_NOT_FOUND", "Message not found", 404);
    }

    const attachment = parseMessageAttachments(message.attachmentsJson)[input.attachmentIndex];
    if (!attachment) {
      throw new AppError("ATTACHMENT_NOT_FOUND", "Attachment not found", 404);
    }

    if (!attachment.r2Key) {
      if (attachment.url) return Response.redirect(attachment.url, 302);
      throw new AppError("ATTACHMENT_NOT_FOUND", "Attachment is not stored in Supportly", 404);
    }

    const bucket = this.requireBucket();
    const rangeHeader = input.request.headers.get("range");
    const object = await bucket.get(
      attachment.r2Key,
      rangeHeader ? { range: input.request.headers } : undefined
    );
    if (!object) {
      throw new AppError("ATTACHMENT_NOT_FOUND", "Attachment file not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, max-age=300");
    headers.set("content-type", attachment.mimeType || headers.get("content-type") || "application/octet-stream");

    if (attachment.fileName && !headers.has("content-disposition")) {
      headers.set("content-disposition", contentDisposition(attachment.fileName));
    }

    if (object.range) {
      const range = resolveObjectRange(object.range, object.size);
      headers.set("content-range", `bytes ${range.start}-${range.end}/${object.size}`);
      headers.set("content-length", String(range.length));
      return new Response(object.body, { status: 206, headers });
    }

    headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  }

  private requireBucket(): R2Bucket {
    if (!this.bucket) {
      throw new AppError("MEDIA_STORAGE_NOT_CONFIGURED", "Media storage is not configured", 500);
    }
    return this.bucket;
  }
}

function normalizeMimeType(value: string, fileName: string): string {
  const mimeType = value.trim().toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }

  const inferred = inferMimeTypeFromName(fileName);
  if (!inferred) {
    throw new AppError("MEDIA_MIME_TYPE_REQUIRED", "Media file type is required", 400);
  }
  return inferred;
}

function getMessageType(mimeType: string): "image" | "video" {
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.has(mimeType)) return "video";

  throw new AppError("MEDIA_TYPE_NOT_SUPPORTED", "Only image and video files are supported", 400, {
    allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
  });
}

function sanitizeFileName(value: string): string {
  const sanitized = value.trim().replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "upload";
}

function inferMimeTypeFromName(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "video/quicktime";
  return undefined;
}

function contentDisposition(fileName: string): string {
  const fallback = sanitizeFileName(fileName).replace(/["\\]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function resolveObjectRange(range: R2Range, size: number): { start: number; end: number; length: number } {
  const value = range as { offset?: number; length?: number; end?: number; suffix?: number };

  if (typeof value.offset === "number" && typeof value.length === "number") {
    const start = value.offset;
    const end = Math.min(size - 1, value.offset + value.length - 1);
    return { start, end, length: end - start + 1 };
  }

  if (typeof value.offset === "number" && typeof value.end === "number") {
    const start = value.offset;
    const end = Math.min(size - 1, value.end);
    return { start, end, length: end - start + 1 };
  }

  const length = Math.min(size, value.suffix ?? size);
  const start = Math.max(0, size - length);
  return { start, end: size - 1, length };
}
