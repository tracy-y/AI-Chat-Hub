import test from "node:test";
import assert from "node:assert/strict";
import { createNativeMessageDecoder, encodeNativeMessage, MAX_NATIVE_MESSAGE_BYTES } from "../../apps/local-companion/src/native-messaging.mjs";

test("native messaging decoder handles split and consecutive frames", () => {
  const messages = [];
  const decode = createNativeMessageDecoder((message) => messages.push(message));
  const frames = Buffer.concat([encodeNativeMessage({ one: 1 }), encodeNativeMessage({ two: "二" })]);

  decode(frames.subarray(0, 3));
  decode(frames.subarray(3, 9));
  decode(frames.subarray(9));

  assert.deepEqual(messages, [{ one: 1 }, { two: "二" }]);
});

test("native messaging encoder rejects oversized output", () => {
  assert.throws(() => encodeNativeMessage({ text: "x".repeat(MAX_NATIVE_MESSAGE_BYTES) }), /too large/);
});
