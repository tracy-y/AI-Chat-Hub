import test from "node:test";
import assert from "node:assert/strict";
import { createNativeAgentResponse } from "../../apps/hub-shell/src/adapters/native-agent-adapter.js";

test("native agent adapter preserves prompt and answer exactly", () => {
  const record = createNativeAgentResponse({
    providerId: "codex",
    providerLabel: "Codex",
    promptText: "  question\n",
    rawText: "  answer\n\n",
  });

  assert.equal(record.promptText, "  question\n");
  assert.equal(record.rawText, "  answer\n\n");
  assert.equal(record.captureVersion, "native-agent-v1");
  assert.equal(Object.isFrozen(record), true);
});
