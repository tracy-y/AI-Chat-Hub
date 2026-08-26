const MAX_PROVIDER_PROMPT_CHARACTERS = 90_000;

export const CONTEXT_POLICIES = Object.freeze({
  simple: Object.freeze({ label: "简单聊天", maxMessages: 20, maxCharacters: 16_000 }),
  standard: Object.freeze({ label: "一般聊天", maxMessages: 50, maxCharacters: 40_000 }),
  deep: Object.freeze({ label: "深度策划", maxMessages: 100, maxCharacters: 70_000 }),
});

function recordToLine(record) {
  if (record.kind === "user" && typeof record.text === "string") {
    return `用户：${record.promptText ?? record.text}`;
  }
  if (typeof record.rawText === "string") {
    return `${record.providerLabel ?? record.providerId ?? "Agent"}：${record.rawText}`;
  }
  return null;
}

export function buildProviderPrompt(records, currentPrompt, mode = "simple") {
  const policy = CONTEXT_POLICIES[mode];
  if (!policy) throw new TypeError("Unknown context mode");
  const lines = records
    .slice(-policy.maxMessages)
    .map(recordToLine)
    .filter(Boolean);

  if (lines.length === 0) return currentPrompt;

  const frame = [
    "以下是 AI Chat Hub 当前窗口的历史记录，仅作为对话上下文。不同 Agent 的内容均按来源标注。",
    "--- 历史记录开始 ---",
    "",
    "--- 历史记录结束 ---",
    "请直接回答下面这条最新用户消息：",
    currentPrompt,
  ];
  const fixedCharacters = frame.join("\n\n").length;
  const availableCharacters = Math.max(0, MAX_PROVIDER_PROMPT_CHARACTERS - fixedCharacters);
  const contextLimit = Math.min(policy.maxCharacters, availableCharacters);
  if (contextLimit === 0) return currentPrompt;

  let context = lines.join("\n\n");
  if (context.length > contextLimit) context = context.slice(-contextLimit);
  frame[2] = context;
  return frame.join("\n\n");
}
