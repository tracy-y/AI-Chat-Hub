import test from "node:test";
import assert from "node:assert/strict";
import {
  addTextAttachmentsToPrompt,
  attachmentMetadata,
  isSupportedTextFile,
  readTextAttachments,
} from "../../apps/hub-shell/src/core/text-attachments.js";

function fakeFile(name, content, type = "text/plain") {
  return { name, type, size: Buffer.byteLength(content), text: async () => content };
}

test("reads supported local text files and strips content from stored metadata", async () => {
  const attachments = await readTextAttachments([fakeFile("plan.md", "private plan", "text/markdown")]);
  assert.equal(attachments[0].content, "private plan");
  assert.deepEqual(Object.keys(attachmentMetadata(attachments)[0]).sort(), ["id", "name", "size", "type"]);
});

test("rejects unsupported binary files", async () => {
  const file = fakeFile("photo.png", "binary", "image/png");
  await assert.rejects(() => readTextAttachments([file]), /暂不支持/);
  assert.equal(isSupportedTextFile(file), false);
});

test("adds explicitly selected file content to the provider prompt", () => {
  const prompt = addTextAttachmentsToPrompt("总结", [{ name: "notes.txt", content: "line one" }]);
  assert.match(prompt, /^总结/);
  assert.match(prompt, /附件开始：notes\.txt/);
  assert.match(prompt, /line one/);
});
