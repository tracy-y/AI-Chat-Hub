# AI Chat Hub

本地、订阅优先、官方回复保真、多平台统一窗口。

当前阶段是技术 PoC 初始化：先验证两个官方网页会话能否在凭据不离开 Mac、回复不被改写的前提下可靠接入，再决定具体应用框架，以及是否值得评估 Open WebUI 的独立派生路线。

项目首先供开发者本人在 Mac 本地使用，成熟后通过 GitHub 公开。每位使用者必须自行注册并登录自己的官方 AI 账号、使用自己的有效订阅；本项目不提供共享账号、共享订阅或 Cookie 托管。

## 项目基线

- [一页产品定义](./PRODUCT_DEFINITION.md)
- [技术 PoC 范围](./POC_SCOPE.md)
- [创建、开发、验收全流程](./MASTER_DEVELOPMENT_PLAN.md)

## 目录

```text
apps/hub-shell/               Mac 本地统一窗口
packages/core/                平台无关领域模型与任务状态
packages/provider-adapters/   官方网页平台适配器
packages/local-store/         本地持久化与迁移
docs/decisions/               架构决策记录
tests/acceptance/             保真、隔离、恢复与失败测试
```

## 当前状态

已建立零第三方依赖的 Chrome Manifest V3 侧边栏 PoC。当前采用 ChatGPT + Claude 手动辅助转接：用户亲自在官方页面发送并复制回复，Hub 只保存用户明确粘贴的原文。扩展没有任何真实 AI 网站权限，也不读取账号或 Cookie。

## 本地验证

```bash
npm run verify
```

扩展的本地加载步骤见 [`apps/hub-shell/README.md`](./apps/hub-shell/README.md)。
