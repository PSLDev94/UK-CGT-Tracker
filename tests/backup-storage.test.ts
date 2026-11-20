import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  BACKUP_MAX_AGE_MS,
  backupStorage,
  checkBackupFreshness,
  uploadVerifiedBackup,
} from "../src/server/backup/storage";

const now = Date.parse("2026-11-17T00:30:00.000Z");
const startedAt = "2026-11-16T23:30:00.000Z";
const archive =
  "staging/2026-11-16/00000000-0000-4000-8000-000000000001.cgtenc";
const body = Buffer.from(
  "synthetic encrypted archive with more than thirty-six bytes",
);
const receipt = {
  version: 1,
  environment: "staging",
  archive,
  bytes: body.length,
  startedAt,
  verifiedAt: "2026-11-16T23:31:00.000Z",
  sha256: createHash("sha256").update(body).digest("hex"),
};
type Command =
  | GetObjectCommand
  | HeadObjectCommand
  | ListObjectsV2Command
  | PutObjectCommand;
type Stored = { body: Buffer; metadata?: Record<string, string> };

function storage() {
  const objects = new Map<string, Stored>();
  const faults: {
    get?: boolean;
    corrupt?: boolean;
    putReceipt?: boolean;
    badLength?: boolean;
    listLoop?: boolean;
  } = {};
  const send = vi.fn(async (command: Command) => {
    if (command instanceof PutObjectCommand) {
      const input = command.input;
      if (faults.putReceipt && input.Key!.endsWith(".verified.json"))
        throw new Error("provider failure");
      if (objects.has(input.Key!) && input.IfNoneMatch === "*")
        throw new Error("precondition failed");
      const chunks: Uint8Array[] = [];
      if (typeof input.Body === "string") chunks.push(Buffer.from(input.Body));
      else
        for await (const chunk of input.Body as AsyncIterable<Uint8Array>)
          chunks.push(chunk);
      objects.set(input.Key!, {
        body: Buffer.concat(chunks),
        metadata: input.Metadata,
      });
      return {};
    }
    if (command instanceof ListObjectsV2Command) {
      const keys = [...objects.keys()]
        .filter((key) => key.startsWith(command.input.Prefix!))
        .sort();
      const offset = Number(command.input.ContinuationToken ?? 0);
      const end = offset + command.input.MaxKeys!;
      return {
        Contents: keys.slice(offset, end).map((Key) => ({ Key })),
        IsTruncated: faults.listLoop || end < keys.length,
        NextContinuationToken: faults.listLoop ? "0" : String(end),
      };
    }
    const stored = objects.get(command.input.Key!);
    if (!stored) throw new Error("missing object");
    if (command instanceof HeadObjectCommand)
      return { ContentLength: stored.body.length, Metadata: stored.metadata };
    if (faults.get) throw new Error("provider failure with sensitive details");
    return {
      Body: Readable.from([
        faults.corrupt ? Buffer.alloc(stored.body.length) : stored.body,
      ]),
      ContentLength: stored.body.length + (faults.badLength ? 1 : 0),
    };
  });
  const client = { send } as unknown as S3Client;
  function seed(overrides: Record<string, unknown> = {}) {
    const r = { ...receipt, ...overrides };
    objects.set(r.archive, {
      body,
      metadata: { sha256: r.sha256, format: "CGTBKP01" },
    });
    objects.set(`${r.archive}.verified.json`, {
      body: Buffer.from(JSON.stringify(r)),
    });
  }
  return { objects, client, send, faults, seed };
}

