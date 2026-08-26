import { createManualRelayAdapter } from "./adapters/manual-relay-adapter.js";
import { createChromeConversationStore } from "./storage/conversation-store.js";

const adapters = new Map([
  ["chatgpt", createManualRelayAdapter({
    id: "chatgpt",
    label: "ChatGPT",
    officialUrl: "https://chatgpt.com/",
    allowedHosts: ["chatgpt.com"],
  })],
  ["claude", createManualRelayAdapter({
    id: "claude",
    label: "Claude",
    officialUrl: "https://claude.ai/",
    allowedHosts: ["claude.ai"],
  })],
]);

const store = createChromeConversationStore();
const promptInput = document.querySelector("#prompt");
const copyButton = document.querySelector("#copy-prompt");
const clearButton = document.querySelector("#clear-history");
const errorElement = document.querySelector("#form-error");
const resultsElement = document.querySelector("#results");
const resultTemplate = document.querySelector("#result-template");

function setPromptError(message = "") {
  errorElement.textContent = message;
  errorElement.hidden = !message;
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

async function copyPrompt() {
  const prompt = promptInput.value;
  if (!prompt.trim()) {
    setPromptError("请先输入问题。");
    promptInput.focus();
    return;
  }

  try {
    await navigator.clipboard.writeText(prompt);
    setPromptError("");
    copyButton.textContent = "已复制，可到官网粘贴";
    setTimeout(() => { copyButton.textContent = "复制问题"; }, 1800);
  } catch {
    setPromptError("复制失败，请选中文字后按 Command + C。");
  }
}

async function saveManualResponse(providerId) {
  const adapter = adapters.get(providerId);
  const card = document.querySelector(`[data-provider="${providerId}"]`);
  const responseInput = card.querySelector(".response-input");
  const sourceInput = card.querySelector(".source-input");
  const status = card.querySelector(".save-status");

  try {
    const response = adapter.createResponse({
      promptText: promptInput.value,
      rawText: responseInput.value,
      sourceUrl: sourceInput.value,
    });
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

async function loadHistory() {
  const records = await store.list();
  for (const record of records) renderRecord(record);
}

copyButton.addEventListener("click", copyPrompt);
for (const button of document.querySelectorAll(".save-response")) {
  button.addEventListener("click", () => saveManualResponse(button.dataset.providerId));
}
clearButton.addEventListener("click", async () => {
  if (!confirm("确定删除 AI Chat Hub 在此浏览器中保存的全部历史吗？")) return;
  await store.clear();
  resultsElement.replaceChildren();
});

await loadHistory();
