import test from "node:test";
import assert from "node:assert/strict";
import { applyMentionSelection, findMentionQuery } from "../../apps/hub-shell/src/core/mention-autocomplete.js";

test("mention autocomplete opens for @ at the cursor", () => {
  assert.deepEqual(findMentionQuery("@", 1), { start: 0, end: 1, query: "" });
  assert.deepEqual(findMentionQuery("请问 @cl", 6), { start: 3, end: 6, query: "cl" });
});

test("mention autocomplete ignores email-like and completed text", () => {
  assert.equal(findMentionQuery("mail@example", 12), null);
  assert.equal(findMentionQuery("@claude 请回答", 11), null);
});

test("mention selection replaces only the active query and returns cursor", () => {
  const result = applyMentionSelection("请问 @cl", { start: 3, end: 6, query: "cl" }, "@claude");
  assert.deepEqual(result, { text: "请问 @claude ", cursor: 11 });
});

test("mention selection accepts the new subscription agents", () => {
  assert.equal(applyMentionSelection("@ge", { start: 0, end: 3, query: "ge" }, "@gemini").text, "@gemini ");
  assert.equal(applyMentionSelection("@gr", { start: 0, end: 3, query: "gr" }, "@grok").text, "@grok ");
});
