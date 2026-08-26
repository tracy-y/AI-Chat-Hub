#!/usr/bin/env node
import { askSelectedProviders } from "./src/providers.mjs";
import { createNativeMessageDecoder, encodeNativeMessage } from "./src/native-messaging.mjs";
import { addUserInstructionsToPrompt, MAX_INSTRUCTION_CHARACTERS, readUserInstructions, writeUserInstructions } from "./src/user-instructions.mjs";

const MAX_PROMPT_CHARACTERS = 100_000;
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

  if (message?.type === "instructions:get") {
    const content = await readUserInstructions();
    send({ id, type: "instructions", content, maxCharacters: MAX_INSTRUCTION_CHARACTERS });
    return;
  }

  if (message?.type === "instructions:set") {
    if (typeof message.content !== "string" || message.content.length > MAX_INSTRUCTION_CHARACTERS) {
      send({ id, type: "error", error: "Invalid instruction content" });
      return;
    }
    await writeUserInstructions(message.content);
    send({ id, type: "instructionsSaved", characters: message.content.length });
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

  const providers = Array.isArray(message.providers) ? [...new Set(message.providers)] : ["codex", "claude"];
  if (providers.length === 0 || providers.some((providerId) => !["codex", "claude"].includes(providerId))) {
    send({ id, type: "error", error: "Invalid provider selection" });
    return;
  }

  send({ id, type: "started", providers });
  const instructions = await readUserInstructions();
  const providerPrompt = addUserInstructionsToPrompt(message.prompt, instructions);
  const results = await askSelectedProviders(providerPrompt, providers);
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
