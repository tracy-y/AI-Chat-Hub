import test from "node:test";
import assert from "node:assert/strict";
import { askClaude, askCodex } from "../../apps/local-companion/src/providers.mjs";

test("Codex receives the exact prompt through stdin with fixed safe arguments", async () => {
  const calls = [];
  const result = await askCodex("exact $HOME; prompt\n", {
    command: "/fixed/codex",
    run: async (call) => {
      calls.push(call);
      return { code: 0, signal: null, stdout: "answer\n", stderr: "" };
    },
  });

  assert.equal(calls[0].command, "/fixed/codex");
  assert.equal(calls[0].input, "exact $HOME; prompt\n");
  assert.equal(calls[0].args.at(-1), "-");
  assert.ok(calls[0].args.includes("read-only"));
  assert.equal(result.rawText, "answer\n");
});

test("Claude receives the exact prompt with tools and persistence disabled", async () => {
  const calls = [];
  const result = await askClaude("exact prompt", {
    command: "/fixed/claude",
    run: async (call) => {
      calls.push(call);
      return { code: 0, signal: null, stdout: JSON.stringify({ result: "原始回答" }), stderr: "" };
    },
  });

  assert.equal(calls[0].input, "exact prompt");
  assert.deepEqual(calls[0].args.slice(0, 5), ["-p", "--output-format", "json", "--tools", ""]);
  assert.ok(calls[0].args.includes("--no-session-persistence"));
  assert.equal(result.rawText, "原始回答");
});

test("provider failures do not expose the home path", async () => {
  const previousHome = process.env.HOME;
  process.env.HOME = "/Users/private-person";
  try {
    const result = await askCodex("prompt", {
      run: async () => { throw new Error("failed at /Users/private-person/secret"); },
    });
    assert.equal(result.status, "failed");
    assert.doesNotMatch(result.error, /private-person/);
  } finally {
    process.env.HOME = previousHome;
  }
});
