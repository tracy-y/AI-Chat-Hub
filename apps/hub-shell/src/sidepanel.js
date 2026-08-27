import { createManualRelayAdapter } from "./adapters/manual-relay-adapter.js";
import { createNativeAgentResponse } from "./adapters/native-agent-adapter.js";
import { buildProviderPrompt } from "./core/conversation-context.js";
import { applyMentionSelection, findMentionQuery } from "./core/mention-autocomplete.js";
import { parseMentionRouting } from "./core/mention-routing.js";
import { addTextAttachmentsToPrompt, attachmentMetadata, readTextAttachments } from "./core/text-attachments.js";
import { createUserMessage } from "./core/user-message.js";
import {
  askNativeCompanion,
  getNativeInstructions,
  getNativeProviders,
  getNativeProviderSettings,
  saveNativeInstructions,
  saveNativeProviderSettings,
} from "./native-client.js";
import { createChromeChatSessionStore } from "./storage/chat-session-store.js";

const PROVIDER_LABELS = Object.freeze({
  codex: "Codex（ChatGPT 订阅）",
  claude: "Claude Agent（Claude 订阅）",
  gemini: "Gemini via Antigravity（Google 订阅）",
  grok: "Grok Build（xAI 账号）",
  qwen: "Qwen 网页（待接入）",
  deepseek: "DeepSeek 网页（待接入）",
});
const PROVIDER_SHORT_LABELS = Object.freeze({ codex: "Codex", claude: "Claude", gemini: "Gemini", grok: "Grok", qwen: "Qwen", deepseek: "DeepSeek" });
const PROVIDER_AVATARS = Object.freeze({ codex: "G", claude: "C", gemini: "M", grok: "X", qwen: "Q", deepseek: "D" });
const CUSTOM_MODEL_VALUE = "__custom__";
const PROVIDER_SETTING_ORDER = Object.freeze(["codex", "claude", "gemini", "grok", "qwen", "deepseek"]);
const PROVIDER_MODEL_CHOICES = Object.freeze({
  codex: [{ value: "", label: "官方默认" }],
  claude: [
    { value: "", label: "官方默认" },
    { value: "sonnet", label: "Sonnet" },
    { value: "opus", label: "Opus" },
  ],
  gemini: [
    { value: "gemini-3.7-flash-medium", label: "Gemini 3.7 Flash · Medium（已验证）" },
    { value: "gemini-3.7-flash-high", label: "Gemini 3.7 Flash · High" },
    { value: "gemini-3.7-flash-low", label: "Gemini 3.7 Flash · Low" },
  ],
  grok: [
    { value: "", label: "官方默认 · Grok 4.6（已验证）" },
    { value: "grok-4.6", label: "Grok 4.6" },
  ],
  qwen: [{ value: "", label: "官网当前模型" }],
  deepseek: [{ value: "", label: "官网当前模型" }],
});
const adapters = new Map([
  ["chatgpt", createManualRelayAdapter({ id: "chatgpt", label: "ChatGPT 网页", officialUrl: "https://chatgpt.com/", allowedHosts: ["chatgpt.com"] })],
  ["claude", createManualRelayAdapter({ id: "claude", label: "Claude 网页", officialUrl: "https://claude.ai/", allowedHosts: ["claude.ai"] })],
]);
const store = createChromeChatSessionStore();
const timeline = document.querySelector("#timeline");
const emptyState = document.querySelector("#empty-state");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send-message");
const attachmentInput = document.querySelector("#attachment-input");
const attachFilesButton = document.querySelector("#attach-files");
const pendingAttachmentsElement = document.querySelector("#pending-attachments");
const newChatButton = document.querySelector("#new-chat");
const errorElement = document.querySelector("#form-error");
const connectionStatus = document.querySelector("#connection-status");
const contextModeSelect = document.querySelector("#context-mode");
const userTemplate = document.querySelector("#user-message-template");
const agentTemplate = document.querySelector("#agent-message-template");
const mentionPicker = document.querySelector("#mention-picker");
const pickerOptions = [...mentionPicker.querySelectorAll("[data-agent-token]")];
const sessionList = document.querySelector("#session-list");
const historyCount = document.querySelector("#history-count");
const sessionItemTemplate = document.querySelector("#session-item-template");
const instructionInput = document.querySelector("#user-instructions");
const instructionCount = document.querySelector("#instruction-count");
const instructionStatus = document.querySelector("#instruction-status");
const saveInstructionsButton = document.querySelector("#save-instructions");
const agentSettingsList = document.querySelector("#agent-settings-list");
const agentSettingsStatus = document.querySelector("#agent-settings-status");
const agentSettingsTemplate = document.querySelector("#agent-settings-template");
let sessionState = await store.load();
let conversationRecords = getActiveSession().records;
let activeMention = null;
let visiblePickerOptions = [];
let activePickerIndex = 0;
let requestRunning = false;
let availableProviderIds = ["codex", "claude"];
let nativeProviders = [];
let pendingAttachments = [];

