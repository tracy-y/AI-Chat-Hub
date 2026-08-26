# AI Chat Hub

本地、订阅优先、官方 Agent 原文保真、多平台统一窗口。

AI Chat Hub 是一个 Mac 本地 Chrome 侧边栏 PoC。所有消息出现在同一条聊天时间线；用户可用 `@codex`、`@claude` 或 `@all` 指定回答者，并在同一窗口反复追问。Hub 通过本地 Native Messaging Companion 调用已经登录的官方客户端并原样保存输出。默认路线不使用模型 API，不读取浏览器 Cookie，也不包含 AI Council 的角色、自动路由或 Consensus。

后续问题会把当前窗口最近 20 条记录作为共享上下文交给被点名的 Agent。Agent 输出仍按来源独立显示，不互相覆盖。

> 当前“直接回答”来自 Codex 和 Claude Agent 客户端，不是对 ChatGPT.com / Claude.ai 网页的自动控制，因此不保证与网页产品逐字产生相同回答。

## 隐私边界

- Codex 与 Claude 的账号和订阅登录由各自官方客户端管理。
- Prompt 只在扩展、Mac 本地 Companion 与官方客户端之间流转。
- Companion 不持久化 Prompt、回复、账号数据或运行日志。
- 历史只保存在本机 `chrome.storage.local`；仓库不保存 Cookie、token、邮箱或私人对话。
- Chrome 扩展不申请 ChatGPT 或 Claude 网站访问权限。

## 本机运行

前置条件：Node.js 20+、Chrome，以及已经完成订阅登录的 `codex` 和 `claude` CLI。

```bash
npm run verify
npm run install:native-host
```

然后打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，加载 `apps/hub-shell`。修改代码或重新安装 Companion 后，在扩展卡片点击“重新加载”。

## 聊天方式

- 在输入框键入 `@`，从弹出的菜单选择 Codex、Claude Agent 或全部 Agent。
- 可继续输入字母过滤菜单，并使用上下方向键 + Enter/Tab 选择，Esc 关闭。
- 不写 `@`：固定等同于 `@all`，不做智能路由。
- 发送后的用户气泡只显示问题正文；目标显示为“发送给 Codex/Claude”。
- Enter 发送，Shift + Enter 换行；“新对话”会清空当前本地聊天记录。

## 项目资料

- [一页产品定义](./PRODUCT_DEFINITION.md)
- [技术 PoC 范围](./POC_SCOPE.md)
- [创建、开发、验收全流程](./MASTER_DEVELOPMENT_PLAN.md)
- [直接回答架构决策](./docs/decisions/0004-subscription-agent-direct-mode.md)
