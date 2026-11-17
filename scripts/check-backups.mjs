import {
  backupStorage,
  checkBackupFreshness,
} from "../src/server/backup/storage.ts";

async function main() {
  // Supply a bucket-scoped Object Read token. No database or encryption key needed.
  const { client, bucket, environment } = backupStorage(process.env);
  try {
    const result = await checkBackupFreshness(client, bucket, environment);
    console.log(
      JSON.stringify({
        event: "database_backup_health",
        success: true,
        environment,
        startedAt: result.startedAt,
        verifiedAt: result.verifiedAt,
        ageMs: result.ageMs,
        bytes: result.bytes,
      }),
    );
  } finally {
    client.destroy();
  }
}

main().catch(() => {
  console.error(
    JSON.stringify({
      event: "database_backup_health",
      success: false,
      message: "Backup freshness check failed; operator investigation required",
    }),
  );
  process.exitCode = 1;
});
