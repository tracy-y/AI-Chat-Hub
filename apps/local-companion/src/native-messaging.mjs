const HEADER_BYTES = 4;
export const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;

export function encodeNativeMessage(value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  if (body.length > MAX_NATIVE_MESSAGE_BYTES) {
    throw new RangeError("Native message is too large");
  }

  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export function createNativeMessageDecoder(onMessage) {
  let buffered = Buffer.alloc(0);

  return function decode(chunk) {
    buffered = Buffer.concat([buffered, chunk]);

    while (buffered.length >= HEADER_BYTES) {
      const bodyLength = buffered.readUInt32LE(0);
      if (bodyLength > MAX_NATIVE_MESSAGE_BYTES) {
        throw new RangeError("Native message is too large");
      }
      if (buffered.length < HEADER_BYTES + bodyLength) return;

      const body = buffered.subarray(HEADER_BYTES, HEADER_BYTES + bodyLength);
      buffered = buffered.subarray(HEADER_BYTES + bodyLength);
      onMessage(JSON.parse(body.toString("utf8")));
    }
  };
}
