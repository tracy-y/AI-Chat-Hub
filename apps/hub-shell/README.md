# Hub Shell

零第三方依赖的 Chrome Manifest V3 侧边栏。默认通过 Native Messaging 连接 Mac 本地 Companion，在单一聊天时间线里键入 `@` 打开 Agent 选择菜单并连续追问；网页手动转接是备用路径。

## 加载

1. 在项目根目录运行 `npm run install:native-host`。
2. 打开 `chrome://extensions`。
3. 启用“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择本目录 `apps/hub-shell`。
5. 固定 AI Chat Hub 图标并点击，打开侧边栏。

扩展 ID 由公开的 manifest key 固定为 `kciebkgpifidpicfbhpmdddibfnnhkgg`，Native host 只接受该扩展连接。manifest key 不是账号密钥或签名私钥。

## 数据

用户消息、Agent 原始回答、多个会话及每个会话的上下文档位保存在 `chrome.storage.local`。点击“新对话”只新建会话，旧会话仍在下方历史列表中；每条历史记录可以在确认后单独永久删除。`0.2.x` 的旧数据会自动迁移。上下文可选简单 20 条、一般 50 条或深度 100 条，并有字符上限以优先保留最新内容。扩展没有 AI 网站 host permission，不读取 Cookie、账号 ID 或订阅详情。
