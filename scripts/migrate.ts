import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { Client } from 'pg'

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL
  if (!connectionString) throw new Error('Migration database is not configured')
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 })
  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock(175106701)')
    await client.query(`CREATE SCHEMA IF NOT EXISTS cgt_migrations;
      CREATE TABLE IF NOT EXISTS cgt_migrations.applied (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`)
    const files = (await readdir('db/migrations')).filter(name => /^\d{4}_[a-z_]+\.sql$/.test(name)).sort()
    // Generated schema has a deliberate dot suffix.
    const generated = (await readdir('db/migrations')).filter(name => /^\d{4}_[a-z_]+\.generated\.sql$/.test(name))
    for (const name of [...files, ...generated].sort()) {
      const source = await readFile(`db/migrations/${name}`, 'utf8')
      const checksum = createHash('sha256').update(source).digest('hex')
      const previous = await client.query<{ checksum: string }>('SELECT checksum FROM cgt_migrations.applied WHERE name=$1', [name])
      if (previous.rows[0]) {
        if (previous.rows[0].checksum !== checksum) throw new Error('Previously applied migration changed')
        continue
      }
      if (!/^BEGIN;$/m.test(source) || !/COMMIT;\s*$/.test(source)) throw new Error('Migration must declare its transaction boundary')
      const body = source.replace(/^BEGIN;\s*$/m, '').replace(/COMMIT;\s*$/, '')
      await client.query('BEGIN')
      try {
        await client.query(body)
        await client.query('INSERT INTO cgt_migrations.applied(name,checksum) VALUES($1,$2)', [name, checksum])
        await client.query('COMMIT')
        console.log(`Applied ${name}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally { await client.end() }
}
void main().catch(() => { console.error('Migration failed. No credentials or database records have been logged. Inspect migration state with an authorised database connection.'); process.exitCode = 1 })
