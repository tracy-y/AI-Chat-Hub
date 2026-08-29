import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readApiProviderSettings, writeApiProviderSettings } from "../../apps/local-companion/src/api-provider-settings.mjs";

function keychainMock() {
  let key = "";
  const calls = [];
  return {
    calls,
    run: async (call) => {
      calls.push(call);
      if (call.args[0] === "set") {
        key = call.input;
        return { code: 0, stdout: "", stderr: "" };
      }
      const wantsValue = call.args[0] === "get";
      return key
        ? { code: 0, stdout: wantsValue ? `${key}\n` : "item", stderr: "" }
        : { code: 44, stdout: "", stderr: "not found" };
    },
  };
}

test("optional API providers default to disabled and do not expose a key", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-api-defaults-"));
  const mock = keychainMock();
  try {
    assert.deepEqual(await readApiProviderSettings("qwen", { root, run: mock.run }), {
      providerId: "qwen", enabled: false, region: "china", keyConfigured: false,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("API key goes to Keychain stdin while only non-secret settings reach disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-api-save-"));
  const path = join(root, "api-settings.json");
  const mock = keychainMock();
  try {
    const saved = await writeApiProviderSettings("qwen", {
      enabled: true, region: "international", apiKey: "sk-private-value",
    }, { root, settingsPath: path, run: mock.run });
    assert.equal(saved.keyConfigured, true);
    assert.match(mock.calls[0].command, /keychain-helper$/);
    assert.deepEqual(mock.calls[0].args, ["set", "qwen"]);
    assert.ok(!mock.calls[0].args.includes("sk-private-value"));
    const disk = await readFile(path, "utf8");
    assert.doesNotMatch(disk, /sk-private-value/);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provider cannot be enabled before a key exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-api-validation-"));
  const mock = keychainMock();
  try {
    await assert.rejects(
      () => writeApiProviderSettings("deepseek", { enabled: true }, { root, run: mock.run }),
      /Save an API key/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Qwen pay-as-you-go access mode is stored without exposing its key", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-qwen-payg-"));
  const path = join(root, "api-settings.json");
  const mock = keychainMock();
  try {
    const saved = await writeApiProviderSettings("qwen", {
      enabled: true, region: "china-payg", apiKey: "sk-private-payg",
    }, { root, settingsPath: path, run: mock.run });
    assert.equal(saved.region, "china-payg");
    assert.doesNotMatch(await readFile(path, "utf8"), /sk-private-payg/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
