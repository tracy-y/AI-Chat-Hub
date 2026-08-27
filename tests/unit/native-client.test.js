import test from "node:test";
import assert from "node:assert/strict";
import {
  askNativeCompanion,
  getNativeInstructions,
  getNativeProviders,
  getNativeProviderSettings,
  NATIVE_HOST_NAME,
  saveNativeInstructions,
  saveNativeProviderSettings,
} from "../../apps/hub-shell/src/native-client.js";

function createEvent() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    emit(value) { for (const listener of listeners) listener(value); },
  };
}

test("native client sends one prompt and returns matching provider results", async () => {
  const onMessage = createEvent();
  const onDisconnect = createEvent();
  const posted = [];
  const port = {
    onMessage,
    onDisconnect,
    disconnect() {},
    postMessage(message) {
      posted.push(message);
      queueMicrotask(() => {
        onMessage.emit({ id: message.id, type: "started", providers: ["codex", "claude"] });
        onMessage.emit({ id: message.id, type: "chatResult", results: [{ providerId: "codex", status: "completed" }] });
      });
    },
  };
  const connected = [];
  const started = [];
  const chromeApi = {
    runtime: {
      connectNative(name) { connected.push(name); return port; },
      lastError: null,
    },
  };

  const results = await askNativeCompanion("exact prompt", ["claude"], {
    chromeApi,
    onStarted: (providers) => started.push(providers),
    timeoutMs: 1_000,
  });

  assert.deepEqual(connected, [NATIVE_HOST_NAME]);
  assert.equal(posted[0].prompt, "exact prompt");
  assert.deepEqual(posted[0].providers, ["claude"]);
  assert.deepEqual(started, [["codex", "claude"]]);
  assert.deepEqual(results, [{ providerId: "codex", status: "completed" }]);
});

function createInstructionChromeApi(onPost) {
  const onMessage = createEvent();
  const onDisconnect = createEvent();
  const port = {
    onMessage,
    onDisconnect,
    disconnect() {},
    postMessage(message) { queueMicrotask(() => onPost(message, onMessage)); },
  };
  return { runtime: { connectNative() { return port; }, lastError: null } };
}

test("native client reads local user instructions", async () => {
  const chromeApi = createInstructionChromeApi((message, onMessage) => {
    onMessage.emit({ id: message.id, type: "instructions", content: "preferences", maxCharacters: 20_000 });
  });
  assert.deepEqual(await getNativeInstructions({ chromeApi }), { content: "preferences", maxCharacters: 20_000 });
});

test("native client sends instruction content only to the fixed native host", async () => {
  let posted;
  const chromeApi = createInstructionChromeApi((message, onMessage) => {
    posted = message;
    onMessage.emit({ id: message.id, type: "instructionsSaved", characters: message.content.length });
  });
  const result = await saveNativeInstructions("local preference", { chromeApi });
  assert.equal(posted.type, "instructions:set");
  assert.equal(posted.content, "local preference");
  assert.equal(result.characters, 16);
});

test("native client lists local provider availability without credential data", async () => {
  const chromeApi = createInstructionChromeApi((message, onMessage) => {
    onMessage.emit({ id: message.id, type: "providers", providers: [{ id: "gemini", available: true, installed: true }] });
  });
  assert.deepEqual(await getNativeProviders({ chromeApi }), [{ id: "gemini", available: true, installed: true }]);
});

test("native client reads and saves provider-specific local settings", async () => {
  const posted = [];
  const chromeApi = createInstructionChromeApi((message, onMessage) => {
    posted.push(message);
    if (message.type === "provider-settings:get") {
      onMessage.emit({
        id: message.id,
        type: "providerSettings",
        settings: [{ providerId: "gemini", model: "flash", instruction: "简洁" }],
        maxInstructionCharacters: 10_000,
        maxModelCharacters: 120,
      });
    } else {
      onMessage.emit({ id: message.id, type: "providerSettingsSaved", settings: message });
    }
  });

  const result = await getNativeProviderSettings({ chromeApi });
  assert.equal(result.settings[0].instruction, "简洁");
  await saveNativeProviderSettings("gemini", "flash", "简洁", { chromeApi });
  assert.deepEqual(posted[1], {
    id: posted[1].id,
    type: "provider-settings:set",
    providerId: "gemini",
    model: "flash",
    instruction: "简洁",
  });
});
