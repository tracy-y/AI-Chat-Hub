#!/usr/bin/env node
import { askSelectedProviders, listProviderAvailability, PROVIDER_IDS } from "./src/providers.mjs";
import { createNativeMessageDecoder, encodeNativeMessage } from "./src/native-messaging.mjs";
import {
  CONFIGURABLE_PROVIDER_IDS,
  MAX_MODEL_ID_CHARACTERS,
  MAX_PROVIDER_INSTRUCTION_CHARACTERS,
  readAllProviderSettings,
  readProviderSettings,
  writeProviderSettings,
} from "./src/provider-settings.mjs";
import {
  addProviderInstructionsToPrompt,
  addUserInstructionsToPrompt,
  MAX_INSTRUCTION_CHARACTERS,
  readUserInstructions,
  writeUserInstructions,
} from "./src/user-instructions.mjs";

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

  if (message?.type === "providers:list") {
    const providers = await listProviderAvailability();
    send({ id, type: "providers", providers });
    return;
  }

  if (message?.type === "provider-settings:get") {
    const settings = await readAllProviderSettings();
    send({
      id,
      type: "providerSettings",
      settings,
      maxInstructionCharacters: MAX_PROVIDER_INSTRUCTION_CHARACTERS,
      maxModelCharacters: MAX_MODEL_ID_CHARACTERS,
    });
    return;
  }

  if (message?.type === "provider-settings:set") {
    if (!CONFIGURABLE_PROVIDER_IDS.includes(message.providerId)
      || typeof message.model !== "string"
      || typeof message.instruction !== "string") {
      send({ id, type: "error", error: "Invalid provider settings" });
      return;
    }
    const settings = await writeProviderSettings(message.providerId, {
      model: message.model,
      instruction: message.instruction,
    });
    send({ id, type: "providerSettingsSaved", settings });
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
  if (providers.length === 0 || providers.some((providerId) => !PROVIDER_IDS.includes(providerId))) {
    send({ id, type: "error", error: "Invalid provider selection" });
    return;
  }

  const availability = await listProviderAvailability();
  const availableIds = new Set(availability.filter((provider) => provider.available).map((provider) => provider.id));
  if (providers.some((providerId) => !availableIds.has(providerId))) {
    send({ id, type: "error", error: "Selected Agent is not installed or not logged in" });
    return;
  }

  send({ id, type: "started", providers });
  const instructions = await readUserInstructions();
  const sharedPrompt = addUserInstructionsToPrompt(message.prompt, instructions);
  const labels = new Map(availability.map((provider) => [provider.id, provider.label]));
  const providerOptions = Object.fromEntries(await Promise.all(providers.map(async (providerId) => {
    const settings = await readProviderSettings(providerId);
    return [providerId, {
      model: settings.model,
      prompt: addProviderInstructionsToPrompt(sharedPrompt, settings.instruction, labels.get(providerId) ?? providerId),
    }];
  })));
  const results = await askSelectedProviders(sharedPrompt, providers, providerOptions);
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
