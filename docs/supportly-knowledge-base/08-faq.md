# Supportly 常见问题 FAQ

版本：2026-05

## Supportly 是什么？

Supportly 是基于 Cloudflare 的 AI 智能客服平台，支持多渠道会话、知识库检索、AI 自动回复和人工客服处理。

## Supportly 支持哪些渠道？

当前版本主要支持：

- Web Chat Widget
- Telegram Bot
- Custom Webhook

WhatsApp、微信、企业微信、飞书、LINE 等可以通过新增 ChannelAdapter 扩展。

## Supportly 是 SaaS 吗？

当前版本先放弃完整 SaaS，优先实现单实例客服 MVP。

当前版本支持一个后台管理多个渠道，后续可以扩展多租户、计费、权限和隔离能力。

## Web Chat Widget 怎么接入？

在 Admin 创建 Web Chat Widget 渠道后，把生成的 script 放到网站页面中：

```html
<script
  src="https://your-widget-domain.com/widget/supportly.js"
  data-channel-id="ch_xxx"
  data-title="在线客服"
  async>
</script>
```

## Web Chat Widget 是否支持匿名访客？

支持。Widget 会在浏览器中生成 visitor ID，并由后端签发 visitor token。访客不需要登录也能发起会话。

## 为什么不用 WebSocket？

MVP 阶段使用 HTTP 轮询更简单，不需要 Durable Objects 或额外连接管理。

后续如果需要更实时的体验，可以增加 SSE、WebSocket 或 Durable Objects。

## Telegram Bot Token 怎么申请？

通过 Telegram 的 BotFather 申请：

1. 搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示创建 Bot
4. 保存 Bot Token

Bot Token 是敏感信息，不应公开。

## 知识库能上传什么格式？

建议上传：

- PDF
- Markdown
- HTML
- TXT

当前单文件限制是 4MB。

## 为什么 AI 没有回复？

常见原因：

- 没有上传知识库
- AI Search 没有完成索引
- 用户问题没有命中文档
- 会话切换到了人工接管
- AI Search 或 Workers AI 配置错误

## 怎么让 AI 回复更准确？

建议：

- 把知识库拆成多个主题文档
- 每篇文档标题清晰
- 加入用户可能问法
- 写清楚标准答案和处理步骤
- 避免一篇文档混合太多主题

## 支持 WhatsApp 吗？

当前代码还没有正式实现 WhatsApp 官方商业 API。

如果无法申请 WhatsApp Business API，可以先使用：

- Web Chat Widget
- Telegram Bot
- Custom Webhook
- 其他容易接入的平台

## Supportly 使用哪些 Cloudflare 产品？

当前使用：

- Workers
- D1
- AI Search
- Workers AI
- Workers Assets

Web Chat Widget 可以发布到 Cloudflare Pages。

## 生产环境需要注意什么？

上线前必须：

- 替换 D1 database_id
- 替换 JWT_SECRET
- 替换 WIDGET_TOKEN_SECRET
- 修改默认管理员密码
- 检查 Telegram Bot Token 是否安全
- 配置正式 API 域名
- 配置 Widget 静态域名
- 确认 AI Search instance name 正确

