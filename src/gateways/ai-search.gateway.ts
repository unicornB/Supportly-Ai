import type { AiSearchBinding, AiSearchChunk, AiSearchItem } from "../config/env";

export type KnowledgeReference = {
  id: string;
  title: string;
  path: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
};

export class AiSearchGateway {
  constructor(
    private readonly search: AiSearchBinding,
    readonly instanceName: string
  ) {}

  async uploadDocument(input: {
    path: string;
    content: string | ArrayBuffer | ReadableStream;
    metadata?: Record<string, string>;
  }) {
    return this.search.items.upload(input.path, input.content, {
      metadata: input.metadata,
    });
  }

  async uploadDocumentAndPoll(input: {
    path: string;
    content: string | ArrayBuffer | ReadableStream;
    metadata?: Record<string, string>;
  }) {
    return this.search.items.uploadAndPoll(input.path, input.content, {
      metadata: input.metadata,
      timeoutMs: 30_000,
    });
  }

  async deleteDocument(itemId: string) {
    await this.search.items.delete(itemId);
  }

  async listDocuments(): Promise<AiSearchItem[]> {
    const items: AiSearchItem[] = [];
    const perPage = 50;
    let page = 1;

    while (true) {
      const response = await this.search.items.list({
        page,
        per_page: perPage,
        sort_by: "modified_at",
      });
      const currentItems = response.result ?? [];
      items.push(...currentItems);

      const pageInfo = response.result_info;
      const totalCount = pageInfo?.total_count ?? items.length;
      const currentPage = pageInfo?.page ?? page;
      const currentPerPage = pageInfo?.per_page ?? perPage;

      if (items.length >= totalCount || currentItems.length === 0) break;
      page = currentPage + 1;

      if (page > Math.ceil(totalCount / currentPerPage) + 1) break;
    }

    return items;
  }

  async searchKnowledge(question: string): Promise<KnowledgeReference[]> {
    const result = await this.search.search({
      messages: [{ role: "user", content: question }],
      ai_search_options: {
        retrieval: {
          retrieval_type: "vector",
          max_num_results: 5,
          match_threshold: 0.35,
        },
      },
    });

    return (result.chunks ?? []).map((chunk: AiSearchChunk) => ({
      id: chunk.id,
      title: String(chunk.item?.metadata?.filename ?? chunk.item?.key ?? "Knowledge"),
      path: chunk.item?.key ?? "",
      score: chunk.score ?? 0,
      text: chunk.text ?? "",
      metadata: chunk.item?.metadata ?? {},
    }));
  }
}
