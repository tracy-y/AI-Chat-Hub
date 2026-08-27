export const MAX_ATTACHMENT_COUNT = 5;
export const MAX_ATTACHMENT_BYTES = 1024 * 1024;
export const MAX_ATTACHMENT_CHARACTERS = 20_000;
export const MAX_TOTAL_ATTACHMENT_CHARACTERS = 35_000;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "jsonl", "csv", "tsv", "xml", "yaml", "yml",
  "js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "html", "htm", "py", "rb", "go",
  "rs", "java", "kt", "swift", "c", "h", "cpp", "hpp", "sh", "zsh", "fish", "sql",
  "toml", "ini", "conf", "env", "log",
]);

function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isSupportedTextFile(file) {
  if (!file || typeof file.name !== "string") return false;
  return file.type.startsWith("text/")
    || ["application/json", "application/xml", "application/x-yaml"].includes(file.type)
    || TEXT_EXTENSIONS.has(extensionOf(file.name));
}

export async function readTextAttachments(files) {
  const selected = [...files];
  if (selected.length > MAX_ATTACHMENT_COUNT) {
    throw new RangeError(`一次最多选择 ${MAX_ATTACHMENT_COUNT} 个文件。`);
  }

  const attachments = [];
  let totalCharacters = 0;
  for (const file of selected) {
    if (!isSupportedTextFile(file)) {
      throw new TypeError(`${file.name} 暂不支持。当前版本只接收文本、Markdown、代码、JSON 和 CSV 文件。`);
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new RangeError(`${file.name} 超过 1 MB，请先缩小文件。`);
    }
    const content = await file.text();
    if (content.includes("\0")) throw new TypeError(`${file.name} 看起来不是纯文本文件。`);
    if (content.length > MAX_ATTACHMENT_CHARACTERS) {
      throw new RangeError(`${file.name} 超过 ${MAX_ATTACHMENT_CHARACTERS.toLocaleString()} 个字符。`);
    }
    totalCharacters += content.length;
    if (totalCharacters > MAX_TOTAL_ATTACHMENT_CHARACTERS) {
      throw new RangeError(`附件内容合计不能超过 ${MAX_TOTAL_ATTACHMENT_CHARACTERS.toLocaleString()} 个字符。`);
    }
    attachments.push(Object.freeze({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || "text/plain",
      content,
    }));
  }
  return Object.freeze(attachments);
}

export function attachmentMetadata(attachments) {
  return Object.freeze(attachments.map(({ id, name, size, type }) => Object.freeze({ id, name, size, type })));
}

export function addTextAttachmentsToPrompt(prompt, attachments) {
  if (!attachments?.length) return prompt;
  const blocks = attachments.map((attachment) => [
    `--- 附件开始：${attachment.name} ---`,
    attachment.content,
    `--- 附件结束：${attachment.name} ---`,
  ].join("\n"));
  return [
    prompt,
    "以下文件由用户在当前消息中明确选择。请把文件内容作为本次问题的输入；不要声称读取了未提供的文件。",
    ...blocks,
  ].join("\n\n");
}