function getActiveSession() {
  return sessionState.sessions.find((session) => session.id === sessionState.activeSessionId);
}

function syncActiveSessionControls() {
  contextModeSelect.value = getActiveSession().contextMode ?? "simple";
  contextModeSelect.disabled = requestRunning;
}

function setError(message = "") {
  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function updateInstructionCount() {
  instructionCount.textContent = `${instructionInput.value.length} / ${instructionInput.maxLength}`;
}

async function loadInstructions() {
  try {
    const result = await getNativeInstructions();
    instructionInput.value = result.content;
    instructionStatus.textContent = result.content ? "已从本机 README.md 载入。" : "尚未保存长期说明。";
  } catch (error) {
    instructionStatus.textContent = error instanceof Error ? error.message : String(error);
    instructionStatus.dataset.status = "failed";
  }
  updateInstructionCount();
}

async function loadProviders() {
  try {
    const providers = await getNativeProviders();
    nativeProviders = providers;
    availableProviderIds = providers.filter((provider) => provider.available).map((provider) => provider.id);
    const installedCount = providers.filter((provider) => provider.installed).length;
    connectionStatus.textContent = `${availableProviderIds.length} 个 Agent 可用 · ${installedCount} 个已安装`;
  } catch {
    availableProviderIds = ["codex", "claude"];
    connectionStatus.textContent = "本机直连";
  }

  for (const option of pickerOptions) {
    const providerId = option.dataset.providerId;
    if (!providerId) continue;
    option.dataset.available = String(availableProviderIds.includes(providerId));
    option.hidden = option.dataset.available !== "true";
  }
  const allDescription = mentionPicker.querySelector("[data-all-description]");
  if (allDescription) allDescription.textContent = `同时询问 ${availableProviderIds.length} 个可用 Agent`;
}

function providerStateLabel(providerId) {
  const provider = nativeProviders.find((candidate) => candidate.id === providerId);
  if (provider?.available) return "当前可用";
  if (provider?.installed) return "已安装 · 需要登录";
  if (["qwen", "deepseek"].includes(providerId)) return "官方网页 Bridge 待接入";
  return "本机尚未安装";
}

function updateAgentInstructionCount(card) {
  const input = card.querySelector(".agent-instruction");
  card.querySelector(".agent-instruction-count").textContent = `${input.value.length} / ${input.maxLength}`;
}

function updateCustomModelVisibility(card) {
  const isCustom = card.querySelector(".agent-model-select").value === CUSTOM_MODEL_VALUE;
  card.querySelector(".custom-model-label").hidden = !isCustom;
}

function createAgentSettingCard(settings, limits) {
  const fragment = agentSettingsTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".agent-setting-card");
  const providerId = settings.providerId;
  card.dataset.providerId = providerId;
  card.querySelector(".agent-setting-avatar").textContent = PROVIDER_AVATARS[providerId] ?? "@";
  card.querySelector(".agent-setting-name").textContent = PROVIDER_SHORT_LABELS[providerId] ?? providerId;
  card.querySelector(".agent-setting-state").textContent = providerStateLabel(providerId);

  const select = card.querySelector(".agent-model-select");
  const choices = PROVIDER_MODEL_CHOICES[providerId] ?? [{ value: "", label: "官方默认" }];
  for (const choice of [...choices, { value: CUSTOM_MODEL_VALUE, label: "自定义模型 ID…" }]) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  }
  const customModelInput = card.querySelector(".agent-custom-model");
  customModelInput.maxLength = limits.maxModelCharacters;
  if (choices.some((choice) => choice.value === settings.model)) {
    select.value = settings.model;
  } else if (settings.model) {
    select.value = CUSTOM_MODEL_VALUE;
    customModelInput.value = settings.model;
  } else {
    select.value = choices[0].value;
  }

  const instructionInputForAgent = card.querySelector(".agent-instruction");
  instructionInputForAgent.maxLength = limits.maxInstructionCharacters;
  instructionInputForAgent.value = settings.instruction;
  select.addEventListener("change", () => updateCustomModelVisibility(card));
  instructionInputForAgent.addEventListener("input", () => updateAgentInstructionCount(card));
  card.querySelector(".save-agent-setting").addEventListener("click", () => saveAgentSetting(card));
  updateCustomModelVisibility(card);
  updateAgentInstructionCount(card);
  return card;
}

