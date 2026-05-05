import { KNOWLEDGE_FOLDER_PREFIX, MAX_KNOWLEDGE_UPLOAD_BYTES } from "../../config/constants";
import { AppError } from "../../shared/errors";
import { createId } from "../../shared/ids";
import { stringifyJson } from "../../shared/json";
import type { AiSearchGateway } from "../../gateways/ai-search.gateway";
import { KnowledgeRepository } from "./knowledge.repository";
import type { KnowledgeDocumentStatus } from "./knowledge.types";

type SyncKnowledgeResult = {
  instanceName: string;
  scanned: number;
  created: number;
  updated: number;
  failed: number;
};

export class KnowledgeService {
  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly aiSearch: AiSearchGateway
  ) {}

  listDocuments() {
    return this.knowledge.list();
  }

  async uploadDocument(input: { file: File; title?: string; createdByAdminUserId?: string }) {
    if (input.file.size > MAX_KNOWLEDGE_UPLOAD_BYTES) {
      throw new AppError("KNOWLEDGE_FILE_TOO_LARGE", "Knowledge file is larger than 4MB", 400);
    }

    const documentId = createId("kb");
    const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${KNOWLEDGE_FOLDER_PREFIX}${documentId}/${safeName}`;
    const content = await readKnowledgeFileContent(input.file);
    const item = await this.uploadToAiSearch(path, content);

    const document = await this.knowledge.create({
      title: input.title || input.file.name,
      aiSearchInstanceId: this.aiSearch.instanceName,
      aiSearchItemId: item.id,
      aiSearchPath: item.key || path,
      status: mapAiSearchStatus(item.status),
      fileName: input.file.name,
      fileSize: input.file.size,
      mimeType: input.file.type || undefined,
      metadataJson: stringifyJson({ filename: input.file.name, source: "upload" }),
      indexedAt: mapAiSearchStatus(item.status) === "indexed" ? item.last_seen_at ?? item.created_at : undefined,
      createdByAdminUserId: input.createdByAdminUserId,
    });

    try {
      await this.syncFromAiSearch();
      return (await this.knowledge.findById(document.id)) ?? document;
    } catch {
      return document;
    }
  }

  private async uploadToAiSearch(path: string, content: string | ArrayBuffer) {
    try {
      return await this.aiSearch.uploadDocument({ path, content });
    } catch (error) {
      throw new AppError(
        "KNOWLEDGE_UPLOAD_FAILED",
        `AI Search upload failed: ${error instanceof Error ? error.message : String(error)}`,
        502
      );
    }
  }

  async deleteDocument(id: string) {
    const document = await this.knowledge.findById(id);
    if (!document) {
      throw new AppError("KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document not found", 404);
    }

    if (document.aiSearchItemId) {
      await this.aiSearch.deleteDocument(document.aiSearchItemId);
    }
    await this.knowledge.markDeleted(id);
  }

  async syncFromAiSearch(): Promise<SyncKnowledgeResult> {
    const items = await this.aiSearch.listDocuments();
    const result: SyncKnowledgeResult = {
      instanceName: this.aiSearch.instanceName,
      scanned: items.length,
      created: 0,
      updated: 0,
      failed: 0,
    };

    for (const item of items) {
      try {
        const status = mapAiSearchStatus(item.status);
        const metadata = item.metadata ?? {};
        const fileName = pickString(metadata.filename) ?? fileNameFromKey(item.key);

        const upsert = await this.knowledge.upsertFromAiSearchItem({
          title: pickString(metadata.title) ?? fileName ?? item.key,
          aiSearchInstanceId: this.aiSearch.instanceName,
          aiSearchItemId: item.id,
          aiSearchPath: item.key,
          status,
          fileName,
          fileSize: item.file_size ?? 0,
          mimeType: pickString(metadata.mime_type) ?? pickString(metadata.content_type),
          metadataJson: stringifyJson({
            ...metadata,
            ai_search_source_id: item.source_id,
            ai_search_status: item.status,
            chunks_count: item.chunks_count,
            created_at: item.created_at,
            last_seen_at: item.last_seen_at,
          }),
          errorMessage: status === "failed" ? `AI Search item status: ${item.status ?? "unknown"}` : undefined,
          indexedAt: status === "indexed" ? item.last_seen_at ?? item.created_at : undefined,
        });

        if (upsert.action === "created") result.created += 1;
        if (upsert.action === "updated") result.updated += 1;
      } catch {
        result.failed += 1;
      }
    }

    return result;
  }
}

function mapAiSearchStatus(status: string | undefined): KnowledgeDocumentStatus {
  switch (status) {
    case "completed":
      return "indexed";
    case "error":
    case "skipped":
      return "failed";
    case "queued":
    case "running":
    case "outdated":
    default:
      return "processing";
  }
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function fileNameFromKey(key: string): string {
  return key.split("/").filter(Boolean).at(-1) ?? key;
}

async function readKnowledgeFileContent(file: File): Promise<string | ArrayBuffer> {
  if (isTextKnowledgeFile(file)) {
    return file.text();
  }
  return file.arrayBuffer();
}

function isTextKnowledgeFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/x-yaml" ||
    name.endsWith(".md") ||
    name.endsWith(".mdx") ||
    name.endsWith(".txt") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    name.endsWith(".json") ||
    name.endsWith(".csv") ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml")
  );
}
