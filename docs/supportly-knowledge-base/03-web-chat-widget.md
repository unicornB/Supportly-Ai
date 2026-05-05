# Web Chat Widget 接入说明

版本：2026-05

适用问题：

- 网站怎么接入 Supportly 客服？
- 为什么是 `/widget/supportly.js`？
- Widget 能不能只插入一段 JS？
- Web Chat 是否需要 WebSocket？
- 访客是匿名的吗？

## 接入方式

Web Chat Widget 支持一段 JS 接入。

示例：

```html
<script
  src="https://your-widget-domain.com/widget/supportly.js"
  data-channel-id="ch_xxx"
  data-title="在线客服"
  async>
</script>
```

其中：

- `src` 是 Widget 静态 JS 地址
- `data-channel-id` 是后台创建的 Web Chat 渠道 ID
- `data-title` 是聊天窗口标题

## 本地测试地址

本地 preview 默认地址：

```text
http://localhost:5174/widget/supportly.js
```

不能使用：

```text
http://localhost:5174/supportly.js
```

原因是 Widget 资源统一放在 `/widget/` 路径下，包含：

- `/widget/supportly.js`
- `/widget/frame.html`
- `/widget/assets/*`

这样可以避免和客户网站自身资源冲突。

## Widget 架构

Widget 由两部分组成：

1. `supportly.js`：注入右下角图标按钮，创建 iframe
2. `frame.html`：iframe 内部聊天 UI

使用 iframe 的原因：

- 避免客户网站 CSS 污染聊天窗口
- 避免 Widget 样式污染客户网站
- 便于独立发布和升级
- 安全边界更清晰

## 匿名访客

Web Chat 默认支持匿名访客。

浏览器会生成并保存：

```text
visitor_xxx
```

保存位置：

```text
localStorage
```

同一浏览器再次访问时，会复用相同 visitor ID。

## Visitor Token

Widget API 不使用后台管理员登录态。

创建会话时，后端会签发 visitor token。

后续接口必须携带：

```text
Authorization: Bearer <visitorToken>
```

visitor token 用于限制访客只能读取自己的会话消息。

## 是否需要 WebSocket

当前版本不需要 WebSocket。

Widget 使用 HTTP 轮询：

- 聊天窗口打开时，每 3 秒轮询一次
- 客服或 AI 回复后，访客可以通过轮询读取到消息

后续如果需要更强实时性，可以考虑 SSE、WebSocket 或 Durable Objects。

## 发送状态

Widget 发送消息时会显示：

- 发送中
- 已发送
- 发送失败

如果发送失败，输入内容会回填，方便访客重新发送。

## 常见问题

### 为什么 Widget 请求被 CORS 拦截？

需要确认后端 `/api/widget/*` 已启用 CORS，并且后端运行的是最新代码。

当前允许：

```text
Access-Control-Allow-Origin: *
```

真实访问控制依赖 visitor token。

### 为什么发送后消息出现两次？

旧版本可能出现本地发送中消息和轮询返回消息短暂重复。新版会自动用后端真实消息替换本地临时消息。

### Widget 怎么发布？

推荐把 `web-widget/dist` 上传到 Cloudflare Pages 或其他静态 CDN。

