const PROVIDER_ORDER = ["codex", "claude"];
const ALIASES = new Map([
  ["codex", "codex"],
  ["gpt", "codex"],
  ["chatgpt", "codex"],
  ["claude", "claude"],
]);
const MENTION_PATTERN = /(^|\s)@(codex|gpt|chatgpt|claude|all)\b/gi;

export function parseMentionRouting(input) {
  if (typeof input !== "string") throw new TypeError("Message must be text");

  const selected = new Set();
  let sawAll = false;
  const prompt = input.replace(MENTION_PATTERN, (match, prefix, alias) => {
    if (alias.toLowerCase() === "all") sawAll = true;
    else selected.add(ALIASES.get(alias.toLowerCase()));
    return prefix;
  }).trim();

  if (!prompt) throw new TypeError("@Agent 后面还需要输入问题");
  const providers = sawAll || selected.size === 0
    ? PROVIDER_ORDER
    : PROVIDER_ORDER.filter((providerId) => selected.has(providerId));

  return Object.freeze({
    prompt,
    providers: Object.freeze([...providers]),
    explicit: sawAll || selected.size > 0,
  });
}
