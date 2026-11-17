import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { backupKey, encryptArchive } from "../src/server/backup/archive.ts";

async function sha256(stream) {
  const hash = createHash("sha256");
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const db = new URL(process.env.BACKUP_DATABASE_URL || "");
  if (
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    decodeURIComponent(db.username) !== "cgt_runtime_backup" ||
    !db.hostname.endsWith(".railway.internal") ||
    !db.password ||
    db.search ||
    db.hash ||
    !/^\/[a-zA-Z0-9_-]+$/.test(db.pathname)
  )
    throw new Error("Invalid backup database configuration");
  const endpoint = new URL(process.env.BACKUP_S3_ENDPOINT || "");
  if (
    endpoint.protocol !== "https:" ||
    !/^[a-f0-9]{32}(?:\.eu)?\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/"
  )
    throw new Error("Expected private R2 endpoint");
  const bucket = process.env.BACKUP_S3_BUCKET;
  const environment = process.env.BACKUP_ENVIRONMENT;
  if (
    !bucket ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
    !["staging", "production"].includes(environment) ||
    !process.env.BACKUP_S3_ACCESS_KEY_ID ||
    !process.env.BACKUP_S3_SECRET_ACCESS_KEY
  )
    throw new Error("Missing backup storage configuration");
  const client = new S3Client({
    endpoint: endpoint.href,
    region: "auto",
    maxAttempts: 3,
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
    },
  });
  const directory = await mkdtemp(join(tmpdir(), "cgt-backup-"));
  const started = Date.now();
  try {
    const file = join(directory, "database.cgtenc");
    const dump = spawn(
      "pg_dump",
      [
        "--format=custom",
        "--compress=6",
        "--no-owner",
        "--role=cgt_backup",
        "--lock-wait-timeout=30s",
      ],
      {
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 15 * 60_000,
        env: {
          PATH: process.env.PATH,
          PGHOST: db.hostname,
          PGPORT: db.port || "5432",
          PGUSER: decodeURIComponent(db.username),
          PGPASSWORD: decodeURIComponent(db.password),
          PGDATABASE: db.pathname.slice(1),
          PGCONNECT_TIMEOUT: "15",
          // Railway private networking. Reject arbitrary public database destinations at provisioning.
          PGSSLMODE: "prefer",
          PGAPPNAME: "cgt-encrypted-backup",
        },
      },
    );
    const exited = new Promise((resolve) => {
      dump.once("error", () => resolve(false));
      dump.once("close", (code) => resolve(code === 0));
    });
    try {
      await encryptArchive(dump.stdout, file, key);
    } catch (error) {
      dump.kill("SIGKILL");
      await exited;
      throw error;
    }
    if (!(await exited)) throw new Error("Database dump failed");
    const size = (await stat(file)).size;
    if (size > 4 * 1024 ** 3)
      throw new Error(
        "Backup exceeds single-object upload limit; review capacity",
      );
    const digest = await sha256(createReadStream(file));
    const name = `${environment}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.cgtenc`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: name,
        Body: createReadStream(file),
        ContentLength: size,
        ContentType: "application/octet-stream",
        IfNoneMatch: "*",
        Metadata: { sha256: digest, format: "CGTBKP01" },
      }),
      { abortSignal: AbortSignal.timeout(15 * 60_000) },
    );
    const copy = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: name }),
      { abortSignal: AbortSignal.timeout(15 * 60_000) },
    );
    if (
      !copy.Body ||
      copy.ContentLength !== size ||
      (await sha256(copy.Body)) !== digest
    )
      throw new Error("Stored backup readback verification failed");
    console.log(
      JSON.stringify({
        event: "database_backup",
        success: true,
        environment,
        object: name,
        bytes: size,
        elapsedMs: Date.now() - started,
      }),
    );
  } finally {
    client.destroy();
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch(() => {
  // Provider errors can contain URLs, SQL or credentials. Log a fixed failure only.
  console.error(
    JSON.stringify({
      event: "database_backup",
      success: false,
      message: "Backup failed; operator investigation required",
    }),
  );
  process.exitCode = 1;
});
