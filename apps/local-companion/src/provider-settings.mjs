import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CONFIGURABLE_PROVIDER_IDS = Object.freeze(["codex", "claude", "gemini", "grok", "qwen", "deepseek"]);
export const MAX_PROVIDER_INSTRUCTION_CHARACTERS = 10_000;
export const MAX_MODEL_ID_CHARACTERS = 120;

const MODEL_ID_PATTERN = /^[A-Za-z0-9._:/-]*$/;

function assertProviderId(providerId) {
  if (!CONFIGURABLE_PROVIDER_IDS.includes(providerId)) throw new TypeError("Unsupported provider settings");
}

function assertModel(model) {
  if (typeof model !== "string"
    || model.length > MAX_MODEL_ID_CHARACTERS
    || !MODEL_ID_PATTERN.test(model)
    || model.split("/").includes("..")) {
    throw new TypeError("Invalid model selection");
  }
}

function getSettingsRoot(root = homedir()) {
  return join(root, "Library", "Application Support", "AI Chat Hub");
}

export function getProviderInstructionPath(providerId, root = homedir()) {
  assertProviderId(providerId);
  return join(getSettingsRoot(root), "instructions", "providers", `${providerId}.md`);
}

export function getProviderModelsPath(root = homedir()) {
  return join(getSettingsRoot(root), "settings", "providers.json");
}

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
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

async function readModels(options = {}) {
  const path = options.modelsPath ?? getProviderModelsPath(options.root);
  const raw = await readText(path);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("Local provider model settings are invalid");
  }
}

export async function readProviderSettings(providerId, options = {}) {
  assertProviderId(providerId);
  const models = await readModels(options);
  const model = typeof models[providerId] === "string" ? models[providerId] : "";
  assertModel(model);
  const instructionPath = options.instructionPath ?? getProviderInstructionPath(providerId, options.root);
  const instruction = await readText(instructionPath);
  return Object.freeze({ providerId, model, instruction });
}

export async function readAllProviderSettings(options = {}) {
  return Promise.all(CONFIGURABLE_PROVIDER_IDS.map((providerId) => readProviderSettings(providerId, options)));
}

export async function writeProviderSettings(providerId, { model, instruction }, options = {}) {
  assertProviderId(providerId);
  assertModel(model);
  if (typeof instruction !== "string") throw new TypeError("Provider instruction must be text");
  if (instruction.length > MAX_PROVIDER_INSTRUCTION_CHARACTERS) throw new RangeError("Provider instruction is too long");

  const models = await readModels(options);
  models[providerId] = model;
  const modelsPath = options.modelsPath ?? getProviderModelsPath(options.root);
  const instructionPath = options.instructionPath ?? getProviderInstructionPath(providerId, options.root);
  await atomicPrivateWrite(modelsPath, `${JSON.stringify(models, null, 2)}\n`);
  await atomicPrivateWrite(instructionPath, instruction);
  return Object.freeze({ providerId, model, instruction });
}