async function loadAgentSettings() {
  agentSettingsList.replaceChildren();
  agentSettingsStatus.dataset.status = "";
  agentSettingsStatus.textContent = "正在读取本机设置…";
  try {
    const result = await getNativeProviderSettings();
    const byProvider = new Map(result.settings.map((settings) => [settings.providerId, settings]));
    for (const providerId of PROVIDER_SETTING_ORDER) {
      const settings = byProvider.get(providerId) ?? { providerId, model: "", instruction: "" };
      agentSettingsList.append(createAgentSettingCard(settings, {
        maxInstructionCharacters: result.maxInstructionCharacters ?? 10_000,
        maxModelCharacters: result.maxModelCharacters ?? 120,
      }));
    }
    agentSettingsStatus.textContent = "设置已从 Mac 本地载入。";
  } catch (error) {
    agentSettingsStatus.textContent = error instanceof Error ? error.message : String(error);
    agentSettingsStatus.dataset.status = "failed";
  }
}

async function saveAgentSetting(card) {
  const providerId = card.dataset.providerId;
  const select = card.querySelector(".agent-model-select");
  const customModelInput = card.querySelector(".agent-custom-model");
  const instructionInputForAgent = card.querySelector(".agent-instruction");
  const saveButton = card.querySelector(".save-agent-setting");
  const status = card.querySelector(".agent-save-status");
  const model = select.value === CUSTOM_MODEL_VALUE ? customModelInput.value.trim() : select.value;
  if (select.value === CUSTOM_MODEL_VALUE && !model) {
    status.dataset.status = "failed";
    status.textContent = "请输入模型 ID，或选择官方默认。";
    customModelInput.focus();
    return;
  }
  saveButton.disabled = true;
  status.dataset.status = "";
  status.textContent = "正在保存…";
  try {
    await saveNativeProviderSettings(providerId, model, instructionInputForAgent.value);
    status.textContent = `已保存 ${PROVIDER_SHORT_LABELS[providerId] ?? providerId} 的本地设置。`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.dataset.status = "failed";
  } finally {
    saveButton.disabled = false;
  }
}

async function saveInstructions() {
  saveInstructionsButton.disabled = true;
  instructionStatus.dataset.status = "";
  instructionStatus.textContent = "正在保存…";
  try {
    await saveNativeInstructions(instructionInput.value);
    instructionStatus.textContent = "已保存到本机 instruction/README.md，之后的 Agent 请求会参考它。";
  } catch (error) {
    instructionStatus.textContent = error instanceof Error ? error.message : String(error);
    instructionStatus.dataset.status = "failed";
  } finally {
    saveInstructionsButton.disabled = false;
  }
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollToLatest() {
  timeline.scrollTop = timeline.scrollHeight;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}

function renderPendingAttachments() {
  pendingAttachmentsElement.replaceChildren();
  pendingAttachmentsElement.hidden = pendingAttachments.length === 0;
  for (const attachment of pendingAttachments) {
    const chip = document.createElement("span");
    chip.className = "attachment-chip";
    const label = document.createElement("span");
    label.textContent = `${attachment.name} · ${formatFileSize(attachment.size)}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `移除 ${attachment.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((candidate) => candidate.id !== attachment.id);
      renderPendingAttachments();
    });
    chip.append(label, remove);
    pendingAttachmentsElement.append(chip);
  }
}

async function selectAttachments() {
  try {
    const selected = await readTextAttachments(attachmentInput.files);
    pendingAttachments = [...pendingAttachments, ...selected];
    pendingAttachments = await readTextAttachments(pendingAttachments.map((attachment) => ({
      ...attachment,
      text: async () => attachment.content,
    })));
    setError("");
    renderPendingAttachments();
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    attachmentInput.value = "";
  }
}

