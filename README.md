# AI Chat Hub

本地、订阅优先、官方 Agent 原文保真、多平台统一窗口。

AI Chat Hub 是一个 Mac 本地 Chrome 侧边栏 PoC。所有消息出现在同一条聊天时间线；用户可在 `@` 菜单中选择已登录的 Agent 或 `@all`，并在同一窗口反复追问。Hub 通过本地 Native Messaging Companion 调用已经登录的官方客户端并原样保存输出。默认路线不使用模型 API，不读取浏览器 Cookie，也不包含 AI Council 的角色、自动路由或 Consensus。

后续问题会按当前会话选择的上下文档位，把最近的聊天记录交给被点名的 Agent。简单聊天保留 20 条/约 16,000 字符，一般聊天保留 50 条/约 40,000 字符，深度策划保留 100 条/约 70,000 字符；超长时优先保留最新内容。Agent 输出仍按来源独立显示，不互相覆盖。

> 当前“订阅直连”支持 Codex、Claude Agent、Gemini via Antigravity 和 Grok Build。Qwen 与 DeepSeek 没有可复用其消费级网页账号的官方 OAuth CLI，因此提供默认关闭、明确标记的可选 API 模式；API 回复不会冒充网页订阅回复。

## 隐私边界

- Codex、Claude、Antigravity 与 Grok 的账号登录由各自官方客户端管理。
- Prompt 只在扩展、Mac 本地 Companion 与官方客户端之间流转。
- Companion 不持久化 Prompt、回复、账号数据或运行日志。
- 历史只保存在本机 `chrome.storage.local`；仓库不保存 Cookie、token、邮箱或私人对话。
- 当前 Chrome 扩展不申请 AI 官方网站访问权限；Qwen/DeepSeek 网页模式落地时只会申请对应官方域名的最小权限。
- 用户可在扩展中维护全局长期说明，单独保存在 `~/Library/Application Support/AI Chat Hub/instructions/README.md`（目录 `0700`、文件 `0600`），不进入 Git 或聊天数据库。提问时该内容会发送给被选中的官方 Agent，因此不得写入密码、Cookie、API key 或验证码。
- 每个 Agent 还有独立且默认留空的专属 Instruction，保存在 `instructions/providers/<agent>.md`；模型选择保存在私有的 `settings/providers.json`。只有被点名的 Agent 会收到自己的专属说明，用户可随时修改或清空。
- 聊天框可添加最多 5 个本地文本附件（文本、Markdown、代码、JSON、CSV 等）。正文只在当前发送过程中交给被选中的 Agent；聊天记录只保存文件名、类型和大小，不把文件正文写入 Git 或本地聊天数据库。单文件上限 1 MB / 20,000 字符，合计上限 35,000 字符。
- Qwen 和 DeepSeek 的“可选 API 模式”默认关闭。启用状态与区域保存在本机私有设置文件，API Key 通过无命令行明文参数的方式写入 macOS Keychain；Native Companion 只向扩展返回“是否已配置”，绝不返回 Key 内容。
- Qwen 默认使用中国区 Coding Plan；也可切换到国际区 Coding Plan，或使用中国区百炼按量付费 API。不同计费方式的 Key 与 Base URL 不可混用，切换时必须输入对应 Key。
- Qwen 深度思考默认关闭，以降低普通聊天等待时间；用户可在 API 设置中按需开启，回复文本仍按供应商原文保存。

## 本机运行

前置条件：Node.js 20+、Chrome，以及至少一个已经完成账号登录的官方 CLI：`codex`、`claude`、`agy` 或 `grok`。

```bash
npm run verify
npm run install:native-host
```

然后打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，加载 `apps/hub-shell`。修改代码或重新安装 Companion 后，在扩展卡片点击“重新加载”。

## 聊天方式

- 在输入框键入 `@`，从弹出的菜单选择当前可用的 Codex、Claude Agent、Gemini、Grok 或全部 Agent。
- 可继续输入字母过滤菜单，并使用上下方向键 + Enter/Tab 选择，Esc 关闭。
- 不写 `@`：固定等同于 `@all`，不做智能路由。
- 发送后的用户气泡只显示问题正文；目标显示为“发送给 Codex/Claude”。
- 每个会话可独立选择“简单 20 条 / 一般 50 条 / 深度 100 条”，新会话默认简单模式。
- “用户 Instruction”用于保存希望所有 Agent 长期参考的稳定信息；最多 20,000 字符，保存采用原子替换，重新安装不会覆盖已有 README。
- “Agent 设置”可分别选择模型并按需填写专属角色、语气、结构和关注重点；每个专属 Instruction 最多 10,000 字符，不填写时不会添加任何专属提示。
- Enter 发送，Shift + Enter 换行。
- “新对话”只创建新的空会话，不删除当前内容；已有会话保存在聊天窗口下面，可点击重新打开并继续。
- 每条历史对话都有独立“删除”按钮；确认后只删除 Hub 的本地副本且无法撤销，不影响官方平台中的对话。
- 从 `0.2.x` 升级时，原有本地聊天会自动迁移成第一条历史对话。

## 项目资料

- [一页产品定义](./PRODUCT_DEFINITION.md)
- [技术 PoC 范围](./POC_SCOPE.md)
- [创建、开发、验收全流程](./MASTER_DEVELOPMENT_PLAN.md)
- [直接回答架构决策](./docs/decisions/0004-subscription-agent-direct-mode.md)
