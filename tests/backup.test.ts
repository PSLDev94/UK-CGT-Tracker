import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  backupKey,
  decryptArchive,
  encryptArchive,
} from "../src/server/backup/archive";

describe("authenticated database backups", () => {
  it("round trips a chunked dump, uses different nonces and private file modes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cgt-backup-test-"));
    try {
      const key = randomBytes(32),
        data = randomBytes(180_000);
      for (const name of ["a", "b"])
        await encryptArchive(
          Readable.from([data.subarray(0, 90000), data.subarray(90000)]),
          join(dir, name),
          key,
        );
      expect(await readFile(join(dir, "a"))).not.toEqual(
        await readFile(join(dir, "b")),
      );
      await decryptArchive(join(dir, "a"), join(dir, "restored"), key);
      expect(await readFile(join(dir, "restored"))).toEqual(data);
      expect((await stat(join(dir, "restored"))).mode & 0o777).toBe(0o600);
      await expect(
        decryptArchive(join(dir, "a"), join(dir, "restored"), key),
      ).rejects.toThrow();
      expect(await readFile(join(dir, "restored"))).toEqual(data);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it.each(["key", "body", "tag", "header", "truncated"])(
    "rejects %s corruption without leaving a restore input",
    async (failure) => {
      const dir = await mkdtemp(join(tmpdir(), "cgt-backup-test-"));
      try {
        const key = randomBytes(32);
        await encryptArchive(
          Readable.from([Buffer.from("PGDMP synthetic private contents")]),
          join(dir, "backup"),
          key,
        );
        let data = await readFile(join(dir, "backup"));
        if (failure === "body") data[22] = data[22]! ^ 1;
        if (failure === "header") data[10] = data[10]! ^ 1;
        if (failure === "tag")
          data[data.length - 1] = data[data.length - 1]! ^ 1;
        if (failure === "truncated") data = data.subarray(0, 12);
        await writeFile(join(dir, "backup"), data);
        await expect(
          decryptArchive(
            join(dir, "backup"),
            join(dir, "restore"),
            failure === "key" ? randomBytes(32) : key,
          ),
        ).rejects.toThrow();
        await expect(stat(join(dir, "restore"))).rejects.toThrow();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  it("rejects missing, short or non-hex encryption keys", () => {
    for (const value of [undefined, "", "a".repeat(63), "z".repeat(64)])
      expect(() => backupKey(value)).toThrow();
    expect(backupKey("a".repeat(64))).toHaveLength(32);
  });
});
