// Offline generation only: this never connects to a hosted database or sends mail.
import { writeFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { Kysely, PGliteDialect } from 'kysely'
import { getMigrations } from 'better-auth/db/migration'
import { authOptions } from '../src/server/auth'

async function main() {
  const db = new Kysely<Record<string, never>>({ dialect: new PGliteDialect({ pglite: new PGlite() }) })
  try {
    const options = authOptions(db, { origin: 'http://localhost:3000', secret: 'offline-schema-generator-placeholder-not-a-runtime-secret', secureCookies: false, clientIpHeader: 'x-test-ip' }, async () => { throw new Error('Schema generation must not send email') })
    const plan = await getMigrations(options)
    const sql = await plan.compileMigrations()
    await writeFile('db/migrations/0003_auth.generated.sql', `-- Generated from Better Auth 1.7.25. Do not hand-edit.\nBEGIN;\n${sql}\nCOMMIT;\n`)
  } finally { await db.destroy() }
}
void main().catch(() => { console.error('Auth schema generation failed'); process.exitCode = 1 })