function createUserElement(record) {
  const fragment = userTemplate.content.cloneNode(true);
  const element = fragment.querySelector(".message");
  element.querySelector("time").textContent = formatTime(record.createdAt);
  element.querySelector(".message-text").textContent = record.promptText ?? record.text;
  const attachmentList = element.querySelector(".message-attachments");
  if (record.attachments?.length) {
    attachmentList.hidden = false;
    for (const attachment of record.attachments) {
      const chip = document.createElement("span");
      chip.className = "attachment-chip attachment-chip-saved";
      chip.textContent = `${attachment.name} · ${formatFileSize(attachment.size)}`;
      attachmentList.append(chip);
    }
  }
  element.querySelector(".message-targets").textContent = `发送给 ${record.providers.map((id) => PROVIDER_SHORT_LABELS[id] ?? id).join("、")}`;
  return element;
}

function createAgentElement(record) {
  const fragment = agentTemplate.content.cloneNode(true);
  const element = fragment.querySelector(".message");
  element.dataset.provider = record.providerId;
  element.querySelector(".agent-avatar").textContent = PROVIDER_AVATARS[record.providerId] ?? "@";
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

function renderTimeline() {
  timeline.replaceChildren(emptyState);
  emptyState.hidden = conversationRecords.length > 0;
  for (const record of conversationRecords) renderRecord(record);
  scrollToLatest();
}

function renderSessionList() {
  sessionList.replaceChildren();
  historyCount.textContent = `${sessionState.sessions.length} 个本地对话`;
  const sessions = [...sessionState.sessions].sort((left, right) => {
    if (left.id === sessionState.activeSessionId) return -1;
    if (right.id === sessionState.activeSessionId) return 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  for (const session of sessions) {
    const fragment = sessionItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".session-item");
    const openButton = item.querySelector(".session-open");
    const deleteButton = item.querySelector(".session-delete");
    const isActive = session.id === sessionState.activeSessionId;
    item.dataset.active = String(isActive);
    openButton.dataset.sessionId = session.id;
    deleteButton.dataset.deleteSessionId = session.id;
    deleteButton.dataset.sessionTitle = session.title;
    openButton.disabled = requestRunning;
    deleteButton.disabled = requestRunning;
    openButton.querySelector("strong").textContent = session.title;
    const stateLabel = isActive ? " · 当前" : "";
    openButton.querySelector("small").textContent = `${new Date(session.updatedAt).toLocaleString()} · ${session.records.length} 条消息${stateLabel}`;
    sessionList.append(item);
  }
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
  sessionState = await store.append(record);
  conversationRecords = getActiveSession().records;
  renderSessionList();
}

async function sendMessage() {
  let route;
  try {
    route = parseMentionRouting(promptInput.value, availableProviderIds);
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
    attachments: attachmentMetadata(pendingAttachments),
  });
  const attachmentsForRequest = pendingAttachments;
  setError("");
  promptInput.value = "";
  pendingAttachments = [];
  renderPendingAttachments();
  sendButton.disabled = true;
  promptInput.disabled = true;
  attachFilesButton.disabled = true;
  newChatButton.disabled = true;
  requestRunning = true;
  syncActiveSessionControls();
  renderSessionList();
  connectionStatus.textContent = "正在连接…";
  await appendRecord(userMessage);
  renderRecord(userMessage);

  const pending = new Map(route.providers.map((providerId) => [providerId, createPendingElement(providerId)]));
  const currentPrompt = addTextAttachmentsToPrompt(route.prompt, attachmentsForRequest);
  const providerPrompt = buildProviderPrompt(historyBeforeMessage, currentPrompt, getActiveSession().contextMode);

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
    attachFilesButton.disabled = false;
    newChatButton.disabled = false;
    requestRunning = false;
    syncActiveSessionControls();
    renderSessionList();
    promptInput.focus();
    scrollToLatest();
  }
}

function hideMentionPicker() {
  mentionPicker.hidden = true;
  promptInput.setAttribute("aria-expanded", "false");
  activeMention = null;
  visiblePickerOptions = [];
  for (const option of pickerOptions) option.setAttribute("aria-selected", "false");
}

