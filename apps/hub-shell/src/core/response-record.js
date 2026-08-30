export function createImmutableResponse({
  id,
  providerId,
  providerLabel,
  modelId = null,
  promptText = null,
  rawText,
  capturedAt,
  sourceUrl = null,
  captureVersion,
}) {
  if (!id || !providerId || !providerLabel || typeof rawText !== "string") {
    throw new TypeError("Response identity, provider, and rawText are required");
  }
  if (modelId !== null && (typeof modelId !== "string" || !modelId.trim() || modelId.length > 120)) {
    throw new TypeError("Response modelId must be a short non-empty string or null");
  }

  return Object.freeze({
    id,
    providerId,
    providerLabel,
    modelId,
    promptText,
    rawText,
    capturedAt: capturedAt ?? new Date().toISOString(),
    sourceUrl,
    captureVersion: captureVersion ?? "unknown",
  });
}
