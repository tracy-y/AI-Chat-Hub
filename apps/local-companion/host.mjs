#!/usr/bin/env node
import { askAllProviders } from "./src/providers.mjs";
import { createNativeMessageDecoder, encodeNativeMessage } from "./src/native-messaging.mjs";

const MAX_PROMPT_CHARACTERS = 50_000;
let queue = Promise.resolve();

function send(message) {
  process.stdout.write(encodeNativeMessage(message));
}

async function handleMessage(message) {
  const id = typeof message?.id === "string" ? message.id : crypto.randomUUID();

  if (message?.type === "ping") {
    send({ id, type: "pong", version: 1 });
    return;
  }

  if (message?.type !== "chat" || typeof message.prompt !== "string") {
    send({ id, type: "error", error: "Invalid request" });
    return;
  }
  if (!message.prompt.trim()) {
    send({ id, type: "error", error: "Prompt cannot be empty" });
    return;
  }
  if (message.prompt.length > MAX_PROMPT_CHARACTERS) {
    send({ id, type: "error", error: "Prompt is too long" });
    return;
  }

  send({ id, type: "started", providers: ["codex", "claude"] });
  const results = await askAllProviders(message.prompt);
  send({ id, type: "chatResult", results });
}

const decode = createNativeMessageDecoder((message) => {
  queue = queue.then(() => handleMessage(message)).catch(() => {
    send({ id: message?.id, type: "error", error: "Local companion failed" });
  });
});

process.stdin.on("data", (chunk) => {
  try {
    decode(chunk);
  } catch {
    send({ type: "error", error: "Malformed native message" });
    process.exitCode = 1;
  }
});
