#!/usr/bin/env node
import { askSelectedProviders, listProviderAvailability, PROVIDER_IDS } from "./src/providers.mjs";
import { createNativeMessageDecoder, encodeNativeMessage } from "./src/native-messaging.mjs";
import {
  API_PROVIDER_IDS,
  MAX_API_KEY_CHARACTERS,
  readAllApiProviderSettings,
  readApiKey,
  readApiProviderSettings,
  writeApiProviderSettings,
} from "./src/api-provider-settings.mjs";
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

async function currentProviderAvailability() {
  const [providers, apiSettings] = await Promise.all([
    listProviderAvailability(),
    readAllApiProviderSettings(),
  ]);
  const byApiProvider = new Map(apiSettings.map((settings) => [settings.providerId, settings]));
  return providers.map((provider) => {
    const api = byApiProvider.get(provider.id);
    if (!api) return provider;
    return Object.freeze({
      ...provider,
      installed: api.keyConfigured,
      available: api.enabled && api.keyConfigured,
      accessMode: "optional-api",
    });
  });
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
    const providers = await currentProviderAvailability();
    send({ id, type: "providers", providers });
    return;
  }

  if (message?.type === "api-settings:get") {
    const settings = await readAllApiProviderSettings();
    send({ id, type: "apiProviderSettings", settings, maxApiKeyCharacters: MAX_API_KEY_CHARACTERS });
    return;
  }

  if (message?.type === "api-settings:set") {
    if (!API_PROVIDER_IDS.includes(message.providerId)
      || typeof message.enabled !== "boolean"
      || typeof message.region !== "string"
      || typeof message.apiKey !== "string") {
      send({ id, type: "error", error: "Invalid API provider settings" });
      return;
    }
    const settings = await writeApiProviderSettings(message.providerId, {
      enabled: message.enabled,
      region: message.region,
      apiKey: message.apiKey,
    });
    send({ id, type: "apiProviderSettingsSaved", settings });
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

  const availability = await currentProviderAvailability();
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
    const apiSettings = API_PROVIDER_IDS.includes(providerId)
      ? await readApiProviderSettings(providerId)
      : null;
    return [providerId, {
      model: settings.model,
      prompt: addProviderInstructionsToPrompt(sharedPrompt, settings.instruction, labels.get(providerId) ?? providerId),
      ...(apiSettings ? { apiKey: await readApiKey(providerId), region: apiSettings.region } : {}),
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
