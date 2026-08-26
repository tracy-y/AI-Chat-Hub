import { createManualRelayAdapter } from "./adapters/manual-relay-adapter.js";
import { createNativeAgentResponse } from "./adapters/native-agent-adapter.js";
import { buildProviderPrompt } from "./core/conversation-context.js";
import { parseMentionRouting } from "./core/mention-routing.js";
import { createUserMessage } from "./core/user-message.js";
import { askNativeCompanion } from "./native-client.js";
import { createChromeConversationStore } from "./storage/conversation-store.js";

const PROVIDER_LABELS = Object.freeze({
  codex: "Codex（ChatGPT 订阅）",
  claude: "Claude Agent（Claude 订阅）",
});
const adapters = new Map([
  ["chatgpt", createManualRelayAdapter({ id: "chatgpt", label: "ChatGPT 网页", officialUrl: "https://chatgpt.com/", allowedHosts: ["chatgpt.com"] })],
  ["claude", createManualRelayAdapter({ id: "claude", label: "Claude 网页", officialUrl: "https://claude.ai/", allowedHosts: ["claude.ai"] })],
]);
const store = createChromeConversationStore();
const timeline = document.querySelector("#timeline");
const emptyState = document.querySelector("#empty-state");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send-message");
const newChatButton = document.querySelector("#new-chat");
const errorElement = document.querySelector("#form-error");
const connectionStatus = document.querySelector("#connection-status");
const userTemplate = document.querySelector("#user-message-template");
const agentTemplate = document.querySelector("#agent-message-template");
let conversationRecords = await store.list();

function setError(message = "") {
  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollToLatest() {
  timeline.scrollTop = timeline.scrollHeight;
}

function createUserElement(record) {
  const fragment = userTemplate.content.cloneNode(true);
  const element = fragment.querySelector(".message");
  element.querySelector("time").textContent = formatTime(record.createdAt);
  element.querySelector(".message-text").textContent = record.text;
  element.querySelector(".message-targets").textContent = record.providers.map((id) => `@${id}`).join(" · ");
  return element;
}

function createAgentElement(record) {
  const fragment = agentTemplate.content.cloneNode(true);
  const element = fragment.querySelector(".message");
  element.dataset.provider = record.providerId;
  element.querySelector(".agent-avatar").textContent = record.providerId === "claude" ? "C" : "G";
  element.querySelector(".provider-name").textContent = record.providerLabel;
  element.querySelector("time").textContent = formatTime(record.capturedAt ?? record.createdAt);
  element.querySelector(".message-text").textContent = record.rawText ?? record.error;
  if (record.kind === "error") element.classList.add("message-error");
  const sourceLink = element.querySelector(".source-link");
  if (record.sourceUrl) {
    sourceLink.href = record.sourceUrl;
    sourceLink.hidden = false;
  }
  return element;
}

function renderRecord(record) {
  emptyState.hidden = true;
  const element = record.kind === "user" ? createUserElement(record) : createAgentElement(record);
  timeline.append(element);
  scrollToLatest();
  return element;
}

function createPendingElement(providerId) {
  const element = createAgentElement({
    kind: "pending",
    providerId,
    providerLabel: PROVIDER_LABELS[providerId],
    rawText: "正在回答…",
    createdAt: new Date().toISOString(),
  });
  element.classList.add("message-pending");
  timeline.append(element);
  scrollToLatest();
  return element;
}

async function appendRecord(record) {
  await store.append(record);
  conversationRecords.push(record);
}

async function sendMessage() {
  let route;
  try {
    route = parseMentionRouting(promptInput.value);
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
    promptInput.focus();
    return;
  }

  const historyBeforeMessage = [...conversationRecords];
  const userMessage = createUserMessage({
    text: promptInput.value.trim(),
    promptText: route.prompt,
    providers: route.providers,
  });
  setError("");
  promptInput.value = "";
  sendButton.disabled = true;
  promptInput.disabled = true;
  connectionStatus.textContent = "正在连接…";
  await appendRecord(userMessage);
  renderRecord(userMessage);

  const pending = new Map(route.providers.map((providerId) => [providerId, createPendingElement(providerId)]));
  const providerPrompt = buildProviderPrompt(historyBeforeMessage, route.prompt);

  try {
    const results = await askNativeCompanion(providerPrompt, route.providers, {
      onStarted(providerIds) {
        connectionStatus.textContent = `${providerIds.map((id) => `@${id}`).join(" + ")} 回答中`;
      },
    });

    for (const result of results) {
      let record;
      if (result.status === "completed") {
        record = createNativeAgentResponse({ ...result, promptText: route.prompt });
      } else {
        record = Object.freeze({
          id: crypto.randomUUID(),
          kind: "error",
          providerId: result.providerId,
          providerLabel: result.providerLabel ?? PROVIDER_LABELS[result.providerId],
          error: result.error ?? "回答失败",
          createdAt: new Date().toISOString(),
        });
      }
      await appendRecord(record);
      pending.get(result.providerId)?.replaceWith(createAgentElement(record));
    }
    connectionStatus.textContent = "已完成";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setError(`${message} 请确认本地 Companion 已安装。`);
    for (const [providerId, element] of pending) {
      element.replaceWith(createAgentElement({
        kind: "error",
        providerId,
        providerLabel: PROVIDER_LABELS[providerId],
        error: "本地 Companion 连接失败",
        createdAt: new Date().toISOString(),
      }));
    }
    connectionStatus.textContent = "连接失败";
  } finally {
    sendButton.disabled = false;
    promptInput.disabled = false;
    promptInput.focus();
    scrollToLatest();
  }
}

function selectMention(mention) {
  const cleaned = promptInput.value.replace(/(^|\s)@(codex|gpt|chatgpt|claude|all)\b/gi, "$1").trimStart();
  promptInput.value = `${mention} ${cleaned}`;
  promptInput.focus();
  promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
}

async function saveManualResponse(providerId) {
  const latestUserMessage = [...conversationRecords].reverse().find((record) => record.kind === "user");
  const card = document.querySelector(`[data-provider="${providerId}"]`);
  const status = card.querySelector(".save-status");
  try {
    if (!latestUserMessage) throw new TypeError("请先在聊天窗口发送一条用户消息");
    const responseInput = card.querySelector(".response-input");
    const sourceInput = card.querySelector(".source-input");
    const response = adapters.get(providerId).createResponse({
      promptText: latestUserMessage.promptText,
      rawText: responseInput.value,
      sourceUrl: sourceInput.value,
    });
    await appendRecord(response);
    renderRecord(response);
    responseInput.value = "";
    sourceInput.value = "";
    status.textContent = "原文已加入当前对话。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.dataset.status = "failed";
  }
}

for (const record of conversationRecords) renderRecord(record);
sendButton.addEventListener("click", sendMessage);
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!sendButton.disabled) sendMessage();
  }
});
for (const button of document.querySelectorAll("[data-mention]")) {
  button.addEventListener("click", () => selectMention(button.dataset.mention));
}
for (const button of document.querySelectorAll(".save-response")) {
  button.addEventListener("click", () => saveManualResponse(button.dataset.providerId));
}
newChatButton.addEventListener("click", async () => {
  if (!confirm("开始新对话并删除当前本地聊天记录吗？")) return;
  await store.clear();
  conversationRecords = [];
  timeline.replaceChildren(emptyState);
  emptyState.hidden = false;
  connectionStatus.textContent = "本机直连";
  setError("");
  promptInput.focus();
});
