import test from "node:test";
import assert from "node:assert/strict";
import { createChromeChatSessionStore } from "../../apps/hub-shell/src/storage/chat-session-store.js";

function createChromeStorage(initial = {}) {
  const storage = new Map(Object.entries(structuredClone(initial)));
  return {
    chromeApi: {
      storage: {
        local: {
          async get(keys) {
            const requested = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(requested.filter((key) => storage.has(key)).map((key) => [key, structuredClone(storage.get(key))]));
          },
          async set(values) {
            for (const [key, value] of Object.entries(values)) storage.set(key, structuredClone(value));
          },
          async remove(key) { storage.delete(key); },
        },
      },
    },
    storage,
  };
}

test("new chat preserves the previous session and starts empty", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  await store.append({ id: "user-1", kind: "user", promptText: "第一条问题", createdAt: "2026-08-26T00:00:00.000Z" });
  const before = await store.load();
  const after = await store.startNew();

  assert.equal(after.sessions.length, 2);
  assert.equal(after.sessions.find((session) => session.id === before.activeSessionId).records.length, 1);
  assert.equal(after.sessions.find((session) => session.id === after.activeSessionId).records.length, 0);
  assert.equal(after.sessions[0].title, "第一条问题");
});

test("selecting a saved session makes later messages append there", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  await store.append({ id: "first", kind: "user", promptText: "旧对话", createdAt: "2026-08-26T00:00:00.000Z" });
  const firstId = (await store.load()).activeSessionId;
  await store.startNew();
  await store.select(firstId);
  await store.append({ id: "second", rawText: "继续回答", capturedAt: "2026-08-26T00:01:00.000Z" });

  const state = await store.load();
  assert.deepEqual(state.sessions.find((session) => session.id === firstId).records.map((record) => record.id), ["first", "second"]);
});

test("legacy flat history migrates into one preserved session", async () => {
  const legacyKey = "ai-chat-hub:mock-conversations:v1";
  const { chromeApi, storage } = createChromeStorage({
    [legacyKey]: [{ id: "legacy", promptText: "以前的问题", rawText: "以前的回答", capturedAt: "2026-08-25T00:00:00.000Z" }],
  });
  const store = createChromeChatSessionStore(chromeApi);
  const state = await store.load();

  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].records[0].id, "legacy");
  assert.equal(state.sessions[0].title, "以前的问题");
  assert.equal(storage.has(legacyKey), false);
});

test("starting new repeatedly does not create empty duplicate sessions", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  await store.startNew();
  await store.startNew();
  assert.equal((await store.load()).sessions.length, 1);
});

test("session store serializes concurrent record appends", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  await Promise.all([
    store.append({ id: "one", rawText: "one" }),
    store.append({ id: "two", rawText: "two" }),
  ]);

  const state = await store.load();
  assert.deepEqual(state.sessions[0].records.map((record) => record.id), ["one", "two"]);
});

test("deleting a saved session preserves the other sessions", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  await store.append({ id: "old", kind: "user", promptText: "旧对话", createdAt: "2026-08-26T00:00:00.000Z" });
  const oldId = (await store.load()).activeSessionId;
  await store.startNew();
  await store.append({ id: "new", kind: "user", promptText: "新对话", createdAt: "2026-08-26T01:00:00.000Z" });

  const state = await store.delete(oldId);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].records[0].id, "new");
});

test("deleting the active session selects the most recently updated remaining session", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  await store.append({ id: "old", kind: "user", promptText: "旧对话", createdAt: "2026-08-26T00:00:00.000Z" });
  const oldId = (await store.load()).activeSessionId;
  await store.startNew();
  await store.append({ id: "new", kind: "user", promptText: "新对话", createdAt: "2026-08-26T01:00:00.000Z" });
  const newId = (await store.load()).activeSessionId;

  const state = await store.delete(newId);
  assert.equal(state.activeSessionId, oldId);
});

test("deleting the last session creates one empty replacement", async () => {
  const { chromeApi } = createChromeStorage();
  const store = createChromeChatSessionStore(chromeApi);
  const initial = await store.load();
  const state = await store.delete(initial.activeSessionId);

  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].records.length, 0);
  assert.equal(state.sessions[0].title, "新对话");
});
