# 知识库与 AI Search 使用说明

版本：2026-05

适用问题：

- 知识库怎么上传？
- AI Search 是什么？
- 为什么文档同步不到后台？
- 为什么 AI 没有回复？
- hybrid 检索报错怎么办？

## 知识库作用

Supportly 的 AI 回复基于知识库。

流程：

```text
客户问题
  -> AI Search 检索相关文档
  -> Workers AI 基于检索结果生成回答
  -> 回复写入消息表
```

如果没有命中文档，系统默认不强行编造回答。

## 上传知识库

在 Admin 的「知识库」页面可以上传文档。

当前建议上传：

- PDF
- Markdown
- HTML
- TXT

单个文件大小限制：

```text
4MB
```

上传后系统会：

1. 把文件上传到 AI Search
2. 在 D1 的 `kb_documents` 表保存文档记录
3. 后续检索时使用 AI Search 返回的内容

## 从 AI Search 同步

如果文档是在 Cloudflare Dashboard 的 AI Search 页面上传的，可以在 Admin 中点击：

```text
同步 AI Search
```

系统会读取当前 AI Search instance 的 items，并同步到本地 `kb_documents` 表。

同步不会重新上传文件，只会同步元数据。

## AI Search 配置

当前 `wrangler.toml` 示例：

```toml
[[ai_search_namespaces]]
binding = "AI_SEARCH"
namespace = "aidesk"
remote = true

[vars]
KB_INSTANCE_NAME = "supportly-dev"
```

注意：

- `namespace` 是 AI Search namespace
- `KB_INSTANCE_NAME` 是 AI Search instance name
- 两者需要和 Cloudflare Dashboard 中配置一致

## retrieval_type

如果 AI Search instance 没有启用 keyword indexing，使用 `hybrid` 会报错。

错误类似：

```text
retrieval_type 'hybrid' is not available: keyword indexing is disabled
```

当前 Supportly 使用：

```text
retrieval_type = vector
```

这样可以兼容未启用 keyword indexing 的实例。

## AI 没有回复的常见原因

常见原因：

- 文档没有上传成功
- AI Search 仍在索引
- 问题没有命中文档
- 文档内容太少或标题不清晰
- AI Search namespace 或 instance name 配错
- Workers AI binding 不可用
- 会话已经切换到人工接管

## 文档编写建议

为了提高命中率，知识库文档建议：

- 每个主题单独一篇
- 标题明确，例如「Telegram Bot 接入说明」
- 包含用户可能问法
- 包含标准答案
- 包含排查步骤
- 避免只放截图
- 避免过长、混杂多个主题

推荐结构：

```text
标题
适用问题
背景说明
标准答案
操作步骤
常见问题
客服处理建议
```

