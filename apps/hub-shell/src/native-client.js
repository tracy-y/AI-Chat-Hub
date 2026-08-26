export const NATIVE_HOST_NAME = "com.tracy.ai_chat_hub";

export function askNativeCompanion(prompt, providers, {
  chromeApi = globalThis.chrome,
  onStarted = () => undefined,
  timeoutMs = 190_000,
} = {}) {
  if (!chromeApi?.runtime?.connectNative) {
    return Promise.reject(new Error("Chrome Native Messaging 不可用。"));
  }

  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const port = chromeApi.runtime.connectNative(NATIVE_HOST_NAME);
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* already disconnected */ }
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("本地模型请求超时。")));
    }, timeoutMs);

    port.onMessage.addListener((message) => {
      if (message?.id !== id) return;
      if (message.type === "started") {
        onStarted(message.providers ?? []);
      } else if (message.type === "chatResult") {
        finish(() => resolve(message.results ?? []));
      } else if (message.type === "error") {
        finish(() => reject(new Error(message.error ?? "本地 Companion 请求失败。")));
      }
    });

    port.onDisconnect.addListener(() => {
      const detail = chromeApi.runtime.lastError?.message;
      finish(() => reject(new Error(detail || "本地 Companion 已断开。")));
    });

    port.postMessage({ id, type: "chat", prompt, providers });
  });
}
