import { backupKey, decryptArchive } from "../src/server/backup/archive.ts";

try {
  const [, , source, destination] = process.argv;
  if (!source || !destination || source === destination)
    throw new Error("Two distinct paths required");
  await decryptArchive(
    source,
    destination,
    backupKey(process.env.BACKUP_ENCRYPTION_KEY),
  );
  console.log(
    "Backup authenticated and decrypted. Restore only into an empty isolated database.",
  );
} catch {
  console.error(
    "Backup decryption failed; no completed restore input is available. Check the archive, key and new destination.",
  );
  process.exitCode = 1;
}
