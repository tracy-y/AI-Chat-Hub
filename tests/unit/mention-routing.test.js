import test from "node:test";
import assert from "node:assert/strict";
import { parseMentionRouting } from "../../apps/hub-shell/src/core/mention-routing.js";

test("mention routing targets one explicitly named agent", () => {
  const route = parseMentionRouting("@claude 请审查这个想法");
  assert.equal(route.prompt, "请审查这个想法");
  assert.deepEqual(route.providers, ["claude"]);
  assert.equal(route.explicit, true);
});

test("mention routing supports aliases, multiple agents, and @all", () => {
  assert.deepEqual(parseMentionRouting("@gpt @claude compare").providers, ["codex", "claude"]);
  assert.deepEqual(parseMentionRouting("@all compare").providers, ["codex", "claude"]);
});

test("message without a mention deterministically targets all agents", () => {
  const route = parseMentionRouting("直接回答");
  assert.deepEqual(route.providers, ["codex", "claude"]);
  assert.equal(route.explicit, false);
});

test("mention-only input is rejected", () => {
  assert.throws(() => parseMentionRouting("@codex"), /还需要输入问题/);
});
