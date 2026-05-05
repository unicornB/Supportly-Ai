# Supportly Server API（Cloudflare 原生智能客服后端）

基于 Cloudflare Workers 沉淀出来的轻量级智能客服后端服务，支持多渠道消息接入、客服会话、知识库检索、AI 自动回复、后台管理接口、Web Chat Widget、Telegram Bot 等场景。

当前项目优先解决：

```text
能接收消息
能创建会话
能查看和回复会话
能接入知识库
能用 AI 自动回复
能通过 Web Chat Widget / Telegram 接入客服
```

`本项目需要 Node.js 20 或以上环境`

`本项目使用 pnpm 管理依赖`

`本项目运行在 Cloudflare Workers Runtime，不是传统 Node.js Server`

<p align="center">
<img align="left" height="96" src="../web-widget/src/images/supportly.png">
<ul>
<li><strong>运行平台</strong>: Cloudflare Workers</li>
<li><strong>数据库</strong>: Cloudflare D1</li>
<li><strong>知识库</strong>: Cloudflare AI Search</li>
<li><strong>AI 模型</strong>: Cloudflare Workers AI</li>
<li><strong>后台项目</strong>: <a href="../admin">admin</a></li>
<li><strong>Web Chat Widget</strong>: <a href="../web-widget">web-widget</a></li>
<li><strong>架构文档</strong>: <a href="../docs/code-architecture.md">code-architecture.md</a></li>
</ul>
</p>

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-4.x-E36002?style=flat-square)
![D1](https://img.shields.io/badge/Cloudflare-D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)

## 架构图

```text
Customer Channels
  ├─ Web Chat Widget
  ├─ Telegram Bot
  └─ Custom Webhook
        │
        ▼
Cloudflare Worker
  ├─ Hono Router
  ├─ Channel Adapters
  ├─ Conversation Service
  ├─ Message Service
  ├─ Knowledge Service
  ├─ AI Service
  └─ Auth Service
        │
        ├─ D1
        │   ├─ admin_users
        │   ├─ channel_accounts
        │   ├─ contacts / conversations
        │   ├─ messages
        │   └─ kb_documents
        │
        ├─ AI Search
        │   └─ 知识库检索 / 文档同步
        │
        └─ Workers AI
            └─ 基于知识库生成回复
```

## 特点

### Cloudflare 原生

只依赖 Cloudflare 产品：

```text
Workers
D1
AI Search
Workers AI
Workers Assets
```

当前不依赖：

```text
Redis
MySQL
PostgreSQL
Elasticsearch
外部向量数据库
外部大模型网关
```

### 通用渠道模型

渠道统一抽象为：

```text
ChannelAdapter
```

当前已实现：

```text
custom_webhook
telegram
web_chat
```

后续接入 WhatsApp、微信、飞书、企微、LINE 等，只需要新增 Adapter，不需要重写会话和消息模型。

### 会话优先

当前版本不是完整 SaaS，而是单实例 MVP：

```text
一个后台
多个渠道
统一会话列表
统一消息表
统一知识库
统一 AI 回复
```

这样可以先把客服核心链路跑通，再做租户、计费、权限、审计等 SaaS 能力。

### 知识库驱动 AI

AI 回复流程：

```text
用户消息
  -> AI Search 检索知识库
  -> Workers AI 生成回答
  -> 写入 messages
  -> 渠道 Adapter 投递或 Widget 轮询读取
```

如果 AI Search 没有命中文档，当前默认不强行编造回复。

## 功能特性

- [x] 后台账号登录
- [x] 默认管理员初始化
- [x] D1 数据库迁移
- [x] 渠道账号管理
- [x] Custom Webhook 接入
- [x] Telegram Bot 接入
- [x] Telegram Webhook 设置和测试
- [x] Web Chat Widget 接入
- [x] 匿名访客会话
- [x] Visitor Token 校验
- [x] 会话列表
- [x] 会话未读数
- [x] 人工回复
- [x] Bot / 人工接管切换
- [x] 关闭会话
- [x] 消息发送状态
- [x] 知识库文档上传
- [x] AI Search 文档同步
- [x] AI 自动回复
- [x] AI 引用展示
- [x] Workers Assets 发布 Admin
- [ ] WhatsApp 官方商业 API 接入
- [ ] 微信公众号 / 企业微信接入
- [ ] 多租户 SaaS
- [ ] 客服分配
- [ ] 文件消息
- [ ] 满意度评价
- [ ] 工单系统

## 快速部署体验

### 1. 安装依赖

在仓库根目录执行：

```shell
pnpm install
```

或只安装后端：

```shell
cd server-api
pnpm install
```

### 2. 配置 Cloudflare 资源

需要准备：

```text
D1 database
AI Search namespace
AI Search instance
Workers AI binding
```

当前 `wrangler.toml` 示例：

```toml
[[d1_databases]]
binding = "DB"
database_name = "supportly"
database_id = "replace-with-d1-database-id"

[[ai_search_namespaces]]
binding = "AI_SEARCH"
namespace = "aidesk"
remote = true

[ai]
binding = "AI"
remote = true

[vars]
KB_INSTANCE_NAME = "supportly-dev"
DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct"
JWT_SECRET = "supportly-dev-secret-change-before-deploy"
WIDGET_TOKEN_SECRET = "supportly-widget-dev-secret-change-before-deploy"
```

生产环境必须替换：

```text
database_id
JWT_SECRET
WIDGET_TOKEN_SECRET
```

### 3. 执行数据库迁移

本地 D1：

```shell
cd server-api
pnpm db:migrate:local
pnpm db:seed:local
```

远程 D1：

```shell
cd server-api
pnpm db:migrate:remote
pnpm db:seed:remote
```

默认管理员：

```text
邮箱：admin@example.com
密码：admin123
```

生产环境请立即修改默认密码。

### 4. 本地启动

```shell
cd server-api
pnpm dev
```

默认访问：

```text
http://localhost:8787
```

健康检查：

```shell
curl http://localhost:8787/health
```

## 源码开发

### 类型检查

```shell
cd server-api
pnpm typecheck
```

### 测试

```shell
cd server-api
pnpm test
```

### 部署

```shell
cd server-api
pnpm deploy
```

## 后台管理系统

Admin 项目在：

```text
../admin
```

本地启动：

```shell
cd admin
pnpm dev
```

默认访问：

```text
http://localhost:5173
```

当前 Worker Assets 配置：

```toml
[assets]
directory = "../admin/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/webhooks/*", "/health"]
```

也就是说，`server-api` 发布时会带上 Admin 的构建产物。

构建 Admin：

```shell
cd admin
pnpm build
```

## Web Chat Widget

Widget 项目在：

```text
../web-widget
```

构建后输出到自己的目录：

```text
../web-widget/dist
```

本地构建：

```shell
cd web-widget
VITE_WIDGET_API_BASE_URL=http://localhost:8787 pnpm build
pnpm preview
```

接入示例：

```html
<script
  src="http://localhost:5174/widget/supportly.js"
  data-channel-id="ch_xxx"
  data-title="在线客服"
  async>
</script>
```

生产环境建议把 `web-widget/dist` 上传到 Cloudflare Pages 或其他静态 CDN，然后在 Admin 中配置：

```text
VITE_PUBLIC_WIDGET_BASE_URL=https://your-widget-domain.com
```

## Telegram Bot 接入

### 1. 创建 Telegram 渠道

在 Admin 的「渠道」页面创建：

```text
渠道类型：Telegram Bot
Bot Token：从 BotFather 获取
Webhook Secret：随机字符串
Bot Username：可选
```

### 2. 设置 Webhook

Admin 渠道列表中可以直接点击：

```text
设置 Webhook
测试
```

也可以手动调用 Telegram API：

```shell
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://your-api-domain.com/webhooks/ch_xxx",
    "secret_token": "your-webhook-secret",
    "allowed_updates": ["message"]
  }'
```

## Custom Webhook 接入

Webhook 地址：

```text
POST /webhooks/:channelAccountId
```

请求示例：

```json
{
  "event_id": "evt_1",
  "event_type": "message.created",
  "contact": {
    "external_id": "user_1",
    "name": "Alice"
  },
  "message": {
    "external_id": "msg_1",
    "type": "text",
    "text": "退款多久到账？",
    "attachments": []
  },
  "timestamp": "2026-05-02T10:00:00Z"
}
```

如果渠道配置了 `webhookSecretCiphertext`，请求需要带：

```text
x-supportly-signature
```

签名算法：

```text
HMAC-SHA256(secret, rawBody)
```

## API 概览

### 健康检查

```text
GET /health
```

### 登录认证

```text
POST /api/auth/login
GET  /api/auth/me
```

### 后台管理员

```text
GET /api/admin/me
```

### 渠道

```text
GET  /api/channels
POST /api/channels
POST /api/channels/:id/telegram/set-webhook
POST /api/channels/:id/telegram/test
```

### 会话

```text
GET  /api/conversations
GET  /api/conversations/:id
GET  /api/conversations/:id/messages
POST /api/conversations/:id/messages
POST /api/conversations/:id/handoff
POST /api/conversations/:id/resolve
```

### 知识库

```text
GET    /api/knowledge/documents
POST   /api/knowledge/documents
DELETE /api/knowledge/documents/:id
POST   /api/knowledge/sync/ai-search
```

### Widget 公开接口

Widget API 不使用后台管理员鉴权，使用 visitor token：

```text
POST /api/widget/conversations
POST /api/widget/conversations/:conversationId/messages
GET  /api/widget/conversations/:conversationId/messages
```

### 渠道 Webhook

```text
POST /webhooks/:channelAccountId
```

## 数据库设计

当前核心表：

```text
admin_users
channel_accounts
conversations
messages
kb_documents
```

迁移文件：

```text
migrations/0001_init.sql
migrations/0002_seed_default_admin.sql
migrations/0003_set_default_admin_password.sql
migrations/0004_unique_kb_ai_search_item.sql
```

数据库详细说明参考：

```text
../docs/database-design.md
../docs/conversation-only-mvp.md
```

## 代码结构

```text
src/
  adapters/
    channel-adapter.ts
    custom-webhook.adapter.ts
    telegram.adapter.ts
    web-chat.adapter.ts

  config/
    env.ts
    constants.ts

  gateways/
    ai-search.gateway.ts
    workers-ai.gateway.ts
    crypto.gateway.ts

  http/
    middleware/
    routes/
    responses.ts

  modules/
    ai/
    channels/
    conversations/
    knowledge/
    messages/
    users/
    widget/

  shared/
    errors.ts
    ids.ts
    json.ts
    logger.ts
    time.ts

  app.ts
  index.ts
  services.ts
```

## 核心设计

### Adapter 层

每个外部平台只需要实现：

```typescript
export interface ChannelAdapter {
  readonly type: ChannelType;
  verify(request: Request, account: ChannelAccount): Promise<void>;
  parseInbound(request: Request, account: ChannelAccount): Promise<InboundMessage[]>;
  sendMessage(account: ChannelAccount, message: OutboundMessage): Promise<SendMessageResult>;
}
```

这样 Telegram、Webhook、Web Chat 的入站消息都会进入同一条业务链路。

### Conversation Service

负责：

```text
根据 externalThreadId 查找或创建会话
写入 inbound message
更新 unread_count
触发 AI 回复
写入 outbound AI message
```

### Message Service

负责：

```text
客服人工回复
调用渠道 Adapter 投递消息
标记 sent / failed
读取会话消息
清理未读数
```

### Widget Service

负责：

```text
匿名访客会话
visitor token 签发
visitor token 校验
Widget 消息发送
Widget 消息轮询
```

## AI Search

当前配置：

```toml
[[ai_search_namespaces]]
binding = "AI_SEARCH"
namespace = "aidesk"
remote = true

[vars]
KB_INSTANCE_NAME = "supportly-dev"
```

注意：

```text
AI Search 和 Workers AI 绑定访问的是远程 Cloudflare 资源。
即使在 wrangler dev 本地开发时，也可能产生 Cloudflare 侧调用。
```

如果 AI Search 实例没有启用 keyword indexing，请使用 vector 检索。当前代码已经使用：

```text
retrieval_type = vector
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `KB_INSTANCE_NAME` | AI Search instance name |
| `DEFAULT_AI_MODEL` | Workers AI 默认生成模型 |
| `JWT_SECRET` | 后台登录 token 签名密钥 |
| `WIDGET_TOKEN_SECRET` | Web Chat visitor token 签名密钥 |
| `ENCRYPTION_KEY` | 预留，加密敏感配置 |

## 常见问题

### 为什么本地也会访问远程 AI Search？

Cloudflare AI bindings 默认访问远程资源。`wrangler.toml` 中：

```toml
remote = true
```

表示本地开发也会调用真实 Cloudflare 资源。

### 为什么 AI 没有回复？

常见原因：

```text
AI Search 没有命中文档
知识库文档没有上传或没有同步
AI Search instance name 配错
Workers AI binding 不可用
会话已经切换到人工接管
```

### 为什么 Widget 不能访问 /supportly.js？

当前 Widget 静态路径是：

```text
/widget/supportly.js
/widget/frame.html
/widget/assets/*
```

所以本地测试地址是：

```text
http://localhost:5174/widget/supportly.js
```

## 推荐测试问题

```text
退款多久到账？
订单多久发货？
怎么查看物流？
忘记密码怎么办？
Telegram Bot 怎么接入？
Webhook 地址在哪里看？
```

如果知识库没有对应内容，AI 不应该随意编造答案。

## 相关文档

| 文档 | 说明 |
| --- | --- |
| `../docs/code-architecture.md` | 代码架构方案 |
| `../docs/conversation-only-mvp.md` | 会话 MVP 方案 |
| `../docs/database-design.md` | 数据库设计 |
| `../docs/web-admin-plan.md` | Admin 后台方案 |
| `../docs/web-chat-widget-integration-plan.md` | Web Chat Widget 方案 |
| `../docs/telegram-bot-integration-case.md` | Telegram Bot 接入案例 |

## License

当前项目仍处于内部 MVP 阶段，License 待补充。
