import test from "node:test";
import assert from "node:assert/strict";
import { askClaude, askCodex, askDeepSeek, askGemini, askGrok, askQwen, askSelectedProviders } from "../../apps/local-companion/src/providers.mjs";

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

test("provider model selections are passed as fixed command arguments", async () => {
  const calls = [];
  await askCodex("prompt", {
    command: "/fixed/codex",
    model: "gpt-test",
    run: async (call) => {
      calls.push(call);
      return { code: 0, signal: null, stdout: "answer", stderr: "" };
    },
  });
  assert.deepEqual(calls[0].args.slice(0, 3), ["exec", "--model", "gpt-test"]);
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

test("Gemini uses Antigravity stream input in plan and sandbox modes", async () => {
  const calls = [];
  const result = await askGemini("exact Gemini prompt", {
    command: "/fixed/agy",
    run: async (call) => {
      calls.push(call);
      return {
        code: 0,
        signal: null,
        stdout: `${JSON.stringify({ event: "result", result: { status: "SUCCESS", response: "Gemini 原始回答" } })}\n`,
        stderr: "",
      };
    },
  });

  assert.deepEqual(JSON.parse(calls[0].input), {
    event: "user",
    message: { content: "exact Gemini prompt" },
  });
  assert.ok(calls[0].args.includes("stream-json"));
  assert.ok(calls[0].args.includes("gemini-3.7-flash-medium"));
  assert.ok(calls[0].args.includes("plan"));
  assert.ok(calls[0].args.includes("--sandbox"));
  assert.equal(result.rawText, "Gemini 原始回答");
});

test("Grok uses a private prompt file with tools disabled and preserves stdout", async () => {
  const calls = [];
  const result = await askGrok("exact Grok prompt", {
    command: "/fixed/grok",
    run: async (call) => {
      calls.push(call);
      return { code: 0, signal: null, stdout: "Grok 原始回答\n", stderr: "" };
    },
  });

  assert.equal(calls[0].input, "");
  assert.ok(calls[0].args.includes("--prompt-file"));
  assert.ok(calls[0].args.includes("plan"));
  assert.ok(calls[0].args.includes("--tools"));
  assert.equal(result.rawText, "Grok 原始回答\n");
});

test("Qwen optional API defaults to the China Coding Plan endpoint and preserves content", async () => {
  let call;
  const result = await askQwen("Qwen prompt", {
    apiKey: "sk-local",
    fetch: async (url, options) => {
      call = { url, options };
      return { ok: true, status: 200, text: async () => JSON.stringify({ model: "qwen3.5-plus", choices: [{ message: { content: "Qwen 原始 API 回答" } }] }) };
    },
  });
  assert.equal(call.url, "https://coding.dashscope.aliyuncs.com/v1/chat/completions");
  assert.equal(call.options.headers.Authorization, "Bearer sk-local");
  const body = JSON.parse(call.options.body);
  assert.deepEqual(body.messages, [{ role: "user", content: "Qwen prompt" }]);
  assert.equal(body.enable_thinking, false);
  assert.equal(result.rawText, "Qwen 原始 API 回答");
  assert.equal(result.modelId, "qwen3.5-plus");
});

test("Qwen pay-as-you-go mode uses the China Model Studio endpoint", async () => {
  let call;
  const result = await askQwen("Qwen payg prompt", {
    apiKey: "sk-local",
    region: "china-payg",
    thinkingEnabled: true,
    fetch: async (requestUrl, options) => {
      call = { url: requestUrl, options };
      return { ok: true, status: 200, text: async () => JSON.stringify({ model: "qwen3.5-plus", choices: [{ message: { content: "按量回答" } }] }) };
    },
  });
  assert.equal(call.url, "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
  assert.equal(JSON.parse(call.options.body).enable_thinking, true);
  assert.equal(result.rawText, "按量回答");
});

test("DeepSeek optional API uses the official endpoint and does not expose response bodies on errors", async () => {
  const result = await askDeepSeek("DeepSeek prompt", {
    apiKey: "sk-local",
    fetch: async () => ({ ok: false, status: 401, text: async () => "secret server body" }),
  });
  assert.equal(result.status, "failed");
  assert.match(result.error, /HTTP 401/);
  assert.doesNotMatch(result.error, /secret server body/);
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

test("selected provider execution does not call unmentioned agents", async () => {
  let claudeCalls = 0;
  const results = await askSelectedProviders("prompt", ["claude"], {
    claude: {
      run: async () => {
        claudeCalls += 1;
        return { code: 0, signal: null, stdout: JSON.stringify({ result: "answer" }), stderr: "" };
      },
    },
  });

  assert.equal(claudeCalls, 1);
  assert.deepEqual(results.map((result) => result.providerId), ["claude"]);
});

test("selected providers can receive distinct prompts and models", async () => {
  const calls = [];
  await askSelectedProviders("shared", ["claude"], {
    claude: {
      prompt: "claude-only",
      model: "sonnet",
      run: async (call) => {
        calls.push(call);
        return { code: 0, signal: null, stdout: JSON.stringify({ result: "answer" }), stderr: "" };
      },
    },
  });
  assert.equal(calls[0].input, "claude-only");
  assert.ok(calls[0].args.includes("sonnet"));
});

test("selected provider execution rejects unknown provider IDs", async () => {
  await assert.rejects(() => askSelectedProviders("prompt", ["unknown"]), /Unsupported provider/);
});
