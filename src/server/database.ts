import { CompiledQuery, Kysely, type Transaction } from 'kysely'
import { assertIdentity, type Identity } from './identity'

// Raw, parameterised SQL is shared between hosted PostgreSQL and PGlite tests.
export type Database = Kysely<Record<string, never>>
export type Connection = Database | Transaction<Record<string, never>>
export async function query<T>(db: Connection, statement: string, values: readonly unknown[] = []): Promise<T[]> {
  return (await db.executeQuery<T>(CompiledQuery.raw(statement, [...values]))).rows
}

export class OwnedDatabase {
  constructor(private readonly db: Database) {}

  async run<T>(identity: Identity, work: (connection: Connection) => Promise<T>): Promise<T> {
    assertIdentity(identity)
    return this.db.transaction().execute(async tx => {
      await query(tx, "SELECT set_config('cgt.owner_id', $1, true)", [identity.ownerId])
      return work(tx)
    })
  }
}

/** Reject migration-owner, superuser and bypass-RLS credentials at startup. */
export async function assertRuntimeRole(db: Database, role: 'cgt_app' | 'cgt_auth' | 'cgt_billing'): Promise<void> {
  const rows = await query<{ safe: boolean }>(db, `SELECT
    current_user = $1 AND NOT r.rolsuper AND NOT r.rolbypassrls
    AND NOT r.rolcreaterole AND NOT r.rolcreatedb
    AND NOT EXISTS (
      SELECT 1 FROM pg_roles other_role
      WHERE other_role.rolname IN ('cgt_app','cgt_auth','cgt_billing','cgt_maintenance')
      AND other_role.rolname <> $1 AND pg_has_role(session_user, other_role.oid, 'MEMBER')
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname IN ('cgt', 'auth') AND pg_has_role(session_user, t.relowner, 'MEMBER')
    ) AS safe FROM pg_roles r WHERE r.rolname = session_user`, [role])
  if (rows[0]?.safe !== true) throw new Error(`Unsafe ${role} runtime database credentials`)
}
