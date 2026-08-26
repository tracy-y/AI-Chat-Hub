import test from "node:test";
import assert from "node:assert/strict";
import { createMockAdapter } from "../../apps/hub-shell/src/adapters/mock-adapter.js";

test("mock adapters preserve responseFactory output exactly", async () => {
  const expected = "Line 1\n\n- item\n- café 🐈";
  const adapter = createMockAdapter({
    id: "mock-exact",
    label: "Mock Exact",
    delayMs: 0,
    responseFactory: () => expected,
  });

  const response = await adapter.submit({ prompt: "question" });

  assert.equal(response.rawText, expected);
  assert.equal(response.providerId, "mock-exact");
  assert.equal(response.captureVersion, "mock-v1");
});

test("mock adapters reject empty prompts", async () => {
  const adapter = createMockAdapter({ id: "mock", label: "Mock", delayMs: 0 });
  await assert.rejects(() => adapter.submit({ prompt: "   " }), /non-empty prompt/);
});
