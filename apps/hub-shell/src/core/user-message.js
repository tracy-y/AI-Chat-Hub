export function createUserMessage({ text, promptText, providers, createdAt }) {
  if (!text?.trim() || !promptText?.trim() || !providers?.length) {
    throw new TypeError("User message is incomplete");
  }

  return Object.freeze({
    id: crypto.randomUUID(),
    kind: "user",
    text,
    promptText,
    providers: Object.freeze([...providers]),
    createdAt: createdAt ?? new Date().toISOString(),
  });
}
