export function createUserMessage({ text, promptText, providers, attachments = [], createdAt }) {
  if (!text?.trim() || !promptText?.trim() || !providers?.length) {
    throw new TypeError("User message is incomplete");
  }

  return Object.freeze({
    id: crypto.randomUUID(),
    kind: "user",
    text,
    promptText,
    providers: Object.freeze([...providers]),
    attachments: Object.freeze(attachments.map((attachment) => Object.freeze({ ...attachment }))),
    createdAt: createdAt ?? new Date().toISOString(),
  });
}
