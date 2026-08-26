import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});
