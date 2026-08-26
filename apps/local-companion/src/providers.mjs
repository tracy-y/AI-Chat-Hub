import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./process-runner.mjs";

function safeFailure(providerId, providerLabel, error) {
  const known = error instanceof Error ? error.message : "Unknown provider failure";
  const home = process.env.HOME;
  const sanitized = home ? known.replaceAll(home, "[local]") : known;
  return {
    providerId,
    providerLabel,
    status: "failed",
    error: sanitized.slice(0, 500),
  };
}

async function withEmptyWorkingDirectory(callback) {
  const directory = await mkdtemp(join(tmpdir(), "ai-chat-hub-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function requireSuccess(result, providerName) {
  if (result.code !== 0) {
    throw new Error(`${providerName} exited without an answer (code ${result.code ?? "unknown"})`);
  }
}

export async function askCodex(prompt, options = {}) {
  const providerId = "codex";
  const providerLabel = "Codex（ChatGPT 订阅）";
  try {
    const result = await withEmptyWorkingDirectory((cwd) => (options.run ?? runCommand)({
      command: options.command ?? process.env.AI_CHAT_HUB_CODEX_BIN ?? "codex",
      args: [
        "exec",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--color", "never",
        "-C", cwd,
        "-",
      ],
      input: prompt,
      cwd,
    }));
    requireSuccess(result, "Codex");
    if (!result.stdout.trim()) throw new Error("Codex returned an empty answer");
    return { providerId, providerLabel, status: "completed", rawText: result.stdout };
  } catch (error) {
    return safeFailure(providerId, providerLabel, error);
  }
}

export async function askClaude(prompt, options = {}) {
  const providerId = "claude";
  const providerLabel = "Claude Agent（Claude 订阅）";
  try {
    const result = await withEmptyWorkingDirectory((cwd) => (options.run ?? runCommand)({
      command: options.command ?? process.env.AI_CHAT_HUB_CLAUDE_BIN ?? "claude",
      args: [
        "-p",
        "--output-format", "json",
        "--tools", "",
        "--no-session-persistence",
        "--safe-mode",
        "--disable-slash-commands",
        "--no-chrome",
        "--permission-mode", "dontAsk",
      ],
      input: prompt,
      cwd,
    }));
    requireSuccess(result, "Claude");
    const payload = JSON.parse(result.stdout);
    if (payload.is_error === true) {
      throw new Error("Claude reported a failed request");
    }
    if (typeof payload.result !== "string" || !payload.result.trim()) {
      throw new Error("Claude returned an empty answer");
    }
    return { providerId, providerLabel, status: "completed", rawText: payload.result };
  } catch (error) {
    return safeFailure(providerId, providerLabel, error);
  }
}

export async function askAllProviders(prompt, options = {}) {
  return Promise.all([
    askCodex(prompt, options.codex),
    askClaude(prompt, options.claude),
  ]);
}