describe("verified object storage", () => {
  it("publishes a receipt only after readback and supports a read-only freshness check", async () => {
    const s = storage();
    const dir = await mkdtemp(join(tmpdir(), "cgt-storage-test-"));
    try {
      const file = join(dir, "encrypted");
      await writeFile(file, body, { mode: 0o600 });
      const published = await uploadVerifiedBackup(
        {
          client: s.client,
          bucket: "test",
          environment: "staging",
          archive,
          file,
          bytes: body.length,
          startedAt,
        },
        () => now,
      );
      expect(published.sha256).toBe(receipt.sha256);
      expect(
        s.send.mock.calls.map(([command]) => command.constructor.name),
      ).toEqual(["PutObjectCommand", "GetObjectCommand", "PutObjectCommand"]);
      s.send.mockClear();
      const checked = await checkBackupFreshness(
        s.client,
        "test",
        "staging",
        now,
      );
      expect(checked.ageMs).toBe(60 * 60_000);
      expect(
        s.send.mock.calls.every(([c]) => !(c instanceof PutObjectCommand)),
      ).toBe(true);
      expect(
        s.send.mock.calls
          .filter(([c]) => c instanceof ListObjectsV2Command)
          .map(([c]) => (c as ListObjectsV2Command).input.Prefix),
      ).toEqual([
        "staging/2026-11-17/",
        "staging/2026-11-16/",
        "staging/2026-11-15/",
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each(["get", "corrupt", "badLength", "putReceipt"] as const)(
    "does not record success on %s failure",
    async (failure) => {
      const s = storage();
      s.faults[failure] = true;
      const dir = await mkdtemp(join(tmpdir(), "cgt-storage-test-"));
      try {
        const file = join(dir, "encrypted");
        await writeFile(file, body);
        await expect(
          uploadVerifiedBackup(
            {
              client: s.client,
              bucket: "test",
              environment: "staging",
              archive,
              file,
              bytes: body.length,
              startedAt,
            },
            () => now,
          ),
        ).rejects.toThrow();
        expect(s.objects.has(`${archive}.verified.json`)).toBe(false);
        await expect(
          checkBackupFreshness(s.client, "test", "staging", now),
        ).rejects.toThrow();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it("ignores unfinished archive uploads and cannot certify an empty bucket", async () => {
    const s = storage();
    await expect(
      checkBackupFreshness(s.client, "test", "staging", now),
    ).rejects.toThrow("No recent");
    s.objects.set(archive, { body });
    await expect(
      checkBackupFreshness(s.client, "test", "staging", now),
    ).rejects.toThrow("No recent");
  });

  it("measures the 26-hour boundary from snapshot start, across two UTC midnights", async () => {
    const s = storage();
    const start = new Date(now - BACKUP_MAX_AGE_MS).toISOString();
    const path = archive.replace("2026-11-16", start.slice(0, 10));
    s.seed({
      archive: path,
      startedAt: start,
      verifiedAt: new Date(Date.parse(start) + 60_000).toISOString(),
    });
    expect(
      (await checkBackupFreshness(s.client, "test", "staging", now)).ageMs,
    ).toBe(BACKUP_MAX_AGE_MS);
    await expect(
      checkBackupFreshness(s.client, "test", "staging", now + 1),
    ).rejects.toThrow("No recent");
  });

  it.each([
    { version: 2 },
    { environment: "production" },
    { sha256: "broken" },
    { bytes: 0 },
    { bytes: 1.5 },
    { bytes: 4 * 1024 ** 3 + 1 },
    { startedAt: "invalid" },
    { startedAt: "2026-11-16" },
    { startedAt: "2026-11-15T23:30:00.000Z" },
    { verifiedAt: "2026-11-17T00:30:00.001Z" },
    { verifiedAt: "2026-11-16T23:29:00.000Z" },
  ])("rejects malformed or implausible receipt %j", async (overrides) => {
    const s = storage();
    s.seed(overrides);
    await expect(
      checkBackupFreshness(s.client, "test", "staging", now),
    ).rejects.toThrow("Invalid backup receipt");
  });

  it.each(["missing", "size", "digest", "format"])(
    "fails when the recorded archive has %s damage",
    async (failure) => {
      const s = storage();
      s.seed();
      if (failure === "missing") s.objects.delete(archive);
      if (failure === "size") s.objects.get(archive)!.body = Buffer.alloc(1);
      if (failure === "digest")
        s.objects.get(archive)!.metadata!.sha256 = "0".repeat(64);
      if (failure === "format")
        s.objects.get(archive)!.metadata!.format = "unknown";
      await expect(
        checkBackupFreshness(s.client, "test", "staging", now),
      ).rejects.toThrow();
    },
  );

  it("selects the newest snapshot instead of the last listed receipt", async () => {
    const s = storage();
    s.seed();
    s.seed({
      archive: archive.replace("000000000001", "000000000002"),
      startedAt: "2026-11-16T23:00:00.000Z",
      verifiedAt: "2026-11-16T23:32:00.000Z",
    });
    expect(
      (await checkBackupFreshness(s.client, "test", "staging", now)).archive,
    ).toBe(archive);
  });

  it.each(["oversized", "invalid JSON", "wrong path"])(
    "rejects %s receipt content",
    async (failure) => {
      const s = storage();
      s.seed();
      const key = `${archive}.verified.json`;
      if (failure === "oversized")
        s.objects.get(key)!.body = Buffer.alloc(2049, " ");
      if (failure === "invalid JSON")
        s.objects.get(key)!.body = Buffer.from("{");
      if (failure === "wrong path") {
        s.objects.set(
          key.replace("000000000001", "000000000002"),
          s.objects.get(key)!,
        );
        s.objects.delete(key);
      }
      await expect(
        checkBackupFreshness(s.client, "test", "staging", now),
      ).rejects.toThrow();
    },
  );

  it("follows pagination but refuses incomplete or unbounded scans", async () => {
    const s = storage();
    s.seed();
    for (let i = 0; i < 150; i++)
      s.objects.set(`staging/2026-11-16/000-${i}`, { body });
    expect(
      (await checkBackupFreshness(s.client, "test", "staging", now)).archive,
    ).toBe(archive);
    s.faults.listLoop = true;
    await expect(
      checkBackupFreshness(s.client, "test", "staging", now),
    ).rejects.toThrow("Incomplete");
    s.faults.listLoop = false;
    for (let i = 150; i < 500; i++)
      s.objects.set(`staging/2026-11-16/000-${i}`, { body });
    await expect(
      checkBackupFreshness(s.client, "test", "staging", now),
    ).rejects.toThrow("Incomplete");
  });

  it("isolates staging and production prefixes", async () => {
    const s = storage();
    s.seed();
    await expect(
      checkBackupFreshness(s.client, "test", "production", now),
    ).rejects.toThrow("No recent");
    expect(
      s.send.mock.calls.every(
        ([c]) =>
          c instanceof ListObjectsV2Command &&
          c.input.Prefix!.startsWith("production/"),
      ),
    ).toBe(true);
  });
});

describe("backup check configuration", () => {
  const env = {
    BACKUP_S3_ENDPOINT: `https://${"a".repeat(32)}.eu.r2.cloudflarestorage.com`,
    BACKUP_S3_BUCKET: "private-test-bucket",
    BACKUP_ENVIRONMENT: "staging",
    BACKUP_S3_ACCESS_KEY_ID: "synthetic-read-key",
    BACKUP_S3_SECRET_ACCESS_KEY: "synthetic-secret",
  };
  it("needs no database credentials or decryption key", () => {
    const config = backupStorage(env);
    expect(config.environment).toBe("staging");
    config.client.destroy();
  });
  it.each([
    { BACKUP_ENVIRONMENT: "unknown" },
    { BACKUP_S3_ACCESS_KEY_ID: "" },
    { BACKUP_S3_SECRET_ACCESS_KEY: "" },
    { BACKUP_S3_BUCKET: "../other" },
    { BACKUP_S3_ENDPOINT: "https://example.com" },
    { BACKUP_S3_ENDPOINT: env.BACKUP_S3_ENDPOINT.replace("https:", "http:") },
    { BACKUP_S3_ENDPOINT: `${env.BACKUP_S3_ENDPOINT}:8443` },
    { BACKUP_S3_ENDPOINT: `${env.BACKUP_S3_ENDPOINT}/path` },
  ])("rejects unsafe or incomplete configuration %j", (overrides) => {
    expect(() => backupStorage({ ...env, ...overrides })).toThrow();
  });
});
