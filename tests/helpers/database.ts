import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { Kysely, PGliteDialect } from 'kysely'

export async function testDatabase(role: 'cgt_app' | 'cgt_auth' | 'cgt_billing') {
  const pg = new PGlite()
  const path = new URL('../../db/migrations/', import.meta.url)
  for (const file of readdirSync(path).filter(name => name.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(new URL(file, path), 'utf8'))
  }
  await pg.exec(`SET ROLE ${role}`)
  const db = new Kysely<Record<string, never>>({ dialect: new PGliteDialect({ pglite: pg }) })
  return { pg, db }
}
