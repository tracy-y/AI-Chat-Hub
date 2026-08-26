import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryConversationStore } from "../../apps/hub-shell/src/storage/conversation-store.js";

test("conversation store returns copies instead of mutable internal records", async () => {
  const store = createMemoryConversationStore();
  const record = { id: "one", rawText: "official text" };

  await store.append(record);
  record.rawText = "changed outside";
  const firstRead = await store.list();
  firstRead[0].rawText = "changed after reading";
  const secondRead = await store.list();

  assert.equal(secondRead[0].rawText, "official text");
});

test("conversation store clears all local records", async () => {
  const store = createMemoryConversationStore([{ id: "one" }]);
  await store.clear();
  assert.deepEqual(await store.list(), []);
});

test("chrome conversation store serializes concurrent appends", async () => {
  const storage = new Map();
  const chromeApi = {
    storage: {
      local: {
        async get(key) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return storage.has(key) ? { [key]: structuredClone(storage.get(key)) } : {};
        },
        async set(values) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, structuredClone(value));
          }
        },
        async remove(key) {
          storage.delete(key);
        },
      },
    },
  };
  const { createChromeConversationStore } = await import(
    "../../apps/hub-shell/src/storage/conversation-store.js"
  );
  const store = createChromeConversationStore(chromeApi);

  await Promise.all([
    store.append({ id: "atlas", rawText: "Atlas reply" }),
    store.append({ id: "beacon", rawText: "Beacon reply" }),
  ]);

  assert.deepEqual(await store.list(), [
    { id: "atlas", rawText: "Atlas reply" },
    { id: "beacon", rawText: "Beacon reply" },
  ]);
});
