# Supportly 常见故障排查

版本：2026-05

适用问题：

- CORS 报错怎么办？
- Widget 发送失败怎么办？
- Telegram Webhook 不通怎么办？
- D1 报唯一键冲突怎么办？
- AI Search 报错怎么办？

## Widget CORS 报错

错误示例：

```text
Access to fetch at 'http://localhost:8787/api/widget/conversations'
from origin 'http://localhost:5174' has been blocked by CORS policy
```

排查步骤：

1. 确认后端已重启，运行的是最新代码
2. 确认请求路径是 `/api/widget/*`
3. 确认后端 CORS 配置允许 `Authorization` 和 `Content-Type`
4. 查看浏览器 Network 中真实响应状态
5. 如果响应是 500，需要先修复后端错误

当前 Widget API 允许：

```text
Access-Control-Allow-Origin: *
```

## Widget 发送后出现两条消息

旧版本可能出现本地发送中消息和轮询返回消息短暂重复。

新版已在前端合并逻辑中处理：

- 本地消息 ID 以 `local_` 开头
- 远端返回相同内容的 customer inbound 消息时，会替换本地发送中消息

如果仍然出现重复，建议清理浏览器缓存并重新构建 `web-widget`。

## Widget 发送失败

排查步骤：

1. 确认 `VITE_WIDGET_API_BASE_URL` 指向正确后端
2. 确认 Web Chat 渠道存在且状态 active
3. 确认 `data-channel-id` 是 Web Chat 渠道 ID
4. 查看 `/api/widget/conversations` 是否成功
5. 查看 visitor token 是否被浏览器保存

## Telegram Webhook 失败

排查步骤：

1. 确认 Bot Token 正确
2. 确认 Webhook URL 是公网 HTTPS 地址
3. 确认 URL 中渠道 ID 正确
4. 确认 Webhook Secret 与 Admin 中一致
5. 调用 Telegram `getWebhookInfo` 查看 last_error_message

## D1 唯一键冲突

错误示例：

```text
UNIQUE constraint failed: messages.channel_account_id, messages.external_message_id
```

原因通常是外部平台重复推送同一条消息。

系统应基于：

```text
channel_account_id + external_message_id
```

进行幂等处理。

如果遇到该问题，应确认代码是否使用 `INSERT OR IGNORE` 或先查询重复消息。

## AI Search hybrid 报错

错误示例：

```text
retrieval_type 'hybrid' is not available: keyword indexing is disabled
```

解决方式：

```text
使用 vector retrieval_type
```

当前 Supportly 已默认使用 vector。

## AI 不回答

排查步骤：

1. 确认知识库文档已上传
2. 确认 AI Search items 状态正常
3. 在 Admin 点击同步 AI Search
4. 确认用户问题和文档内容相关
5. 确认会话 handoff status 是 bot
6. 检查 Workers AI 模型配置

