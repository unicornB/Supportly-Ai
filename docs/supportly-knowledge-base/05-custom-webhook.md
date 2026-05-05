# Custom Webhook 接入说明

版本：2026-05

适用问题：

- 自定义系统怎么接入 Supportly？
- Webhook 请求格式是什么？
- outbound_url 是什么？
- 签名怎么校验？
- 为什么消息没有进入后台？

## 入站 Webhook 地址

Custom Webhook 使用统一地址：

```text
POST /webhooks/:channelAccountId
```

示例：

```text
POST https://your-api-domain.com/webhooks/ch_xxx
```

`channelAccountId` 是后台创建渠道后生成的渠道 ID。

## 入站消息格式

请求示例：

```json
{
  "event_id": "evt_1",
  "event_type": "message.created",
  "contact": {
    "external_id": "user_1",
    "name": "Alice",
    "avatar_url": "https://example.com/avatar.png"
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

字段说明：

- `event_id`：事件 ID，可用于幂等和排查
- `contact.external_id`：客户在外部系统中的稳定 ID
- `contact.name`：客户名称
- `message.external_id`：外部消息 ID
- `message.type`：消息类型，当前主要使用 text
- `message.text`：消息正文
- `timestamp`：消息时间

## 匿名客户

如果外部系统没有提供 `contact.external_id`，Supportly 会生成匿名客户 ID。

匿名客户仍然可以创建会话，但建议接入方尽量提供稳定客户 ID，方便会话归并。

## 出站回复

如果渠道配置了：

```text
outbound_url
```

客服或 AI 回复时，Supportly 会向该 URL 推送消息。

如果没有配置 `outbound_url`，回复只会保存在后台，不会发回外部系统。

## 出站消息格式

Supportly 推送到 `outbound_url` 的消息示例：

```json
{
  "event_type": "message.send",
  "conversation_id": "conv_xxx",
  "message_id": "msg_xxx",
  "message": {
    "type": "text",
    "text": "退款一般会在 3 到 7 个工作日原路退回。"
  }
}
```

## 签名校验

建议每个 Custom Webhook 渠道配置 Webhook Secret。

入站请求应携带：

```text
x-supportly-signature
```

签名算法：

```text
HMAC-SHA256(secret, rawBody)
```

如果签名不匹配，Supportly 会拒绝请求。

## 常见问题

### 消息没有进入后台

检查：

- Webhook URL 是否正确
- 渠道 ID 是否正确
- 请求方法是否是 POST
- JSON 格式是否符合要求
- 签名是否正确
- `message.text` 是否为空

### 客服回复没有回到外部系统

检查：

- 渠道是否配置 `outbound_url`
- `outbound_url` 是否公网可访问
- 外部系统是否正确处理 `message.send`
- 消息状态是否为 failed

