# AI Chat Hub

本地、订阅优先、官方 Agent 原文保真、多平台统一窗口。

AI Chat Hub 是一个 Mac 本地 Chrome 侧边栏 PoC。用户只输入一次问题，Hub 通过本地 Native Messaging Companion 并行调用已经登录的 Codex 与 Claude 官方客户端，并分别保存两份原始输出。默认路线不使用模型 API，不读取浏览器 Cookie，也不包含 AI Council 的角色、路由或 Consensus。

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

## 项目资料

- [一页产品定义](./PRODUCT_DEFINITION.md)
- [技术 PoC 范围](./POC_SCOPE.md)
- [创建、开发、验收全流程](./MASTER_DEVELOPMENT_PLAN.md)
- [直接回答架构决策](./docs/decisions/0004-subscription-agent-direct-mode.md)
