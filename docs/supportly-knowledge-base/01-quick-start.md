# Supportly 快速上手

版本：2026-05

适用问题：

- Supportly 怎么启动？
- 本地怎么测试？
- 默认账号是什么？
- 需要哪些 Cloudflare 产品？
- 怎么先跑通一条客服消息？

## 环境要求

Supportly 使用 Node.js 和 pnpm 开发。

推荐环境：

- Node.js 20 或以上
- pnpm 9 或以上
- Wrangler 4 或以上
- Cloudflare 账号

后端运行在 Cloudflare Workers Runtime，不是传统 Node.js HTTP Server。

## 使用的 Cloudflare 产品

当前版本使用：

- Workers：运行后端 API
- D1：保存管理员、渠道、会话、消息、知识库文档记录
- AI Search：保存和检索知识库内容
- Workers AI：生成 AI 回复
- Workers Assets：发布 Admin 前端静态资源

Web Chat Widget 可以单独发布到 Cloudflare Pages 或其他 CDN。

## 本地启动后端

进入后端目录：

```bash
cd server-api
pnpm install
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev
```

默认后端地址：

```text
http://localhost:8787
```

健康检查：

```text
GET /health
```

## 默认管理员

本地种子数据会创建默认管理员：

```text
邮箱：admin@example.com
密码：admin123
```

生产环境上线后必须修改默认密码。

## 本地启动后台

进入后台目录：

```bash
cd admin
pnpm install
pnpm dev
```

默认后台地址：

```text
http://localhost:5173
```

登录后可以进入：

- 会话
- 知识库
- 渠道
- 设置

## 本地启动 Web Chat Widget

进入 Widget 目录：

```bash
cd web-widget
pnpm install
VITE_WIDGET_API_BASE_URL=http://localhost:8787 pnpm build
pnpm preview
```

默认 Widget 静态地址：

```text
http://localhost:5174/widget/supportly.js
```

## 最小测试流程

建议按以下顺序测试：

1. 启动 `server-api`
2. 启动 `admin`
3. 登录后台
4. 在「渠道」页面创建 Web Chat Widget 渠道
5. 复制渠道 ID
6. 在测试网页中引入 Widget JS
7. 发送一条消息
8. 在后台「会话」页面查看新会话
9. 上传知识库文档
10. 再发送知识库相关问题，测试 AI 回复

## 常见问题

### 为什么本地会产生 AI 调用？

AI Search 和 Workers AI 是 Cloudflare 远程资源。即使使用 `wrangler dev` 本地开发，只要绑定配置了 `remote = true`，也会访问 Cloudflare 远程资源。

### 为什么 AI 没有回复？

常见原因：

- 知识库没有上传文档
- AI Search 没有完成索引
- 用户问题没有命中知识库
- 会话已经切换到人工接管
- Workers AI 或 AI Search 绑定配置错误

