import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getProviderInstructionPath,
  getProviderModelsPath,
  readAllProviderSettings,
  readProviderSettings,
  writeProviderSettings,
} from "../../apps/local-companion/src/provider-settings.mjs";

test("provider model and instruction settings stay in private local files", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-provider-settings-"));
  try {
    await writeProviderSettings("claude", { model: "sonnet", instruction: "语气温和" }, { root });
    assert.deepEqual(await readProviderSettings("claude", { root }), {
      providerId: "claude",
      model: "sonnet",
      instruction: "语气温和",
    });
    assert.equal((await stat(getProviderModelsPath(root))).mode & 0o777, 0o600);
    assert.equal((await stat(getProviderInstructionPath("claude", root))).mode & 0o777, 0o600);
    assert.doesNotMatch(await readFile(getProviderModelsPath(root), "utf8"), /语气温和/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("all provider settings default to empty user-controlled values", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-provider-defaults-"));
  try {
    const settings = await readAllProviderSettings({ root });
    assert.equal(settings.length, 6);
    assert.ok(settings.every((entry) => entry.model === "" && entry.instruction === ""));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provider settings reject paths, oversized instructions, and unknown providers", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-provider-validation-"));
  try {
    await assert.rejects(
      () => writeProviderSettings("codex", { model: "../../secret", instruction: "" }, { root }),
      /Invalid model/,
    );
    await assert.rejects(
      () => writeProviderSettings("unknown", { model: "", instruction: "" }, { root }),
      /Unsupported provider/,
    );
    await assert.rejects(
      () => writeProviderSettings("codex", { model: "", instruction: "x".repeat(10_001) }, { root }),
      /too long/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
