import { createManualRelayAdapter } from "./adapters/manual-relay-adapter.js";
import { createNativeAgentResponse } from "./adapters/native-agent-adapter.js";
import { askNativeCompanion } from "./native-client.js";
import { createChromeConversationStore } from "./storage/conversation-store.js";

const adapters = new Map([
  ["chatgpt", createManualRelayAdapter({ id: "chatgpt", label: "ChatGPT 网页", officialUrl: "https://chatgpt.com/", allowedHosts: ["chatgpt.com"] })],
  ["claude", createManualRelayAdapter({ id: "claude", label: "Claude 网页", officialUrl: "https://claude.ai/", allowedHosts: ["claude.ai"] })],
]);
const store = createChromeConversationStore();
const promptInput = document.querySelector("#prompt");
const askButton = document.querySelector("#ask-all");
const clearButton = document.querySelector("#clear-history");
const errorElement = document.querySelector("#form-error");
const resultsElement = document.querySelector("#results");
const resultTemplate = document.querySelector("#result-template");

function setPromptError(message = "") {
  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function setProviderProgress(providerId, text, status = "idle") {
  const item = document.querySelector(`[data-progress-provider="${providerId}"]`);
  item.querySelector("strong").textContent = text;
  item.dataset.status = status;
}

function renderRecord(record) {
  const fragment = resultTemplate.content.cloneNode(true);
  fragment.querySelector(".provider-name").textContent = record.providerLabel;
  fragment.querySelector(".timestamp").textContent = new Date(record.capturedAt).toLocaleString();
  fragment.querySelector(".prompt-text").textContent = record.promptText ?? "未记录";
  fragment.querySelector(".response-text").textContent = record.rawText;
  const sourceLink = fragment.querySelector(".source-link");
  if (record.sourceUrl) {
    sourceLink.href = record.sourceUrl;
    sourceLink.hidden = false;
  }
  const status = fragment.querySelector(".status");
  status.textContent = "已保存";
  status.dataset.status = "completed";
  resultsElement.prepend(fragment);
}

async function askAll() {
  const prompt = promptInput.value;
  if (!prompt.trim()) {
    setPromptError("请先输入问题。");
    promptInput.focus();
    return;
  }

  setPromptError("");
  askButton.disabled = true;
  askButton.textContent = "两个 Agent 正在回答…";
  for (const providerId of ["codex", "claude"]) setProviderProgress(providerId, "正在连接", "running");

  try {
    const results = await askNativeCompanion(prompt, {
      onStarted(providerIds) {
        for (const providerId of providerIds) setProviderProgress(providerId, "正在回答", "running");
      },
    });

    for (const result of results) {
      if (result.status === "completed") {
        const record = createNativeAgentResponse({ ...result, promptText: prompt });
        await store.append(record);
        renderRecord(record);
        setProviderProgress(result.providerId, "回答已保存", "completed");
      } else {
        setProviderProgress(result.providerId, result.error ?? "回答失败", "failed");
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPromptError(`${message} 请确认本地 Companion 已安装。`);
    for (const providerId of ["codex", "claude"]) setProviderProgress(providerId, "连接失败", "failed");
  } finally {
    askButton.disabled = false;
    askButton.textContent = "同时询问 Codex + Claude";
  }
}

async function saveManualResponse(providerId) {
  const adapter = adapters.get(providerId);
  const card = document.querySelector(`[data-provider="${providerId}"]`);
  const responseInput = card.querySelector(".response-input");
  const sourceInput = card.querySelector(".source-input");
  const status = card.querySelector(".save-status");
  try {
    const response = adapter.createResponse({ promptText: promptInput.value, rawText: responseInput.value, sourceUrl: sourceInput.value });
    await store.append(response);
    renderRecord(response);
    responseInput.value = "";
    sourceInput.value = "";
    status.textContent = "原文已保存到本机。";
    status.dataset.status = "saved";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.dataset.status = "failed";
  }
}

for (const record of await store.list()) renderRecord(record);
askButton.addEventListener("click", askAll);
for (const button of document.querySelectorAll(".save-response")) {
  button.addEventListener("click", () => saveManualResponse(button.dataset.providerId));
}
clearButton.addEventListener("click", async () => {
  if (!confirm("确定删除 AI Chat Hub 在此浏览器中保存的全部历史吗？")) return;
  await store.clear();
  resultsElement.replaceChildren();
});
