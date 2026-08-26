# ADR 0004: Subscription Agent direct mode

- Status: Accepted
- Date: 2026-08-26

## Decision

AI Chat Hub 的默认 PoC 改为“扩展 + Mac 本地 Native Messaging Companion”。扩展把用户明确提交的问题交给 Companion；Companion 并行调用用户已经登录的官方 Codex CLI 与 Claude CLI，再把两份输出独立、原样返回。手动网页转接保留为故障兜底。

这不是 ChatGPT.com 或 Claude.ai 网页自动化，也不读取浏览器 Cookie。Codex 与 Claude 的登录、凭据存储、订阅资格和用量控制继续由各自官方客户端负责。

## Security boundaries

- 扩展只有 `sidePanel`、`storage` 和 `nativeMessaging` 权限，没有 AI 网站 host permission。
- Companion 仅接受固定协议和固定 provider；不接受任意命令或参数。
- Prompt 通过 stdin 传递，不经过 shell 插值。
- Claude 关闭工具、浏览器联动和会话持久化；Codex 在临时空目录和只读沙箱中执行。
- Companion 不保存凭据、账号信息、Prompt、回复或运行日志；回复历史只在 `chrome.storage.local`。
- 公开仓库只含代码和非敏感配置。Native host 清单只允许本项目的固定扩展 ID。

## Product caveat

结果来源标签必须写成“Codex（ChatGPT 订阅）”和“Claude Agent（Claude 订阅）”。它们是官方 Agent 客户端的输出，不承诺与 ChatGPT.com 或 Claude.ai 网页在相同问题上的回答逐字一致。
