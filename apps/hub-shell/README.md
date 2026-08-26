# Hub Shell

零第三方依赖的 Chrome Manifest V3 侧边栏。默认通过 Native Messaging 连接 Mac 本地 Companion，在单一聊天时间线里用 `@codex`、`@claude` 或 `@all` 选择回答者并连续追问；网页手动转接是备用路径。

## 加载

1. 在项目根目录运行 `npm run install:native-host`。
2. 打开 `chrome://extensions`。
3. 启用“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择本目录 `apps/hub-shell`。
5. 固定 AI Chat Hub 图标并点击，打开侧边栏。

扩展 ID 由公开的 manifest key 固定为 `kciebkgpifidpicfbhpmdddibfnnhkgg`，Native host 只接受该扩展连接。manifest key 不是账号密钥或签名私钥。

## 数据

用户消息和 Agent 原始回答保存在 `chrome.storage.local`。最近 20 条消息会作为共享上下文发送给本次被点名的 Agent。扩展没有 AI 网站 host permission，不读取 Cookie、账号 ID 或订阅详情。清除扩展数据或在界面点击“新对话”会删除当前本地历史。
