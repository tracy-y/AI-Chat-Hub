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
  const available = ["codex", "claude", "gemini", "grok"];
  assert.deepEqual(parseMentionRouting("@gpt @claude compare", available).providers, ["codex", "claude"]);
  assert.deepEqual(parseMentionRouting("@all compare", available).providers, available);
});

test("message without a mention deterministically targets all agents", () => {
  const route = parseMentionRouting("直接回答", ["codex", "claude"]);
  assert.deepEqual(route.providers, ["codex", "claude"]);
  assert.equal(route.explicit, false);
});

test("mention routing rejects an installed but unavailable agent", () => {
  assert.throws(
    () => parseMentionRouting("@gemini 回答", ["codex", "claude"]),
    /@gemini 当前未安装或未登录/,
  );
});

test("mention-only input is rejected", () => {
  assert.throws(() => parseMentionRouting("@codex"), /还需要输入问题/);
});
