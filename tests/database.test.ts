import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const migration = readFileSync(new URL('../db/migrations/0001_financial_core.sql', import.meta.url), 'utf8')
const alicePortfolio = '00000000-0000-4000-8000-000000000001'
const bobPortfolio = '00000000-0000-4000-8000-000000000002'

beforeAll(async () => {
  await db.exec(migration)
  await db.exec(`INSERT INTO cgt.portfolios(id,owner_id,name) VALUES ('${alicePortfolio}','alice','Alice'),('${bobPortfolio}','bob','Bob');
    INSERT INTO cgt.billing_accounts(owner_id,stripe_customer_id,stripe_account_id,livemode,subscription_status) VALUES ('alice','cus_synthetic','acct_synthetic',false,'active');
    SET ROLE cgt_app;`)
}, 30000)
afterAll(async () => { await db.close() })

describe('fresh PostgreSQL ownership and billing boundaries', () => {
  it('fails closed with no authenticated owner context', async () => {
    const result = await db.query('SELECT * FROM cgt.portfolios')
    expect(result.rows).toHaveLength(0)
  })

  it('allows only the authenticated owner to read rows', async () => {
    await db.query("SELECT set_config('cgt.owner_id', $1, false)", ['alice'])
    const result = await db.query<{ name: string }>('SELECT name FROM cgt.portfolios')
    expect(result.rows).toEqual([{ name: 'Alice' }])
  })

  it('rejects forging another owner on insert or update', async () => {
    await expect(db.query("INSERT INTO cgt.portfolios(owner_id,name) VALUES ('bob','Forged')")).rejects.toThrow(/row-level security/)
    await expect(db.query("UPDATE cgt.portfolios SET owner_id='bob' WHERE owner_id='alice'")).rejects.toThrow(/row-level security/)
  })

  it('rejects cross-owner parent relationships even with a valid UUID', async () => {
    await expect(db.query("INSERT INTO cgt.broker_accounts(portfolio_id,owner_id,broker,account_type,label) VALUES ($1,'alice','trading212','GIA','Forged')", [bobPortfolio])).rejects.toThrow(/foreign key/)
  })

  it('cannot grant itself a subscription or edit Stripe identifiers', async () => {
    await expect(db.query("UPDATE cgt.billing_accounts SET subscription_status='active'")).rejects.toThrow(/permission denied/)
    await expect(db.query("INSERT INTO cgt.billing_accounts(owner_id,stripe_customer_id,stripe_account_id,livemode,subscription_status) VALUES ('alice','cus_fake','acct_fake',false,'active')")).rejects.toThrow(/permission denied/)
  })

  it('cannot alter immutable calculation snapshots or webhook evidence', async () => {
    await expect(db.query('DELETE FROM cgt.calculation_runs')).rejects.toThrow(/permission denied/)
    await expect(db.query('SELECT * FROM cgt.stripe_events')).rejects.toThrow(/permission denied/)
  })

  it('rolls back a failed multi-write operation', async () => {
    await expect(db.transaction(async tx => {
      await tx.query("INSERT INTO cgt.portfolios(owner_id,name) VALUES ('alice','Rollback test')")
      await tx.query("INSERT INTO cgt.portfolios(owner_id,name) VALUES ('bob','Forbidden')")
    })).rejects.toThrow()
    const result = await db.query("SELECT * FROM cgt.portfolios WHERE name='Rollback test'")
    expect(result.rows).toHaveLength(0)
  })

  it('drops request identity when a transaction-local setting ends', async () => {
    await db.query("SELECT set_config('cgt.owner_id', '', false)")
    await db.transaction(async tx => {
      await tx.query("SELECT set_config('cgt.owner_id', $1, true)", ['bob'])
      expect((await tx.query('SELECT * FROM cgt.portfolios')).rows).toHaveLength(1)
    })
    expect((await db.query('SELECT * FROM cgt.portfolios')).rows).toHaveLength(0)
  })

  it('enforces import reconciliation and refuses committed unresolved rows', async () => {
    await db.transaction(async tx => {
      await tx.query("SELECT set_config('cgt.owner_id', 'alice', true)")
      const account = await tx.query<{ id: string }>("INSERT INTO cgt.broker_accounts(portfolio_id,owner_id,broker,account_type,label) VALUES ($1,'alice','trading212','GIA','Test account') RETURNING id", [alicePortfolio])
      const accountId = account.rows[0]!.id
      // Savepoints let the test inspect both constraints without discarding setup.
      await tx.exec('SAVEPOINT bad_counts')
      await expect(tx.query("INSERT INTO cgt.imports(account_id,owner_id,file_digest,parser_version,status,record_count,accepted_count,excluded_count,duplicate_count,review_count) VALUES ($1,'alice',$2,'v1','review',2,1,0,0,0)", [accountId, 'a'.repeat(64)])).rejects.toThrow(/check constraint/)
      await tx.exec('ROLLBACK TO SAVEPOINT bad_counts')
      await expect(tx.query("INSERT INTO cgt.imports(account_id,owner_id,file_digest,parser_version,status,record_count,accepted_count,excluded_count,duplicate_count,review_count) VALUES ($1,'alice',$2,'v1','committed',2,1,0,0,1)", [accountId, 'a'.repeat(64)])).rejects.toThrow(/check constraint/)
      await tx.exec('ROLLBACK TO SAVEPOINT bad_counts')
    })
  })

  it('records a Stripe event once, with mode separation', async () => {
    await db.exec('RESET ROLE; SET ROLE cgt_billing')
    try {
      const insert = "INSERT INTO cgt.stripe_events(stripe_account_id,livemode,event_id,event_type) VALUES ('acct_synthetic',$1,'evt_synthetic','invoice.paid')"
      await db.query(insert, [false])
      await expect(db.query(insert, [false])).rejects.toThrow(/unique constraint/)
      await db.query(insert, [true])
      expect((await db.query('SELECT * FROM cgt.stripe_events')).rows).toHaveLength(2)
      await expect(db.query('SELECT * FROM cgt.portfolios')).rejects.toThrow(/permission denied/)
    } finally {
      await db.exec('RESET ROLE; SET ROLE cgt_app')
    }
  })
})
