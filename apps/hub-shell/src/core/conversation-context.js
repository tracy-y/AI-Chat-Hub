const MAX_CONTEXT_CHARACTERS = 30_000;
const MAX_CONTEXT_MESSAGES = 20;

function recordToLine(record) {
  if (record.kind === "user" && typeof record.text === "string") {
    return `用户：${record.promptText ?? record.text}`;
  }
  if (typeof record.rawText === "string") {
    return `${record.providerLabel ?? record.providerId ?? "Agent"}：${record.rawText}`;
  }
  return null;
}

export function buildProviderPrompt(records, currentPrompt) {
  const lines = records
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(recordToLine)
    .filter(Boolean);

  if (lines.length === 0) return currentPrompt;

  let context = lines.join("\n\n");
  if (context.length > MAX_CONTEXT_CHARACTERS) {
    context = context.slice(-MAX_CONTEXT_CHARACTERS);
  }

  return [
    "以下是 AI Chat Hub 当前窗口的历史记录，仅作为对话上下文。不同 Agent 的内容均按来源标注。",
    "--- 历史记录开始 ---",
    context,
    "--- 历史记录结束 ---",
    "请直接回答下面这条最新用户消息：",
    currentPrompt,
  ].join("\n\n");
}
