export type KnowledgeDocumentStatus = "uploaded" | "processing" | "indexed" | "failed" | "deleted";

export type KnowledgeDocument = {
  id: string;
  title: string;
  sourceType: "upload" | "website" | "api";
  aiSearchInstanceId: string;
  aiSearchItemId: string | null;
  aiSearchPath: string;
  status: KnowledgeDocumentStatus;
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  checksum: string | null;
  metadataJson: string;
  errorMessage: string | null;
  createdByAdminUserId: string | null;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
  deletedAt: string | null;
};

export type KnowledgeDocumentRow = {
  id: string;
  title: string;
  source_type: "upload" | "website" | "api";
  ai_search_instance_id: string;
  ai_search_item_id: string | null;
  ai_search_path: string;
  status: KnowledgeDocumentStatus;
  file_name: string | null;
  file_size: number;
  mime_type: string | null;
  checksum: string | null;
  metadata_json: string;
  error_message: string | null;
  created_by_admin_user_id: string | null;
  created_at: string;
  updated_at: string;
  indexed_at: string | null;
  deleted_at: string | null;
};

export function mapKnowledgeDocument(row: KnowledgeDocumentRow): KnowledgeDocument {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    aiSearchInstanceId: row.ai_search_instance_id,
    aiSearchItemId: row.ai_search_item_id,
    aiSearchPath: row.ai_search_path,
    status: row.status,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    checksum: row.checksum,
    metadataJson: row.metadata_json,
    errorMessage: row.error_message,
    createdByAdminUserId: row.created_by_admin_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    indexedAt: row.indexed_at,
    deletedAt: row.deleted_at,
  };
}

export type CreateKnowledgeDocumentInput = {
  title: string;
  aiSearchInstanceId: string;
  aiSearchItemId?: string;
  aiSearchPath: string;
  status?: KnowledgeDocumentStatus;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
  metadataJson?: string;
  indexedAt?: string;
  createdByAdminUserId?: string;
};

export type UpsertAiSearchDocumentInput = {
  title: string;
  aiSearchInstanceId: string;
  aiSearchItemId: string;
  aiSearchPath: string;
  status: KnowledgeDocumentStatus;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  metadataJson?: string;
  errorMessage?: string;
  indexedAt?: string;
};
