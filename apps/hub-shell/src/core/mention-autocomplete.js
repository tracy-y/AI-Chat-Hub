export function findMentionQuery(text, cursor = text.length) {
  if (typeof text !== "string" || !Number.isInteger(cursor)) return null;
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const match = text.slice(0, safeCursor).match(/(^|\s)@([a-z]*)$/i);
  if (!match) return null;

  return Object.freeze({
    start: safeCursor - match[2].length - 1,
    end: safeCursor,
    query: match[2].toLowerCase(),
  });
}

export function applyMentionSelection(text, mention, token) {
  if (!mention || !/^@(codex|claude|gemini|grok|qwen|deepseek|all)$/.test(token)) {
    throw new TypeError("Mention selection is invalid");
  }

  const before = text.slice(0, mention.start);
  const after = text.slice(mention.end).replace(/^\s+/, "");
  const inserted = `${token} `;
  return Object.freeze({
    text: `${before}${inserted}${after}`,
    cursor: before.length + inserted.length,
  });
}
