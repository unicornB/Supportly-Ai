export type AiSearchRole = "system" | "developer" | "user" | "assistant" | "tool";

export type AiSearchChunk = {
  id: string;
  text?: string;
  score?: number;
  item?: {
    key?: string;
    metadata?: Record<string, unknown>;
  };
};

export type AiSearchResult = {
  search_query?: string;
  chunks?: AiSearchChunk[];
};

export type AiSearchItem = {
  id: string;
  key: string;
  status?: string;
  chunks_count?: number;
  file_size?: number;
  metadata?: Record<string, unknown>;
  source_id?: string;
  created_at?: string;
  last_seen_at?: string;
};

export type AiSearchItemsListResponse = {
  result?: AiSearchItem[];
  result_info?: {
    count?: number;
    total_count?: number;
    page?: number;
    per_page?: number;
  };
};

export type AiSearchBinding = {
  search(input: {
    messages?: Array<{ role: AiSearchRole; content: string }>;
    query?: string;
    ai_search_options?: Record<string, unknown>;
  }): Promise<AiSearchResult>;
  items: {
    upload(
      name: string,
      content: string | ArrayBuffer | ReadableStream,
      options?: { metadata?: Record<string, string> }
    ): Promise<AiSearchItem>;
    uploadAndPoll(
      name: string,
      content: string | ArrayBuffer | ReadableStream,
      options?: { metadata?: Record<string, string>; pollIntervalMs?: number; timeoutMs?: number }
    ): Promise<AiSearchItem>;
    list(options?: {
      page?: number;
      per_page?: number;
      status?: string;
      sort_by?: "status" | "modified_at";
      search?: string;
      source?: string;
    }): Promise<AiSearchItemsListResponse>;
    delete(itemId: string): Promise<void>;
  };
};

export type AiSearchNamespaceBinding = {
  get(instanceName: string): AiSearchBinding;
};

export type WorkersAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export type Env = {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  VISITOR_STREAM: DurableObjectNamespace;
  ADMIN_STREAM: DurableObjectNamespace;
  AI_SEARCH: AiSearchNamespaceBinding;
  AI: WorkersAiBinding;
  KB_INSTANCE_NAME?: string;
  ENCRYPTION_KEY?: string;
  JWT_SECRET?: string;
  WIDGET_TOKEN_SECRET?: string;
  DEFAULT_AI_MODEL?: string;
};

export type AppContext = {
  Bindings: Env;
  Variables: {
    requestId: string;
    adminUserId?: string;
    adminUser?: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  };
};
