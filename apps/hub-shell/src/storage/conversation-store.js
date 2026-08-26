const STORAGE_KEY = "ai-chat-hub:mock-conversations:v1";

export function createChromeConversationStore(chromeApi = globalThis.chrome) {
  if (!chromeApi?.storage?.local) {
    throw new Error("chrome.storage.local is unavailable");
  }

  let writeQueue = Promise.resolve();

  return Object.freeze({
    async list() {
      const result = await chromeApi.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] ?? [];
    },

    async append(conversation) {
      const record = structuredClone(conversation);
      const write = writeQueue.then(async () => {
        const result = await chromeApi.storage.local.get(STORAGE_KEY);
        const existing = result[STORAGE_KEY] ?? [];
        await chromeApi.storage.local.set({
          [STORAGE_KEY]: [...existing, record],
        });
        return structuredClone(record);
      });

      writeQueue = write.catch(() => undefined);
      return write;
    },

    async clear() {
      const clear = writeQueue.then(() => chromeApi.storage.local.remove(STORAGE_KEY));
      writeQueue = clear.catch(() => undefined);
      await clear;
    },
  });
}

export function createMemoryConversationStore(initial = []) {
  let records = structuredClone(initial);

  return Object.freeze({
    async list() {
      return structuredClone(records);
    },

    async append(conversation) {
      records = [...records, structuredClone(conversation)];
      return structuredClone(conversation);
    },

    async clear() {
      records = [];
    },
  });
}
