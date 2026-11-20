import { Client, escapeLiteral } from "pg";
import { pathToFileURL } from "node:url";

export function backupLoginConfiguration(env: NodeJS.ProcessEnv) {
  const owner = new URL(env.MIGRATION_DATABASE_URL ?? "");
  const backup = new URL(env.BACKUP_DATABASE_URL ?? "");
  const password = decodeURIComponent(backup.password);
  if (
    ![owner, backup].every((url) =>
      ["postgres:", "postgresql:"].includes(url.protocol),
    ) ||
    owner.hostname !== backup.hostname ||
    (owner.port || "5432") !== (backup.port || "5432") ||
    owner.pathname !== backup.pathname ||
    owner.search !== backup.search ||
    backup.search ||
    backup.hash ||
    decodeURIComponent(backup.username) !== "cgt_runtime_backup" ||
    owner.username === backup.username ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(password) ||
    password === decodeURIComponent(owner.password)
  )
    throw new Error("Unsafe backup database configuration");
  return { password, connectionString: backup.href };
}

async function main() {
  const { password, connectionString } = backupLoginConfiguration(process.env);
  const client = new Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(175106702)");
    await client.query("SET LOCAL password_encryption='scram-sha-256'");
    if (
      !(await client.query("SELECT 1 FROM pg_roles WHERE rolname='cgt_backup'"))
        .rowCount
    ) {
      // Full-database backup needs visibility through tenant RLS, but never writes.
      await client.query(
        "CREATE ROLE cgt_backup NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS",
      );
      await client.query("GRANT pg_read_all_data TO cgt_backup");
    }
    const group = await client.query<{
      safe: boolean;
    }>(`SELECT NOT rolcanlogin AND rolinherit AND NOT rolsuper AND rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
      AND (SELECT count(*) FROM pg_auth_members WHERE member=r.oid)=1
      AND EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
        WHERE m.member=r.oid AND g.rolname='pg_read_all_data' AND NOT m.admin_option AND m.inherit_option)
      AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relowner=r.oid) AS safe FROM pg_roles r WHERE rolname='cgt_backup'`);
    if (group.rows[0]?.safe !== true)
      throw new Error("Unexpected backup group privileges");
    if (
      !(
        await client.query(
          "SELECT 1 FROM pg_roles WHERE rolname='cgt_runtime_backup'",
        )
      ).rowCount
    ) {
      await client.query(
        `CREATE ROLE cgt_runtime_backup LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD ${escapeLiteral(password)}`,
      );
      await client.query(
        "GRANT cgt_backup TO cgt_runtime_backup WITH ADMIN FALSE, INHERIT FALSE, SET TRUE",
      );
    }
    const login = await client.query<{
      safe: boolean;
    }>(`SELECT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
      AND (SELECT count(*) FROM pg_auth_members WHERE member=r.oid)=1
      AND EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
        WHERE m.member=r.oid AND g.rolname='cgt_backup' AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)
      AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relowner=r.oid) AS safe FROM pg_roles r WHERE rolname='cgt_runtime_backup'`);
    if (login.rows[0]?.safe !== true)
      throw new Error("Unexpected backup login privileges");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
  const probe = new Client({
    connectionString,
    options: "-c role=cgt_backup",
    connectionTimeoutMillis: 10000,
  });
  try {
    await probe.connect();
    await probe.query('SELECT count(*) FROM auth."user"');
  } finally {
    await probe.end();
  }
  console.log(
    "Dedicated read-only backup login verified; no credentials logged",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch(() => {
    console.error(
      "Backup login provisioning failed; credentials and SQL withheld",
    );
    process.exitCode = 1;
  });
}
