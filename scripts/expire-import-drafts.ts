import { Client } from 'pg'

async function main() {
  const connectionString = process.env.MAINTENANCE_DATABASE_URL
  if (!connectionString) throw new Error('Maintenance database is not configured')
  const client = new Client({ connectionString, options: '-c role=cgt_maintenance -c statement_timeout=30000', connectionTimeoutMillis: 10000 })
  await client.connect()
  try {
    const role = await client.query<{ safe: boolean }>(`SELECT current_user='cgt_maintenance' AND NOT rolsuper AND NOT rolbypassrls AS safe FROM pg_roles WHERE rolname=session_user`)
    if (role.rows[0]?.safe !== true) throw new Error('Unsafe maintenance database credentials')
    const result = await client.query('DELETE FROM cgt.import_drafts WHERE expires_at <= now()')
    console.log(JSON.stringify({ event: 'expired_import_drafts_removed', count: result.rowCount }))
  } finally { await client.end() }
}
void main().catch(() => { console.error('Import draft cleanup failed'); process.exitCode = 1 })
