import test from "node:test";
import assert from "node:assert/strict";
import {
  createProviderRun,
  ProviderRunStatus,
  transitionProviderRun,
} from "../../apps/hub-shell/src/core/provider-run.js";
import { createImmutableResponse } from "../../apps/hub-shell/src/core/response-record.js";

test("provider runs only allow explicit state transitions", () => {
  const queued = createProviderRun({
    id: "run-1",
    providerId: "mock-a",
    prompt: "Keep this exact",
    createdAt: "2026-08-26T00:00:00.000Z",
  });
  const running = transitionProviderRun(queued, ProviderRunStatus.RUNNING);

  assert.equal(running.status, ProviderRunStatus.RUNNING);
  assert.throws(
    () => transitionProviderRun(running, ProviderRunStatus.QUEUED),
    /Invalid provider run transition/,
  );
});

test("completed runs require an immutable response", () => {
  const running = transitionProviderRun(
    createProviderRun({ id: "run-2", providerId: "mock-a", prompt: "Hello" }),
    ProviderRunStatus.RUNNING,
  );
  const response = createImmutableResponse({
    id: "response-1",
    providerId: "mock-a",
    providerLabel: "Mock Atlas",
    rawText: "Exact **Markdown**\n\n```js\nconst a = 1;\n```",
    capturedAt: "2026-08-26T00:00:00.000Z",
    captureVersion: "test-v1",
  });
  const completed = transitionProviderRun(running, ProviderRunStatus.COMPLETED, { response });

  assert.equal(completed.response.rawText, response.rawText);
  assert.equal(Object.isFrozen(completed.response), true);
  assert.throws(() => { completed.response.rawText = "rewritten"; }, TypeError);
});

test("running provider failures require a visible error", () => {
  const running = transitionProviderRun(
    createProviderRun({ id: "run-3", providerId: "mock-b", prompt: "Hello" }),
    ProviderRunStatus.RUNNING,
  );
  const failed = transitionProviderRun(running, ProviderRunStatus.FAILED, {
    error: "Local storage failed",
  });

  assert.equal(failed.status, ProviderRunStatus.FAILED);
  assert.equal(failed.error, "Local storage failed");
  assert.throws(
    () => transitionProviderRun(running, ProviderRunStatus.FAILED),
    /requires an error/,
  );
});
