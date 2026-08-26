import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  addUserInstructionsToPrompt,
  DEFAULT_INSTRUCTION_TEMPLATE,
  getInstructionPath,
  MAX_INSTRUCTION_CHARACTERS,
  readUserInstructions,
  writeUserInstructions,
} from "../../apps/local-companion/src/user-instructions.mjs";

test("user instructions are written exactly with private file permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-chat-hub-instructions-"));
  try {
    const content = "# Preferences\n\n默认使用中文。\n";
    await writeUserInstructions(content, { root });
    assert.equal(await readUserInstructions({ root }), content);
    assert.equal((await stat(getInstructionPath(root))).mode & 0o777, 0o600);
    assert.equal((await stat(dirname(getInstructionPath(root)))).mode & 0o777, 0o700);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("saved instructions are added before the conversation prompt", () => {
  const prompt = addUserInstructionsToPrompt("当前问题", "默认使用中文。\n");
  assert.match(prompt, /用户长期说明开始/);
  assert.match(prompt, /默认使用中文/);
  assert.ok(prompt.endsWith("当前问题"));
});

test("empty or untouched template instructions do not change the prompt", () => {
  assert.equal(addUserInstructionsToPrompt("question", ""), "question");
  assert.equal(addUserInstructionsToPrompt("question", DEFAULT_INSTRUCTION_TEMPLATE), "question");
});

test("instruction length limit is enforced before writing", async () => {
  await assert.rejects(
    () => writeUserInstructions("x".repeat(MAX_INSTRUCTION_CHARACTERS + 1), { root: "/unused" }),
    /too long/,
  );
});
