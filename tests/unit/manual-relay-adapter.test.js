import test from "node:test";
import assert from "node:assert/strict";
import { createManualRelayAdapter } from "../../apps/hub-shell/src/adapters/manual-relay-adapter.js";

const chatgpt = createManualRelayAdapter({
  id: "chatgpt",
  label: "ChatGPT",
  officialUrl: "https://chatgpt.com/",
  allowedHosts: ["chatgpt.com"],
});

test("manual relay preserves prompt and response text exactly", () => {
  const promptText = "  Keep prompt spacing\n";
  const rawText = "  Exact response\n\n- café 🐈\n";
  const response = chatgpt.createResponse({
    promptText,
    rawText,
    sourceUrl: "https://chatgpt.com/c/example",
  });

  assert.equal(response.promptText, promptText);
  assert.equal(response.rawText, rawText);
  assert.equal(response.sourceUrl, "https://chatgpt.com/c/example");
  assert.equal(response.captureVersion, "manual-relay-v1");
  assert.equal(Object.isFrozen(response), true);
});

test("manual relay rejects links for the wrong provider", () => {
  assert.throws(
    () => chatgpt.createResponse({
      promptText: "Question",
      rawText: "Answer",
      sourceUrl: "https://claude.ai/chat/example",
    }),
    /does not match this provider/,
  );
});

test("manual relay allows an omitted conversation link", () => {
  const response = chatgpt.createResponse({
    promptText: "Question",
    rawText: "Answer",
    sourceUrl: "",
  });

  assert.equal(response.sourceUrl, null);
});
