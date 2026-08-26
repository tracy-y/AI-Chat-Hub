import test from "node:test";
import assert from "node:assert/strict";
import { createUserMessage } from "../../apps/hub-shell/src/core/user-message.js";

test("user message preserves displayed text and routed prompt separately", () => {
  const message = createUserMessage({
    text: "@codex  原始问题",
    promptText: "原始问题",
    providers: ["codex"],
  });

  assert.equal(message.text, "@codex  原始问题");
  assert.equal(message.promptText, "原始问题");
  assert.deepEqual(message.providers, ["codex"]);
  assert.equal(Object.isFrozen(message.providers), true);
});
