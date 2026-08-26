# AI Chat Hub — 技术 PoC 范围

## 要证明什么

在不使用默认模型 API、不读取或复制账号凭据、不修改 Agent 输出的前提下，Mac 本地 Chrome 侧边栏能否把同一个纯文本问题并行发送给 Codex 与 Claude 官方客户端，并把两份结果独立保存和展示。

## 当前架构

```text
Chrome Side Panel
  └─ Native Messaging（固定扩展 ID）
      └─ Mac 本地 Companion（无数据库、无日志、无任意命令入口）
          ├─ Codex CLI ── 用户自己的 ChatGPT 订阅登录
          └─ Claude CLI ── 用户自己的 Claude 订阅登录
```

扩展只拥有 `sidePanel`、`storage` 与 `nativeMessaging` 权限，不拥有 ChatGPT 或 Claude 网站权限。Companion 用固定参数启动两个客户端，Prompt 经 stdin 传入；两个结果互不覆盖，只在 `chrome.storage.local` 保存。

## In Scope

1. 在单一聊天时间线中通过 `@codex`、`@claude` 或 `@all` 明确选择回答者，并可连续追问。
2. 两个平台独立显示连接、运行、完成或失败状态。
3. 保存官方 Agent 客户端返回的原始文本，不摘要、合并、评分或改写。
4. 一个 Provider 失败时，另一个仍可成功并保存。
5. 本机统一聊天历史、最近 20 条共享上下文和一键开始新对话。
6. Companion 安装、固定扩展来源、消息长度、超时和输出上限。
7. 手动网页复制作为 Companion 不可用时的保真兜底。

## Out of Scope

- ChatGPT.com 或 Claude.ai 的 DOM 自动化、Cookie 读取与网页会话抓取。
- 保证 Agent CLI 输出与对应网页产品逐字一致。
- AI Council 的角色、路由、投票、审议或 Consensus。
- 默认 API 接入、云端代理、共享账号、共享订阅或凭据托管。
- 附件、图片、语音、跨设备同步、多人协作和移动端。
- SQLite、检索、导出与正式安装包；这些属于 PoC 通过后的 MVP。
- 直接派生 Open WebUI 或复用其现有实例、配置和数据库。

## 安全边界

- 账号登录、token 与订阅状态由官方客户端保管，不进入仓库、Hub 历史或 Companion 日志。
- Native host 只接受本项目固定 Chrome 扩展 ID。
- Companion 不接受前端提供的命令、可执行文件路径或 CLI 参数。
- Claude 禁用工具、浏览器联动和会话持久化。
- Codex 在临时空目录和只读沙箱运行；PoC 不宣称它是处理不可信 Prompt 的强隔离容器。
- 错误返回删除本机 Home 路径并限制长度。

## PoC 验收

- [x] Codex 与 Claude 登录就绪检查通过，未输出账号信息。
- [x] 两个官方客户端在本机用订阅登录完成最小真实回答。
- [x] Native Messaging 编解码、固定参数、stdin 传递、原文保真和本地存储单测通过。
- [x] Native host 安装成功，并通过真实 `ping → pong` 协议检查。
- [ ] 在 Chrome 重新加载扩展后，从侧边栏完成一组双 Provider 真实问答。
- [ ] 验证单个平台失败不会阻塞或覆盖另一个平台。
- [ ] 验证“清除全部历史”后 `chrome.storage.local` 不再包含 Hub 记录。
- [ ] 完成 10 组双平台稳定性测试，再决定进入 MVP。

## PoC 通过后的下一步

先完成浏览器端三项人工验收，再做历史搜索、取消请求、结构化错误与正式本地安装体验。暂不扩展平台、附件或云功能。
