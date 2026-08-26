import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("native host installer writes a locked manifest for the fixed extension", async () => {
  const targetRoot = await mkdtemp(join(tmpdir(), "ai-chat-hub-install-test-"));
  try {
    const result = spawnSync(process.execPath, [
      "scripts/install-native-host.mjs",
      "--target-root", targetRoot,
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);

    const manifestPath = join(targetRoot, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", "com.tracy.ai_chat_hub.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const manifestMode = (await stat(manifestPath)).mode & 0o777;
    assert.deepEqual(manifest.allowed_origins, ["chrome-extension://kciebkgpifidpicfbhpmdddibfnnhkgg/"]);
    assert.equal(manifestMode, 0o600);

    const instructionPath = join(targetRoot, "Library", "Application Support", "AI Chat Hub", "instructions", "README.md");
    assert.match(await readFile(instructionPath, "utf8"), /AI Chat Hub User Instructions/);
    assert.equal((await stat(instructionPath)).mode & 0o777, 0o600);

    await writeFile(instructionPath, "personal content", "utf8");
    const secondRun = spawnSync(process.execPath, [
      "scripts/install-native-host.mjs",
      "--target-root", targetRoot,
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(secondRun.status, 0, secondRun.stderr);
    assert.equal(await readFile(instructionPath, "utf8"), "personal content");
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});
