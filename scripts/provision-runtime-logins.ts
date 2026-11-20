import { pathToFileURL } from 'node:url'
import { Client, escapeIdentifier, escapeLiteral } from 'pg'

const roles = [
  ['APP_DATABASE_URL', 'cgt_runtime_app', 'cgt_app'],
  ['AUTH_DATABASE_URL', 'cgt_runtime_auth', 'cgt_auth'],
  ['BILLING_DATABASE_URL', 'cgt_runtime_billing', 'cgt_billing'],
  ['MAINTENANCE_DATABASE_URL', 'cgt_runtime_maintenance', 'cgt_maintenance'],
] as const

export function runtimeLoginConfiguration(env: NodeJS.ProcessEnv) {
  const migration = new URL(env.MIGRATION_DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(migration.protocol)) throw new Error('Invalid migration database protocol')
  const passwords = new Set<string>()
  return roles.map(([variable, login, role]) => {
    const connectionString = env[variable]
    if (!connectionString) throw new Error('All four runtime database URLs are required')
    const url = new URL(connectionString)
    const password = decodeURIComponent(url.password)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || url.hostname !== migration.hostname || (url.port || '5432') !== (migration.port || '5432')
      || url.pathname !== migration.pathname || decodeURIComponent(url.username) !== login
      || decodeURIComponent(migration.username) === login || url.search !== migration.search
      || !/^[A-Za-z0-9_-]{32,128}$/.test(password) || passwords.has(password)
      || password === decodeURIComponent(migration.password)) throw new Error('Unsafe runtime database configuration')
    passwords.add(password)
    return { variable, login, role, password, connectionString }
  })
}

async function main() {
  const logins = runtimeLoginConfiguration(process.env)
  const owner = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL, connectionTimeoutMillis: 10000 })
  await owner.connect()
  try {
    await owner.query('BEGIN')
    await owner.query('SELECT pg_advisory_xact_lock(175106702)')
    await owner.query("SET LOCAL password_encryption='scram-sha-256'")
    for (const { login, role, password } of logins) {
      const group = await owner.query<{ safe: boolean }>(`SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
        AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
        AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS safe
        FROM pg_roles r WHERE rolname=$1`, [role])
      if (group.rows[0]?.safe !== true) throw new Error('Migrate and verify group roles before provisioning logins')
      const exists = await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [login])
      if (!exists.rowCount) {
        // Identifiers are fixed constants; pg escapes passwords. Never log this SQL.
        await owner.query(`CREATE ROLE ${escapeIdentifier(login)} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 32 PASSWORD ${escapeLiteral(password)}`)
        await owner.query(`GRANT ${escapeIdentifier(role)} TO ${escapeIdentifier(login)} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE`)
      }
      const valid = await owner.query<{ safe: boolean }>(`SELECT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
        AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
        AND (SELECT count(*) FROM pg_auth_members WHERE member=r.oid)=1
        AND EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
          WHERE m.member=r.oid AND g.rolname=$2 AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)
        AND NOT EXISTS (SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
          WHERE n.nspname IN ('cgt','auth') AND pg_has_role(r.oid,t.relowner,'MEMBER')) AS safe
        FROM pg_roles r WHERE rolname=$1`, [login, role])
      if (valid.rows[0]?.safe !== true) throw new Error('Existing login has unexpected privileges; refusing to alter it')
    }
    await owner.query('COMMIT')
    // Existing logins are never rotated implicitly. Wrong supplied passwords fail
    // verification; they do not replace credentials used by another deployment.
    for (const { connectionString, role } of logins) {
      const client = new Client({ connectionString, options: `-c role=${role}`, connectionTimeoutMillis: 10000 })
      try {
        await client.connect()
        const result = await client.query<{ role: string }>('SELECT current_user AS role')
        if (result.rows[0]?.role !== role) throw new Error('Runtime role verification failed')
      } finally { await client.end() }
    }
    console.log('Four separate runtime logins verified; no credentials logged')
  } catch (error) {
    await owner.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { await owner.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => { console.error('Runtime login provisioning failed. No credentials or SQL have been logged.'); process.exitCode = 1 })
}
