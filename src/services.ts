import { AdapterRegistry } from "./adapters/channel-adapter";
import { CustomWebhookAdapter } from "./adapters/custom-webhook.adapter";
import { TelegramAdapter } from "./adapters/telegram.adapter";
import { WebChatAdapter } from "./adapters/web-chat.adapter";
import type { Env } from "./config/env";
import { AiSearchGateway } from "./gateways/ai-search.gateway";
import { WorkersAiGateway } from "./gateways/workers-ai.gateway";
import { AiService } from "./modules/ai/ai.service";
import { ChannelRepository } from "./modules/channels/channel.repository";
import { ChannelService } from "./modules/channels/channel.service";
import { ConversationRepository } from "./modules/conversations/conversation.repository";
import { ConversationService } from "./modules/conversations/conversation.service";
import { KnowledgeRepository } from "./modules/knowledge/knowledge.repository";
import { KnowledgeService } from "./modules/knowledge/knowledge.service";
import { MessageRepository } from "./modules/messages/message.repository";
import { MessageService } from "./modules/messages/message.service";
import { AdminUserRepository } from "./modules/users/admin-user.repository";
import { AuthService } from "./modules/users/auth.service";
import { WidgetService } from "./modules/widget/widget.service";

export function createServices(env: Env) {
  const adapters = new AdapterRegistry([new CustomWebhookAdapter(), new TelegramAdapter(), new WebChatAdapter()]);

  const channelRepository = new ChannelRepository(env.DB);
  const conversationRepository = new ConversationRepository(env.DB);
  const messageRepository = new MessageRepository(env.DB);
  const knowledgeRepository = new KnowledgeRepository(env.DB);
  const adminUserRepository = new AdminUserRepository(env.DB);

  const kbInstanceName = env.KB_INSTANCE_NAME ?? "supportly-dev";
  const aiSearchGateway = new AiSearchGateway(env.AI_SEARCH.get(kbInstanceName), kbInstanceName);
  const workersAiGateway = new WorkersAiGateway(env.AI, env);

  const aiService = new AiService(aiSearchGateway, workersAiGateway, messageRepository);
  const channelService = new ChannelService(channelRepository, adapters);
  const conversationService = new ConversationService(conversationRepository, messageRepository, aiService);
  const messageService = new MessageService(channelService, conversationRepository, messageRepository);
  const knowledgeService = new KnowledgeService(knowledgeRepository, aiSearchGateway);
  const authService = new AuthService(adminUserRepository, env.JWT_SECRET ?? "supportly-dev-secret-change-before-deploy");
  const widgetService = new WidgetService(
    channelService,
    conversationRepository,
    messageRepository,
    conversationService,
    env.WIDGET_TOKEN_SECRET ?? env.JWT_SECRET ?? "supportly-dev-secret-change-before-deploy"
  );

  return {
    adapters,
    channels: channelService,
    conversations: conversationService,
    messages: messageService,
    knowledge: knowledgeService,
    auth: authService,
    widget: widgetService,
  };
}
