const SESSION_STORAGE_KEY = "ai-chat-hub:sessions:v1";
const LEGACY_RECORDS_KEY = "ai-chat-hub:mock-conversations:v1";

function deriveTitle(records) {
  const firstUser = records.find((record) => record.kind === "user");
  const source = firstUser?.promptText
    ?? firstUser?.text
    ?? records.find((record) => record.promptText)?.promptText
    ?? "已保存的对话";
  const singleLine = source.replace(/\s+/g, " ").trim();
  return singleLine.length > 32 ? `${singleLine.slice(0, 32)}…` : singleLine;
}

function createSession(records = []) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: records.length ? deriveTitle(records) : "新对话",
    createdAt: records[0]?.createdAt ?? records[0]?.capturedAt ?? now,
    updatedAt: records.at(-1)?.createdAt ?? records.at(-1)?.capturedAt ?? now,
    records: structuredClone(records),
  };
}

function cloneState(state) {
  return structuredClone(state);
}

export function createChromeChatSessionStore(chromeApi = globalThis.chrome) {
  if (!chromeApi?.storage?.local) throw new Error("chrome.storage.local is unavailable");
  let writeQueue = Promise.resolve();

  async function readOrInitialize() {
    const result = await chromeApi.storage.local.get([SESSION_STORAGE_KEY, LEGACY_RECORDS_KEY]);
    const saved = result[SESSION_STORAGE_KEY];
    if (saved?.sessions?.length && saved.activeSessionId) return saved;

    const legacyRecords = Array.isArray(result[LEGACY_RECORDS_KEY]) ? result[LEGACY_RECORDS_KEY] : [];
    const session = createSession(legacyRecords);
    const state = { version: 1, activeSessionId: session.id, sessions: [session] };
    await chromeApi.storage.local.set({ [SESSION_STORAGE_KEY]: state });
    if (legacyRecords.length) await chromeApi.storage.local.remove(LEGACY_RECORDS_KEY);
    return state;
  }

  function enqueue(update) {
    const operation = writeQueue.then(async () => {
      const state = cloneState(await readOrInitialize());
      const next = await update(state);
      await chromeApi.storage.local.set({ [SESSION_STORAGE_KEY]: next });
      return cloneState(next);
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
  }

  return Object.freeze({
    async load() {
      await writeQueue;
      return cloneState(await readOrInitialize());
    },

    async append(record) {
      const recordCopy = structuredClone(record);
      return enqueue((state) => {
        const session = state.sessions.find((candidate) => candidate.id === state.activeSessionId);
        if (!session) throw new Error("Active chat session is missing");
        session.records.push(recordCopy);
        session.updatedAt = recordCopy.createdAt ?? recordCopy.capturedAt ?? new Date().toISOString();
        if (session.title === "新对话" && recordCopy.kind === "user") {
          session.title = deriveTitle([recordCopy]);
        }
        return state;
      });
    },

    async startNew() {
      return enqueue((state) => {
        const active = state.sessions.find((session) => session.id === state.activeSessionId);
        if (active?.records.length === 0) return state;
        const session = createSession();
        state.sessions.push(session);
        state.activeSessionId = session.id;
        return state;
      });
    },

    async select(sessionId) {
      return enqueue((state) => {
        if (!state.sessions.some((session) => session.id === sessionId)) {
          throw new TypeError("Unknown chat session");
        }
        state.activeSessionId = sessionId;
        return state;
      });
    },
  });
}
