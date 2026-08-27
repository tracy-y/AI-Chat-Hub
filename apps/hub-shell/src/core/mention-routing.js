const PROVIDER_ORDER = ["codex", "claude", "gemini", "grok", "qwen", "deepseek"];
const ALIASES = new Map([
  ["codex", "codex"],
  ["gpt", "codex"],
  ["chatgpt", "codex"],
  ["claude", "claude"],
  ["gemini", "gemini"],
  ["grok", "grok"],
  ["qwen", "qwen"],
  ["deepseek", "deepseek"],
]);
const MENTION_PATTERN = /(^|\s)@(codex|gpt|chatgpt|claude|gemini|grok|qwen|deepseek|all)\b/gi;

export function parseMentionRouting(input, availableProviderIds = PROVIDER_ORDER) {
  if (typeof input !== "string") throw new TypeError("Message must be text");
  const available = new Set(availableProviderIds);
  const providerOrder = PROVIDER_ORDER.filter((providerId) => available.has(providerId));
  if (providerOrder.length === 0) throw new TypeError("没有已登录的 Agent");

  const selected = new Set();
  let sawAll = false;
  const prompt = input.replace(MENTION_PATTERN, (match, prefix, alias) => {
    if (alias.toLowerCase() === "all") sawAll = true;
    else selected.add(ALIASES.get(alias.toLowerCase()));
    return prefix;
  }).trim();

  if (!prompt) throw new TypeError("@Agent 后面还需要输入问题");
  const unavailable = [...selected].find((providerId) => !available.has(providerId));
  if (unavailable) throw new TypeError(`@${unavailable} 当前未安装或未登录`);
  const providers = sawAll || selected.size === 0
    ? providerOrder
    : providerOrder.filter((providerId) => selected.has(providerId));

  return Object.freeze({
    prompt,
    providers: Object.freeze([...providers]),
    explicit: sawAll || selected.size > 0,
  });
}
