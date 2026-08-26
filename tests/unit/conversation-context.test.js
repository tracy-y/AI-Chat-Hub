import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderPrompt } from "../../apps/hub-shell/src/core/conversation-context.js";

test("first message is sent without a context wrapper", () => {
  assert.equal(buildProviderPrompt([], "原始问题"), "原始问题");
});

test("follow-up includes the unified timeline with source labels", () => {
  const prompt = buildProviderPrompt([
    { kind: "user", promptText: "第一个问题", text: "@codex 第一个问题" },
    { providerLabel: "Codex", rawText: "第一个回答" },
    { providerLabel: "Claude", rawText: "另一个观点" },
  ], "继续解释");

  assert.match(prompt, /用户：第一个问题/);
  assert.doesNotMatch(prompt, /@codex/);
  assert.match(prompt, /Codex：第一个回答/);
  assert.match(prompt, /Claude：另一个观点/);
  assert.match(prompt, /继续解释$/);
});
