import { createId } from "../../shared/ids";
import { nowIso } from "../../shared/time";
import type {
  CreateKnowledgeDocumentInput,
  KnowledgeDocument,
  KnowledgeDocumentRow,
  UpsertAiSearchDocumentInput,
} from "./knowledge.types";
import { mapKnowledgeDocument } from "./knowledge.types";

export type KnowledgeUpsertResult = {
  document: KnowledgeDocument;
  action: "created" | "updated";
};

export class KnowledgeRepository {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<KnowledgeDocument[]> {
    const result = await this.db
      .prepare(
        `
        SELECT *
        FROM kb_documents
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC
        `
      )
      .all<KnowledgeDocumentRow>();

    return result.results.map(mapKnowledgeDocument);
  }

  async findById(id: string): Promise<KnowledgeDocument | null> {
    const row = await this.db
      .prepare("SELECT * FROM kb_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(id)
      .first<KnowledgeDocumentRow>();

    return row ? mapKnowledgeDocument(row) : null;
  }

  async findByAiSearchItem(instanceId: string, itemId: string): Promise<KnowledgeDocument | null> {
    const row = await this.db
      .prepare(
        `
        SELECT *
        FROM kb_documents
        WHERE ai_search_instance_id = ?
          AND ai_search_item_id = ?
        LIMIT 1
        `
      )
      .bind(instanceId, itemId)
      .first<KnowledgeDocumentRow>();

    return row ? mapKnowledgeDocument(row) : null;
  }

  async create(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const id = createId("kb");
    const now = nowIso();

    await this.db
      .prepare(
        `
        INSERT INTO kb_documents (
          id,
          title,
          source_type,
          ai_search_instance_id,
          ai_search_item_id,
          ai_search_path,
          status,
          file_name,
          file_size,
          mime_type,
          checksum,
          metadata_json,
          created_by_admin_user_id,
          created_at,
          updated_at,
          indexed_at
        )
        VALUES (?, ?, 'upload', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        id,
        input.title,
        input.aiSearchInstanceId,
        input.aiSearchItemId ?? null,
        input.aiSearchPath,
        input.status ?? "processing",
        input.fileName ?? null,
        input.fileSize ?? 0,
        input.mimeType ?? null,
        input.checksum ?? null,
        input.metadataJson ?? "{}",
        input.createdByAdminUserId ?? null,
        now,
        now,
        input.indexedAt ?? (input.status === "indexed" ? now : null)
      )
      .run();

    const document = await this.findById(id);
    if (!document) throw new Error("Created knowledge document not found");
    return document;
  }

  async markDeleted(id: string): Promise<void> {
    const now = nowIso();
    await this.db
      .prepare("UPDATE kb_documents SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, id)
      .run();
  }

  async upsertFromAiSearchItem(input: UpsertAiSearchDocumentInput): Promise<KnowledgeUpsertResult> {
    const existing = await this.findByAiSearchItem(input.aiSearchInstanceId, input.aiSearchItemId);
    const now = nowIso();

    if (existing) {
      await this.db
        .prepare(
          `
          UPDATE kb_documents
          SET title = ?,
              source_type = 'upload',
              ai_search_path = ?,
              status = ?,
              file_name = ?,
              file_size = ?,
              mime_type = ?,
              metadata_json = ?,
              error_message = ?,
              updated_at = ?,
              indexed_at = ?,
              deleted_at = NULL
          WHERE id = ?
          `
        )
        .bind(
          input.title,
          input.aiSearchPath,
          input.status,
          input.fileName ?? null,
          input.fileSize ?? 0,
          input.mimeType ?? null,
          input.metadataJson ?? "{}",
          input.errorMessage ?? null,
          now,
          input.indexedAt ?? (input.status === "indexed" ? existing.indexedAt ?? now : existing.indexedAt),
          existing.id
        )
        .run();

      const document = await this.findById(existing.id);
      if (!document) throw new Error("Updated knowledge document not found");
      return { document, action: "updated" };
    }

    const id = createId("kb");
    await this.db
      .prepare(
        `
        INSERT INTO kb_documents (
          id,
          title,
          source_type,
          ai_search_instance_id,
          ai_search_item_id,
          ai_search_path,
          status,
          file_name,
          file_size,
          mime_type,
          metadata_json,
          error_message,
          created_at,
          updated_at,
          indexed_at
        )
        VALUES (?, ?, 'upload', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        id,
        input.title,
        input.aiSearchInstanceId,
        input.aiSearchItemId,
        input.aiSearchPath,
        input.status,
        input.fileName ?? null,
        input.fileSize ?? 0,
        input.mimeType ?? null,
        input.metadataJson ?? "{}",
        input.errorMessage ?? null,
        now,
        now,
        input.indexedAt ?? (input.status === "indexed" ? now : null)
      )
      .run();

    const document = await this.findById(id);
    if (!document) throw new Error("Created knowledge document not found");
    return { document, action: "created" };
  }
}
