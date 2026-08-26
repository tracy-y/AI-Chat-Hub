const STORAGE_KEY = "ai-chat-hub:mock-conversations:v1";

export function createChromeConversationStore(chromeApi = globalThis.chrome) {
  if (!chromeApi?.storage?.local) {
    throw new Error("chrome.storage.local is unavailable");
  }

  return Object.freeze({
    async list() {
      const result = await chromeApi.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] ?? [];
    },

    async append(conversation) {
      const existing = await this.list();
      const next = [...existing, structuredClone(conversation)];
      await chromeApi.storage.local.set({ [STORAGE_KEY]: next });
      return structuredClone(conversation);
    },

    async clear() {
      await chromeApi.storage.local.remove(STORAGE_KEY);
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
