import { spawn } from "node:child_process";

export const DEFAULT_TIMEOUT_MS = 180_000;
export const DEFAULT_OUTPUT_LIMIT = 900_000;

export function runCommand({
  command,
  args,
  input,
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  outputLimit = DEFAULT_OUTPUT_LIMIT,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timer;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const collect = (target, limitKey, chunk) => {
      if (limitKey === "stdout") stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;

      if (stdoutBytes + stderrBytes > outputLimit) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("Provider output exceeded the safe size limit")));
        return;
      }
      target.push(chunk);
    };

    child.stdout.on("data", (chunk) => collect(stdout, "stdout", chunk));
    child.stderr.on("data", (chunk) => collect(stderr, "stderr", chunk));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, signal) => finish(() => resolve({
      code,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    })));

    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("Provider request timed out")));
    }, timeoutMs);
    timer.unref();

    child.stdin.on("error", () => undefined);
    child.stdin.end(input, "utf8");
  });
}
