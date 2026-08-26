import test from "node:test";
import assert from "node:assert/strict";
import { askNativeCompanion, NATIVE_HOST_NAME } from "../../apps/hub-shell/src/native-client.js";

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
