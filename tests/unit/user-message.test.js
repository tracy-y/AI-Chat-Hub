import test from "node:test";
import assert from "node:assert/strict";
import { createUserMessage } from "../../apps/hub-shell/src/core/user-message.js";

test("user message preserves displayed text and routed prompt separately", () => {
  const message = createUserMessage({
    text: "@codex  原始问题",
    promptText: "原始问题",
    providers: ["codex"],
    attachments: [{ id: "file-1", name: "notes.md", size: 12, type: "text/markdown" }],
  });

  assert.equal(message.text, "@codex  原始问题");
  assert.equal(message.promptText, "原始问题");
  assert.deepEqual(message.providers, ["codex"]);
  assert.equal(Object.isFrozen(message.providers), true);
  assert.deepEqual(message.attachments[0], { id: "file-1", name: "notes.md", size: 12, type: "text/markdown" });
  assert.equal(Object.isFrozen(message.attachments[0]), true);
});
