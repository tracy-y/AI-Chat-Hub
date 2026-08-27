#!/usr/bin/env node
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DEFAULT_INSTRUCTION_TEMPLATE, getInstructionPath } from "../apps/local-companion/src/user-instructions.mjs";

const HOST_NAME = "com.tracy.ai_chat_hub";
const DEFAULT_EXTENSION_ID = "kciebkgpifidpicfbhpmdddibfnnhkgg";
const extensionIdIndex = process.argv.indexOf("--extension-id");
const extensionId = extensionIdIndex >= 0 ? process.argv[extensionIdIndex + 1] : DEFAULT_EXTENSION_ID;
const targetRootIndex = process.argv.indexOf("--target-root");
const targetRoot = targetRootIndex >= 0 ? process.argv[targetRootIndex + 1] : homedir();

if (!/^[a-p]{32}$/.test(extensionId)) {
  console.error("Chrome extension ID must be 32 letters from a to p");
  process.exit(2);
}

function findExecutable(name, required = true) {
  const result = spawnSync("/usr/bin/which", [name], { encoding: "utf8" });
  const path = result.status === 0 ? result.stdout.trim() : "";
  if (!path && required) throw new Error(`${name} is not installed or is not on PATH`);
  return path;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(scriptDirectory);
const hostScript = join(repositoryRoot, "apps", "local-companion", "host.mjs");
await access(hostScript, constants.R_OK);

const nodeBin = process.execPath;
const codexBin = findExecutable("codex");
const claudeBin = findExecutable("claude");
const antigravityBin = findExecutable("agy", false);
const grokBin = findExecutable("grok", false);
const supportDirectory = join(targetRoot, "Library", "Application Support", "AI Chat Hub");
const launcherPath = join(supportDirectory, "native-host.sh");
const manifestDirectory = join(targetRoot, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts");
const manifestPath = join(manifestDirectory, `${HOST_NAME}.json`);
const instructionPath = getInstructionPath(targetRoot);

await mkdir(supportDirectory, { recursive: true, mode: 0o700 });
await mkdir(manifestDirectory, { recursive: true });

const launcher = [
  "#!/bin/sh",
  `export AI_CHAT_HUB_CODEX_BIN=${shellQuote(codexBin)}`,
  `export AI_CHAT_HUB_CLAUDE_BIN=${shellQuote(claudeBin)}`,
  ...(antigravityBin ? [`export AI_CHAT_HUB_ANTIGRAVITY_BIN=${shellQuote(antigravityBin)}`] : []),
  ...(grokBin ? [`export AI_CHAT_HUB_GROK_BIN=${shellQuote(grokBin)}`] : []),
  `exec ${shellQuote(nodeBin)} ${shellQuote(hostScript)}`,
  "",
].join("\n");
await writeFile(launcherPath, launcher, { encoding: "utf8", mode: 0o700 });
await chmod(launcherPath, 0o700);

const manifest = {
  name: HOST_NAME,
  description: "AI Chat Hub local subscription companion",
  path: launcherPath,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`],
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await chmod(manifestPath, 0o600);

await mkdir(dirname(instructionPath), { recursive: true, mode: 0o700 });
await chmod(dirname(instructionPath), 0o700);
try {
  await writeFile(instructionPath, DEFAULT_INSTRUCTION_TEMPLATE, { encoding: "utf8", mode: 0o600, flag: "wx" });
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
}
await chmod(instructionPath, 0o600);

console.log(`Installed ${HOST_NAME} for Chrome extension ${extensionId}.`);
console.log(`Manifest: ${manifestPath}`);
console.log(`User instructions: ${instructionPath}`);
