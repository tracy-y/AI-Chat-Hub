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
