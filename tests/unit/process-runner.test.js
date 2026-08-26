import test from "node:test";
import assert from "node:assert/strict";
import { runCommand } from "../../apps/local-companion/src/process-runner.mjs";

test("process runner passes prompt via stdin without shell interpretation", async () => {
  const input = "$HOME; $(echo unsafe) `whoami`\n";
  const result = await runCommand({
    command: process.execPath,
    args: ["-e", "process.stdin.pipe(process.stdout)"],
    input,
    cwd: process.cwd(),
    timeoutMs: 5_000,
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, input);
});
