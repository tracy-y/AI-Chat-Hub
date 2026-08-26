export function createImmutableResponse({
  id,
  providerId,
  providerLabel,
  promptText = null,
  rawText,
  capturedAt,
  sourceUrl = null,
  captureVersion,
}) {
  if (!id || !providerId || !providerLabel || typeof rawText !== "string") {
    throw new TypeError("Response identity, provider, and rawText are required");
  }

  return Object.freeze({
    id,
    providerId,
    providerLabel,
    promptText,
    rawText,
    capturedAt: capturedAt ?? new Date().toISOString(),
    sourceUrl,
    captureVersion: captureVersion ?? "unknown",
  });
}
