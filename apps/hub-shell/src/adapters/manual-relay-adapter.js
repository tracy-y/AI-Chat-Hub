import { createImmutableResponse } from "../core/response-record.js";

function normalizeSourceUrl(sourceUrl, allowedHosts) {
  if (!sourceUrl?.trim()) return null;

  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new TypeError("Official conversation link is not a valid URL");
  }

  if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname)) {
    throw new TypeError("Official conversation link does not match this provider");
  }

  return parsed.toString();
}

export function createManualRelayAdapter({ id, label, officialUrl, allowedHosts }) {
  if (!id || !label || !officialUrl || !allowedHosts?.length) {
    throw new TypeError("Manual relay provider configuration is incomplete");
  }

  return Object.freeze({
    id,
    label,
    officialUrl,
    createResponse({ promptText, rawText, sourceUrl }) {
      if (!promptText?.trim()) {
        throw new TypeError("Copy a non-empty prompt before saving a response");
      }
      if (typeof rawText !== "string" || !rawText.trim()) {
        throw new TypeError("Paste a non-empty official response before saving");
      }

      return createImmutableResponse({
        id: crypto.randomUUID(),
        providerId: id,
        providerLabel: label,
        promptText,
        rawText,
        capturedAt: new Date().toISOString(),
        sourceUrl: normalizeSourceUrl(sourceUrl, allowedHosts),
        captureVersion: "manual-relay-v1",
      });
    },
  });
}
