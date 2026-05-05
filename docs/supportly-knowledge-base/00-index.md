# Supportly 知识库总览

版本：2026-05

适用范围：Supportly AI 智能客服平台的产品咨询、接入指导、后台使用、知识库管理、AI 回复、故障排查。

## 产品定位

Supportly 是基于 Cloudflare 的 AI 智能客服平台，面向需要快速接入在线客服和 AI 自动回复的团队。系统包含：

- Cloudflare Worker API
- Admin 管理后台
- Web Chat Widget
- Telegram Bot 接入
- Custom Webhook 接入
- D1 会话和消息存储
- AI Search 知识库检索
- Workers AI 自动回复

## 当前版本能力

当前版本是单实例 MVP，不是完整多租户 SaaS。它优先支持：

- 创建客服渠道
- 接收客户消息
- 生成会话
- 查看会话列表
- 客服人工回复
- Bot / 人工接管切换
- 上传知识库文档
- 同步 AI Search 文档
- 基于知识库自动回复
- Web Chat Widget 一段 JS 接入
- Telegram Bot Webhook 接入

## 当前版本不包含

当前版本暂不包含：

- 多租户计费
- 客服排班
- 客服在线状态
- 文件消息
- 满意度评价
- 工单系统
- WhatsApp 官方商业 API
- 微信公众号和企业微信正式接入
- WebSocket 实时推送

## 推荐客户问题

客户可能会问：

- Supportly 是做什么的？
- Supportly 支持哪些渠道？
- 怎么接入网站客服？
- 怎么接入 Telegram Bot？
- 知识库怎么上传？
- 为什么 AI 没有回复？
- 后台怎么回复客户？
- 能不能接 WhatsApp 或微信？

## 标准回答原则

回答用户问题时应遵循：

- 优先基于本文档和其他 Supportly 知识库文档回答。
- 如果知识库没有覆盖，不要编造具体价格、套餐、公司信息或承诺。
- 遇到 API Token、Webhook Secret、JWT Secret 等敏感信息，不要要求用户公开发送。
- 如果问题涉及生产部署，提醒用户替换默认密钥和默认管理员密码。
- 如果问题涉及第三方平台限制，例如 WhatsApp 商业 API，说明需要平台审核或替代方案。

