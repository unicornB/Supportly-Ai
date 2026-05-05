import { DEFAULT_AI_MODEL } from "../config/constants";
import type { Env, WorkersAiBinding } from "../config/env";
import type { KnowledgeReference } from "./ai-search.gateway";

export type GenerateKnowledgeReplyResult = {
  text: string;
  metadata: {
    model: string;
    latencyMs: number;
    referencesCount: number;
  };
};

export class WorkersAiGateway {
  constructor(
    private readonly ai: WorkersAiBinding,
    private readonly env: Pick<Env, "DEFAULT_AI_MODEL">
  ) {}

  async generateKnowledgeReply(input: {
    question: string;
    references: KnowledgeReference[];
  }): Promise<GenerateKnowledgeReplyResult> {
    const model = this.env.DEFAULT_AI_MODEL || DEFAULT_AI_MODEL;
    const startedAt = Date.now();
    const prompt = buildKnowledgePrompt(input.question, input.references);
    const result = await this.ai.run(model, { prompt });

    return {
      text: extractText(result),
      metadata: {
        model,
        latencyMs: Date.now() - startedAt,
        referencesCount: input.references.length,
      },
    };
  }
}

function buildKnowledgePrompt(question: string, references: KnowledgeReference[]) {
  const context = references
    .map((reference, index) => {
      return `Source ${index + 1}: ${reference.title}\n${reference.text}`;
    })
    .join("\n\n");

  return [
    "You are a customer support assistant.",
    "Answer the customer only using the knowledge context.",
    "If the answer is not in the context, say you are not sure and ask a human agent to help.",
    "",
    `Question: ${question}`,
    "",
    `Knowledge context:\n${context}`,
  ].join("\n");
}

function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const object = result as Record<string, unknown>;
    if (typeof object.response === "string") return object.response;
    if (typeof object.result === "string") return object.result;
    if (typeof object.text === "string") return object.text;
  }
  return "抱歉，我暂时无法根据知识库生成回答。";
}
