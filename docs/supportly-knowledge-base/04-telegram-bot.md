# Telegram Bot 接入说明

版本：2026-05

适用问题：

- Telegram Bot 怎么接入？
- TELEGRAM_BOT_TOKEN 怎么申请？
- 怎么设置 Telegram Webhook？
- Telegram Webhook 测试失败怎么办？
- 为什么 Telegram 收不到回复？

## 测试 Demo 机器人

可以先通过 Telegram 打开 Supportly 测试 Demo 机器人：

```text
https://t.me/my_supportly_ai_bot
```

也可以在 Telegram 中搜索：

```text
@my_supportly_ai_bot
```

## 申请 Bot Token

Telegram Bot Token 通过 BotFather 获取。

步骤：

1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示输入 Bot 名称
4. 输入 Bot username，通常以 `bot` 结尾
5. BotFather 返回 Bot Token

Bot Token 是敏感信息，不要公开发送到聊天窗口、Issue、日志或截图中。

## 创建 Telegram 渠道

在 Admin 的「渠道」页面创建：

```text
渠道类型：Telegram Bot
名称：自定义
Bot Token：BotFather 返回的 token
Bot Username：可选
Webhook Secret：建议 32 位以上随机字符串
```

创建后，系统会生成渠道 ID：

```text
ch_xxx
```

## 设置 Webhook

Admin 渠道列表提供：

- 设置 Webhook
- 测试

点击「设置 Webhook」后，系统会调用 Telegram `setWebhook`。

Webhook 地址格式：

```text
https://your-api-domain.com/webhooks/ch_xxx
```

手动设置示例：

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://your-api-domain.com/webhooks/ch_xxx",
    "secret_token": "your-webhook-secret",
    "allowed_updates": ["message"]
  }'
```

## Webhook Secret

Telegram 会在请求头中发送：

```text
X-Telegram-Bot-Api-Secret-Token
```

Supportly 会用渠道配置中的 Webhook Secret 校验该请求头。

如果不一致，请求会被拒绝。

## 消息处理流程

Telegram 用户发消息后：

1. Telegram 调用 Supportly Webhook
2. TelegramAdapter 校验 secret
3. TelegramAdapter 解析 update
4. 系统创建或查找会话
5. 写入 inbound message
6. 如果会话状态是 bot，触发 AI 回复
7. 调用 Telegram `sendMessage` 发回回复

## 常见问题

### setWebhook 返回 404

常见原因是 URL 中没有替换真实 Bot Token。

错误示例：

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

需要把 `<TELEGRAM_BOT_TOKEN>` 替换成真实 token。

### Webhook 测试不通过

检查：

- API 域名是否公网可访问
- ngrok 或 Worker 地址是否正确
- Webhook URL 是否包含正确渠道 ID
- Webhook Secret 是否一致
- Bot Token 是否正确
- Telegram `getWebhookInfo` 是否有 last_error_message

### Telegram 能收到客户消息，但发不出回复

检查：

- 渠道账号是否保存了 Bot Token
- Bot 是否被用户主动打开过
- Bot 是否有权限向对应 chat 发送消息
- Telegram API 是否返回错误
- 消息状态是否变为 failed
