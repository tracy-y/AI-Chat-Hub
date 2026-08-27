import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir, tmpdir } from "node:os";
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

function parseJsonAnswer(stdout, providerName, keys) {
  const payload = JSON.parse(stdout);
  const answer = keys.map((key) => payload?.[key]).find((value) => typeof value === "string" && value.trim());
  if (!answer) throw new Error(`${providerName} returned an empty answer`);
  return answer;
}

function parseStreamJsonAnswer(stdout, providerName) {
  const events = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const result = events.findLast((event) => event.event === "result")?.result;
  if (result?.status !== "SUCCESS") {
    throw new Error(`${providerName} reported ${result?.status ?? "an invalid result"}`);
  }
  if (typeof result.response !== "string" || !result.response.trim()) {
    throw new Error(`${providerName} returned an empty answer`);
  }
  return result.response;
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

export async function askGemini(prompt, options = {}) {
  const providerId = "gemini";
  const providerLabel = "Gemini via Antigravity（Google 订阅）";
  try {
    const result = await withEmptyWorkingDirectory((cwd) => (options.run ?? runCommand)({
      command: options.command ?? process.env.AI_CHAT_HUB_ANTIGRAVITY_BIN ?? "agy",
      args: [
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--model", options.model ?? process.env.AI_CHAT_HUB_GEMINI_MODEL ?? "gemini-3.7-flash-medium",
        "--mode", "plan",
        "--sandbox",
        "--disable-slash-commands",
      ],
      input: `${JSON.stringify({ event: "user", message: { content: prompt } })}\n`,
      cwd,
    }));
    requireSuccess(result, "Antigravity");
    const rawText = parseStreamJsonAnswer(result.stdout, "Antigravity");
    return { providerId, providerLabel, status: "completed", rawText };
  } catch (error) {
    return safeFailure(providerId, providerLabel, error);
  }
}

export async function askGrok(prompt, options = {}) {
  const providerId = "grok";
  const providerLabel = "Grok Build（xAI 账号）";
  try {
    const result = await withEmptyWorkingDirectory(async (cwd) => {
      const promptPath = join(cwd, "prompt.txt");
      await writeFile(promptPath, prompt, { encoding: "utf8", mode: 0o600 });
      return (options.run ?? runCommand)({
        command: options.command ?? process.env.AI_CHAT_HUB_GROK_BIN ?? "grok",
        args: [
          "--prompt-file", promptPath,
          "--output-format", "plain",
          "--permission-mode", "plan",
          "--tools", "",
          "--no-subagents",
          "--disable-web-search",
          "--cwd", cwd,
          "--verbatim",
        ],
        input: "",
        cwd,
      });
    });
    requireSuccess(result, "Grok");
    if (!result.stdout.trim()) throw new Error("Grok returned an empty answer");
    return { providerId, providerLabel, status: "completed", rawText: result.stdout };
  } catch (error) {
    return safeFailure(providerId, providerLabel, error);
  }
}

export async function askAllProviders(prompt, options = {}) {
  return askSelectedProviders(prompt, PROVIDER_IDS, options);
}

const PROVIDERS = Object.freeze({ codex: askCodex, claude: askClaude, gemini: askGemini, grok: askGrok });
export const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDERS));

const PROVIDER_METADATA = Object.freeze({
  codex: { label: "Codex（ChatGPT 订阅）", environment: "AI_CHAT_HUB_CODEX_BIN" },
  claude: { label: "Claude Agent（Claude 订阅）", environment: "AI_CHAT_HUB_CLAUDE_BIN" },
  gemini: { label: "Gemini via Antigravity（Google 订阅）", environment: "AI_CHAT_HUB_ANTIGRAVITY_BIN" },
  grok: { label: "Grok Build（xAI 账号）", environment: "AI_CHAT_HUB_GROK_BIN" },
});

async function executableExists(command) {
  if (!command) return false;
  if (!command.includes("/")) return true;
  try {
    await access(command, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function localCredentialExists(...segments) {
  try {
    await access(join(homedir(), ...segments), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function listProviderAvailability(options = {}) {
  return Promise.all(PROVIDER_IDS.map(async (id) => {
    const metadata = PROVIDER_METADATA[id];
    const command = options[id]?.command ?? process.env[metadata.environment];
    const installed = await executableExists(command);
    let available = installed;
    if (available && id === "grok") available = await localCredentialExists(".grok", "auth.json");
    return Object.freeze({ id, label: metadata.label, installed, available });
  }));
}

export async function askSelectedProviders(prompt, providerIds, options = {}) {
  return Promise.all(providerIds.map((providerId) => {
    const ask = PROVIDERS[providerId];
    if (!ask) throw new TypeError(`Unsupported provider: ${providerId}`);
    return ask(prompt, options[providerId]);
  }));
}
