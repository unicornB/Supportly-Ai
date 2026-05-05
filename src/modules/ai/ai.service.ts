import type { AiSearchGateway } from "../../gateways/ai-search.gateway";
import type { WorkersAiGateway } from "../../gateways/workers-ai.gateway";
import { MessageRepository } from "../messages/message.repository";
import type { MaybeReplyInput } from "./ai.types";

export class AiService {
  constructor(
    private readonly aiSearch: AiSearchGateway,
    private readonly workersAi: WorkersAiGateway,
    private readonly messages: MessageRepository
  ) {}

  async maybeCreateReply(input: MaybeReplyInput) {
    if (input.handoffStatus === "agent") return null;
    if (!input.messageContent?.trim()) return null;

    const references = await this.aiSearch.searchKnowledge(input.messageContent);
    if (references.length === 0) return null;

    const reply = await this.workersAi.generateKnowledgeReply({
      question: input.messageContent,
      references,
    });

    return this.messages.createOutbound({
      conversationId: input.conversationId,
      channelAccountId: input.channelAccountId,
      senderType: "ai",
      content: reply.text,
      status: "sending",
      aiMetadata: reply.metadata,
      aiReferences: references.map((reference) => ({
        id: reference.id,
        title: reference.title,
        path: reference.path,
        score: reference.score,
      })),
    });
  }
}
