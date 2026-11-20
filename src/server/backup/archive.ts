import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

const MAGIC = Buffer.from("CGTBKP01");
const HEADER_LENGTH = MAGIC.length + 12;
const TAG_LENGTH = 16;

export function backupKey(value: string | undefined): Buffer {
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value))
    throw new Error("A 32-byte hexadecimal backup encryption key is required");
  return Buffer.from(value, "hex");
}

/** The dump goes straight from pg_dump to authenticated encryption. */
export async function encryptArchive(
  input: Readable,
  destination: string,
  key: Buffer,
) {
  const iv = randomBytes(12);
  const header = Buffer.concat([MAGIC, iv]);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  let created = false;
  output.once("open", () => {
    created = true;
  });
  try {
    await pipeline(
      input,
      cipher,
      async function* (chunks) {
        yield header;
        for await (const chunk of chunks) yield chunk;
        yield cipher.getAuthTag();
      },
      output,
    );
  } catch (error) {
    if (created) await unlink(destination).catch(() => undefined);
    throw error;
  }
}

/** Never expose a completed plaintext dump until its entire GCM tag is verified.
 * Caller supplies a fresh, private temporary directory and removes it after restore.
 */
export async function decryptArchive(
  source: string,
  destination: string,
  key: Buffer,
) {
  const input = await open(source, "r");
  let created = false;
  try {
    const size = (await input.stat()).size;
    if (size <= HEADER_LENGTH + TAG_LENGTH)
      throw new Error("Truncated backup archive");
    const header = Buffer.alloc(HEADER_LENGTH);
    const tag = Buffer.alloc(TAG_LENGTH);
    await input.read(header, 0, HEADER_LENGTH, 0);
    await input.read(tag, 0, TAG_LENGTH, size - TAG_LENGTH);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error("Unknown backup archive version");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      header.subarray(MAGIC.length),
    );
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
    output.once("open", () => {
      created = true;
    });
    try {
      await pipeline(
        createReadStream(source, {
          start: HEADER_LENGTH,
          end: size - TAG_LENGTH - 1,
        }),
        decipher,
        output,
      );
    } catch (error) {
      if (created) await unlink(destination).catch(() => undefined);
      throw error;
    }
  } finally {
    await input.close();
  }
}
