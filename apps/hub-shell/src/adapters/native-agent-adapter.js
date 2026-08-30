import { createImmutableResponse } from "../core/response-record.js";

export function createNativeAgentResponse({ providerId, providerLabel, promptText, rawText, modelId = null }) {
  if (!providerId || !providerLabel || !promptText?.trim()) {
    throw new TypeError("Native agent response identity is incomplete");
  }
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new TypeError("Native agent returned an empty response");
  }

  return createImmutableResponse({
    id: crypto.randomUUID(),
    providerId,
    providerLabel,
    modelId,
    promptText,
    rawText,
    capturedAt: new Date().toISOString(),
    sourceUrl: null,
    captureVersion: "native-agent-v1",
  });
}
