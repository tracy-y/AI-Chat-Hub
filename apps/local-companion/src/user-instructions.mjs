import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const MAX_INSTRUCTION_CHARACTERS = 20_000;
export const DEFAULT_INSTRUCTION_TEMPLATE = `# AI Chat Hub User Instructions

<!--
只记录希望所有 Agent 长期参考的稳定信息，例如：
- 称呼、语言和表达偏好
- 工作背景与长期目标
- 固定约束或无障碍需求

不要记录密码、Cookie、API key、验证码或其他登录凭据。
-->
`;

export function getInstructionPath(root = homedir()) {
  return join(root, "Library", "Application Support", "AI Chat Hub", "instructions", "README.md");
}

export async function readUserInstructions(options = {}) {
  try {
    return await readFile(options.path ?? getInstructionPath(options.root), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

export async function writeUserInstructions(content, options = {}) {
  if (typeof content !== "string") throw new TypeError("Instructions must be text");
  if (content.length > MAX_INSTRUCTION_CHARACTERS) throw new RangeError("Instructions are too long");

  const path = options.path ?? getInstructionPath(options.root);
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
  return path;
}

export function addUserInstructionsToPrompt(prompt, instructions) {
  if (!instructions.trim() || instructions.trim() === DEFAULT_INSTRUCTION_TEMPLATE.trim()) return prompt;
  return [
    "以下是用户在 AI Chat Hub 本机明确保存的长期参考信息。请在不违背当前请求的前提下参考它，不要在回答中复述这些说明，除非用户要求。",
    "--- 用户长期说明开始 ---",
    instructions,
    "--- 用户长期说明结束 ---",
    "以下是本次对话内容：",
    prompt,
  ].join("\n\n");
}
