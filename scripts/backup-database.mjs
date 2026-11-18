import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signalBackupOutcome } from "../src/server/backup/heartbeat.ts";
import { backupKey, encryptArchive } from "../src/server/backup/archive.ts";
import {
  backupStorage,
  uploadVerifiedBackup,
} from "../src/server/backup/storage.ts";

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
  const { client, bucket, environment } = backupStorage(process.env);
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
    const startedAt = new Date(started).toISOString();
    const name = `${environment}/${startedAt.slice(0, 10)}/${randomUUID()}.cgtenc`;
    await uploadVerifiedBackup({
      client,
      bucket,
      environment,
      archive: name,
      file,
      bytes: size,
      startedAt,
    });
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

let succeeded = false;
try {
  await main();
  succeeded = true;
} catch {
  // Provider errors can contain URLs, SQL or credentials. Log a fixed failure only.
  console.error(
    JSON.stringify({
      event: "database_backup",
      success: false,
      message: "Backup failed; operator investigation required",
    }),
  );
  process.exitCode = 1;
}

try {
  await signalBackupOutcome(process.env.BACKUP_HEARTBEAT_URL, succeeded);
} catch {
  console.error(JSON.stringify({ event: "database_backup_signal_failed" }));
  process.exitCode = 1;
}
