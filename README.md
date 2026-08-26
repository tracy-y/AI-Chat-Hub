# AI Chat Hub

本地、订阅优先、官方回复保真、多平台统一窗口。

当前阶段是技术 PoC 初始化：先验证两个官方网页会话能否在凭据不离开 Mac、回复不被改写的前提下可靠接入，再决定具体应用框架，以及是否值得评估 Open WebUI 的独立派生路线。

## 项目基线

- [一页产品定义](./PRODUCT_DEFINITION.md)
- [技术 PoC 范围](./POC_SCOPE.md)

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

尚未选择技术栈，尚未接入任何平台，尚未复制或派生 Open WebUI。下一决策门是选择首批两个官方平台并核对当前条款与浏览器自动化边界。
