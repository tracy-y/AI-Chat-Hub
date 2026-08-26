import { createMockAdapter } from "./adapters/mock-adapter.js";
import {
  createProviderRun,
  ProviderRunStatus,
  transitionProviderRun,
} from "./core/provider-run.js";
import { createChromeConversationStore } from "./storage/conversation-store.js";

const adapters = new Map([
  ["mock-a", createMockAdapter({
    id: "mock-a",
    label: "Mock Atlas",
    responseFactory: (prompt) => `Atlas 保留原文：\n\n${prompt}`,
  })],
  ["mock-b", createMockAdapter({
    id: "mock-b",
    label: "Mock Beacon",
    responseFactory: (prompt) => `Beacon 保留原文：\n\n${prompt}`,
  })],
]);

const store = createChromeConversationStore();
const promptInput = document.querySelector("#prompt");
const submitButton = document.querySelector("#submit");
const clearButton = document.querySelector("#clear-history");
const errorElement = document.querySelector("#form-error");
const resultsElement = document.querySelector("#results");
const resultTemplate = document.querySelector("#result-template");

function selectedProviderIds() {
  return [...document.querySelectorAll('input[name="provider"]:checked')].map(
    (input) => input.value,
  );
}

function renderRecord(record) {
  const fragment = resultTemplate.content.cloneNode(true);
  fragment.querySelector(".provider-name").textContent = record.providerLabel;
  fragment.querySelector(".timestamp").textContent = new Date(record.capturedAt).toLocaleString();
  fragment.querySelector(".response-text").textContent = record.rawText;
  const status = fragment.querySelector(".status");
  status.textContent = "已完成";
  status.dataset.status = "completed";
  resultsElement.prepend(fragment);
}

function renderFailure(providerLabel, message) {
  const fragment = resultTemplate.content.cloneNode(true);
  fragment.querySelector(".provider-name").textContent = providerLabel;
  fragment.querySelector(".timestamp").textContent = new Date().toLocaleString();
  fragment.querySelector(".response-text").textContent = message;
  const status = fragment.querySelector(".status");
  status.textContent = "失败";
  status.dataset.status = "failed";
  resultsElement.prepend(fragment);
}

async function submitToProvider(adapter, prompt) {
  let run = createProviderRun({
    id: crypto.randomUUID(),
    providerId: adapter.id,
    prompt,
  });

  try {
    run = transitionProviderRun(run, ProviderRunStatus.RUNNING);
    const response = await adapter.submit({ prompt });
    await store.append(response);
    run = transitionProviderRun(run, ProviderRunStatus.COMPLETED, { response });
    renderRecord(run.response);
  } catch (error) {
    run = transitionProviderRun(run, ProviderRunStatus.FAILED, {
      error: error instanceof Error ? error.message : String(error),
    });
    renderFailure(adapter.label, run.error);
  }
}

async function handleSubmit() {
  const prompt = promptInput.value;
  const providerIds = selectedProviderIds();

  errorElement.hidden = true;
  if (!prompt.trim()) {
    errorElement.textContent = "请先输入问题。";
    errorElement.hidden = false;
    promptInput.focus();
    return;
  }

  if (providerIds.length === 0) {
    errorElement.textContent = "请至少选择一个平台。";
    errorElement.hidden = false;
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "正在分别发送…";
  await Promise.all(providerIds.map((providerId) => submitToProvider(adapters.get(providerId), prompt)));
  submitButton.disabled = false;
  submitButton.textContent = "分别发送";
}

async function loadHistory() {
  const records = await store.list();
  for (const record of records) renderRecord(record);
}

submitButton.addEventListener("click", handleSubmit);
clearButton.addEventListener("click", async () => {
  await store.clear();
  resultsElement.replaceChildren();
});

await loadHistory();
