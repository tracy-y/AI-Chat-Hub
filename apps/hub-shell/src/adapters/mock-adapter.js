import { createImmutableResponse } from "../core/response-record.js";

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("The provider run was cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}

export function createMockAdapter({
  id,
  label,
  delayMs = 350,
  responseFactory = (prompt) => `原始 Mock 回复：${prompt}`,
}) {
  if (!id || !label) {
    throw new TypeError("Mock adapter id and label are required");
  }

  return Object.freeze({
    id,
    label,
    async submit({ prompt, signal }) {
      if (!prompt?.trim()) {
        throw new TypeError("A non-empty prompt is required");
      }

      await wait(delayMs, signal);
      return createImmutableResponse({
        id: crypto.randomUUID(),
        providerId: id,
        providerLabel: label,
        rawText: responseFactory(prompt),
        capturedAt: new Date().toISOString(),
        sourceUrl: null,
        captureVersion: "mock-v1",
      });
    },
  });
}