function updatePickerSelection() {
  for (const option of pickerOptions) option.setAttribute("aria-selected", "false");
  for (const [index, option] of visiblePickerOptions.entries()) {
    option.setAttribute("aria-selected", String(index === activePickerIndex));
  }
}

function updateMentionPicker() {
  activeMention = findMentionQuery(promptInput.value, promptInput.selectionStart);
  if (!activeMention) {
    hideMentionPicker();
    return;
  }

  visiblePickerOptions = pickerOptions.filter((option) => {
    const visible = option.dataset.available !== "false" && option.dataset.search.includes(activeMention.query);
    option.hidden = !visible;
    return visible;
  });
  if (visiblePickerOptions.length === 0) {
    hideMentionPicker();
    return;
  }

  activePickerIndex = 0;
  mentionPicker.hidden = false;
  promptInput.setAttribute("aria-expanded", "true");
  updatePickerSelection();
}

function chooseMention(option) {
  if (!activeMention) return;
  const selection = applyMentionSelection(promptInput.value, activeMention, option.dataset.agentToken);
  promptInput.value = selection.text;
  hideMentionPicker();
  promptInput.focus();
  promptInput.setSelectionRange(selection.cursor, selection.cursor);
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

renderTimeline();
renderSessionList();
syncActiveSessionControls();
await loadProviders();
await loadInstructions();
await loadAgentSettings();
sendButton.addEventListener("click", sendMessage);
attachFilesButton.addEventListener("click", () => attachmentInput.click());
attachmentInput.addEventListener("change", selectAttachments);
promptInput.addEventListener("keydown", (event) => {
  if (!mentionPicker.hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      activePickerIndex = (activePickerIndex + direction + visiblePickerOptions.length) % visiblePickerOptions.length;
      updatePickerSelection();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseMention(visiblePickerOptions[activePickerIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hideMentionPicker();
      return;
    }
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!sendButton.disabled) sendMessage();
  }
});
promptInput.addEventListener("input", updateMentionPicker);
promptInput.addEventListener("click", updateMentionPicker);
promptInput.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) updateMentionPicker();
});
promptInput.addEventListener("blur", () => setTimeout(hideMentionPicker, 0));
for (const option of pickerOptions) {
  option.addEventListener("mousedown", (event) => event.preventDefault());
  option.addEventListener("click", () => chooseMention(option));
}
for (const button of document.querySelectorAll(".save-response")) {
  button.addEventListener("click", () => saveManualResponse(button.dataset.providerId));
}
newChatButton.addEventListener("click", async () => {
  if (requestRunning) return;
  sessionState = await store.startNew();
  conversationRecords = getActiveSession().records;
  pendingAttachments = [];
  renderPendingAttachments();
  renderTimeline();
  renderSessionList();
  syncActiveSessionControls();
  connectionStatus.textContent = "本机直连";
  setError("");
  promptInput.focus();
});

sessionList.addEventListener("click", async (event) => {
  if (requestRunning) return;
  const deleteButton = event.target.closest("[data-delete-session-id]");
  if (deleteButton) {
    const confirmed = confirm(`确定永久删除本机对话“${deleteButton.dataset.sessionTitle}”吗？此操作无法撤销。`);
    if (!confirmed) return;
    sessionState = await store.delete(deleteButton.dataset.deleteSessionId);
    conversationRecords = getActiveSession().records;
    renderTimeline();
    renderSessionList();
    syncActiveSessionControls();
    connectionStatus.textContent = "本地对话已删除";
    setError("");
    promptInput.focus();
    return;
  }

  const openButton = event.target.closest("[data-session-id]");
  if (!openButton || openButton.dataset.sessionId === sessionState.activeSessionId) return;
  sessionState = await store.select(openButton.dataset.sessionId);
  conversationRecords = getActiveSession().records;
  pendingAttachments = [];
  renderPendingAttachments();
  renderTimeline();
  renderSessionList();
  syncActiveSessionControls();
  connectionStatus.textContent = "已打开历史对话";
  setError("");
  promptInput.focus();
});

contextModeSelect.addEventListener("change", async () => {
  if (requestRunning) return;
  sessionState = await store.setContextMode(contextModeSelect.value);
  syncActiveSessionControls();
});
instructionInput.addEventListener("input", updateInstructionCount);
saveInstructionsButton.addEventListener("click", saveInstructions);
