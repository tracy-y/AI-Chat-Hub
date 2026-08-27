import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { runCommand } from "./process-runner.mjs";

export const API_PROVIDER_IDS = Object.freeze(["qwen", "deepseek"]);
export const MAX_API_KEY_CHARACTERS = 512;
const KEYCHAIN_SERVICE = "com.tracy.ai-chat-hub.provider-api";
const REGIONS = new Set(["international", "china"]);

function assertProviderId(providerId) {
  if (!API_PROVIDER_IDS.includes(providerId)) throw new TypeError("Unsupported API provider");
}

function assertApiKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey.length > MAX_API_KEY_CHARACTERS || /[\r\n\0]/.test(apiKey)) {
    throw new TypeError("Invalid API key");
  }
}

function settingsPath(root = homedir()) {
  return join(root, "Library", "Application Support", "AI Chat Hub", "settings", "api-providers.json");
}

async function atomicPrivateWrite(path, content) {
  const directory = dirname(path);
  const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function readRawSettings(options = {}) {
  try {
    const raw = await readFile(options.settingsPath ?? settingsPath(options.root), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    if (error instanceof SyntaxError) throw new Error("Local API provider settings are invalid");
    throw error;
  }
}

async function runSecurity(args, input, options = {}) {
  return (options.run ?? runCommand)({
    command: "/usr/bin/security",
    args,
    input,
    timeoutMs: 15_000,
    outputLimit: 4_096,
  });
}

export async function hasApiKey(providerId, options = {}) {
  assertProviderId(providerId);
  const result = await runSecurity([
    "find-generic-password", "-a", providerId, "-s", KEYCHAIN_SERVICE,
  ], "", options);
  return result.code === 0;
}

export async function readApiKey(providerId, options = {}) {
  assertProviderId(providerId);
  const result = await runSecurity([
    "find-generic-password", "-a", providerId, "-s", KEYCHAIN_SERVICE, "-w",
  ], "", options);
  if (result.code !== 0) throw new Error(`${providerId} API key is not configured`);
  const key = result.stdout.replace(/[\r\n]+$/, "");
  assertApiKey(key);
  if (!key) throw new Error(`${providerId} API key is not configured`);
  return key;
}

export async function writeApiKey(providerId, apiKey, options = {}) {
  assertProviderId(providerId);
  assertApiKey(apiKey);
  if (!apiKey) throw new TypeError("API key cannot be empty");
  const result = await runSecurity([
    "add-generic-password", "-U", "-a", providerId, "-s", KEYCHAIN_SERVICE,
    "-l", `AI Chat Hub · ${providerId} API`, "-w",
  ], `${apiKey}\n`, options);
  if (result.code !== 0) throw new Error(`Could not save ${providerId} API key to macOS Keychain`);
}

export async function readApiProviderSettings(providerId, options = {}) {
  assertProviderId(providerId);
  const all = await readRawSettings(options);
  const saved = all[providerId] ?? {};
  const enabled = saved.enabled === true;
  const region = providerId === "qwen" && REGIONS.has(saved.region) ? saved.region : "international";
  const keyConfigured = await hasApiKey(providerId, options);
  return Object.freeze({ providerId, enabled, region, keyConfigured });
}

export async function readAllApiProviderSettings(options = {}) {
  return Promise.all(API_PROVIDER_IDS.map((providerId) => readApiProviderSettings(providerId, options)));
}

export async function writeApiProviderSettings(providerId, { enabled, region = "international", apiKey = "" }, options = {}) {
  assertProviderId(providerId);
  if (typeof enabled !== "boolean") throw new TypeError("API enabled state must be boolean");
  if (providerId === "qwen" && !REGIONS.has(region)) throw new TypeError("Invalid Qwen API region");
  assertApiKey(apiKey);
  if (apiKey) await writeApiKey(providerId, apiKey, options);
  const keyConfigured = apiKey ? true : await hasApiKey(providerId, options);
  if (enabled && !keyConfigured) throw new Error("Save an API key before enabling this provider");

  const all = await readRawSettings(options);
  all[providerId] = { enabled, ...(providerId === "qwen" ? { region } : {}) };
  await atomicPrivateWrite(options.settingsPath ?? settingsPath(options.root), `${JSON.stringify(all, null, 2)}\n`);
  return Object.freeze({ providerId, enabled, region: providerId === "qwen" ? region : "international", keyConfigured });
}
