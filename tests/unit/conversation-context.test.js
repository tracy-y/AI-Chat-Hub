import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderPrompt, CONTEXT_POLICIES } from "../../apps/hub-shell/src/core/conversation-context.js";

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

test("context modes retain 20, 50, or 100 latest messages", () => {
  const records = Array.from({ length: 120 }, (_, index) => ({ kind: "user", text: `message-${index}` }));
  const simple = buildProviderPrompt(records, "current", "simple");
  const standard = buildProviderPrompt(records, "current", "standard");
  const deep = buildProviderPrompt(records, "current", "deep");

  assert.doesNotMatch(simple, /message-99\b/);
  assert.match(simple, /message-100\b/);
  assert.doesNotMatch(standard, /message-69\b/);
  assert.match(standard, /message-70\b/);
  assert.doesNotMatch(deep, /message-19\b/);
  assert.match(deep, /message-20\b/);
  assert.deepEqual(Object.values(CONTEXT_POLICIES).map((policy) => policy.maxMessages), [20, 50, 100]);
});

test("deep context stays below the provider prompt safety cap", () => {
  const records = Array.from({ length: 100 }, (_, index) => ({ providerLabel: "Agent", rawText: `${index}:${"长".repeat(2_000)}` }));
  const current = "新".repeat(50_000);
  const prompt = buildProviderPrompt(records, current, "deep");

  assert.ok(prompt.length <= 90_000);
  assert.ok(prompt.endsWith(current));
});

test("unknown context mode is rejected", () => {
  assert.throws(() => buildProviderPrompt([], "question", "unlimited"), /Unknown context mode/);
});
