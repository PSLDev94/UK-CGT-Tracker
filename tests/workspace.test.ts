import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { testDatabase } from './helpers/database'
import { authenticate, type Identity } from '../src/server/identity'
import { assertRuntimeRole, OwnedDatabase, query } from '../src/server/database'
import { Workspace } from '../src/server/workspace'

const csv = readFileSync(new URL('./fixtures/canonical-trades.csv', import.meta.url), 'utf8')
let database: Awaited<ReturnType<typeof testDatabase>>
let workspace: Workspace
const identity = (id: string) => authenticate(new Headers(), async () => ({ user: { id, emailVerified: true }, session: { expiresAt: new Date(Date.now() + 3600000) } }))
async function owner(id: string) {
  await database.pg.exec('RESET ROLE')
  await database.pg.query('INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`])
  await database.pg.exec('SET ROLE cgt_app')
  return identity(id)
}
async function setup(id: string) {
  const user = await owner(id)
  const { portfolio } = await workspace.overview(user)
  const account = await workspace.addAccount(user, { portfolioId: portfolio.id, broker: 'trading212', label: 'Invest', accountType: 'GIA' })
  return { user, portfolio, account }
}
const prepare = (u: Identity, id: string, file = csv) => workspace.prepareImport(u, { accountId: id, csv: file, format: 'canonical-v1' })

beforeAll(async () => {
  database = await testDatabase('cgt_app')
  workspace = new Workspace(new OwnedDatabase(database.db))
}, 30000)
afterAll(async () => { await database.db.destroy() })

describe('authenticated PostgreSQL application workflow', () => {
  it('refuses a forged identity even if it has the correct shape', async () => {
    await expect(workspace.overview({ ownerId: 'forged' } as Identity)).rejects.toMatchObject({ status: 401 })
  })

  it('creates one shared portfolio across repeated visits', async () => {
    const user = await owner('one-portfolio')
    const first = await workspace.overview(user)
    expect((await workspace.overview(user)).portfolio.id).toBe(first.portfolio.id)
  })

  it('does not read or mutate another user’s accounts, drafts or imports', async () => {
    const a = await setup('alice-workflow')
    const b = await setup('bob-workflow')
    const draft = await prepare(a.user, a.account.id)
    await expect(prepare(b.user, a.account.id)).rejects.toMatchObject({ status: 404 })
    await expect(workspace.commitImport(b.user, draft.draftId, draft.revision)).rejects.toMatchObject({ status: 404 })
    await expect(workspace.addAccount(b.user, { portfolioId: a.portfolio.id, broker: 'hl', label: 'Forged', accountType: 'GIA' })).rejects.toMatchObject({ status: 404 })
    await workspace.commitImport(a.user, draft.draftId, draft.revision)
    await expect(workspace.reverseImport(b.user, draft.draftId, 'Wrong file')).rejects.toMatchObject({ status: 404 })
    expect((await workspace.overview(b.user)).imports).toHaveLength(0)
  })

  it('reconciles every record, commits once and removes the raw CSV', async () => {
    const s = await setup('commit-once')
    const draft = await prepare(s.user, s.account.id)
    expect(draft.review.counts).toEqual({ total: 3, accepted: 2, excluded: 1, duplicate: 0, needsReview: 0 })
    expect(draft.accountId).toBe(s.account.id)
    expect((await workspace.reviewImport(s.user, draft.draftId)).accountId).toBe(s.account.id)
    const result = await workspace.commitImport(s.user, draft.draftId, draft.revision)
    expect(result.outcome).toBe('committed')
    expect((await workspace.commitImport(s.user, draft.draftId, draft.revision)).outcome).toBe('already_committed')
    await new OwnedDatabase(database.db).run(s.user, async tx => {
      expect(await query(tx, 'SELECT * FROM cgt.transactions')).toHaveLength(2)
      expect(await query(tx, 'SELECT * FROM cgt.import_drafts')).toHaveLength(0)
      const receipts = await query<{ record_receipts: unknown[] }>(tx, 'SELECT record_receipts FROM cgt.imports')
      expect(receipts[0]!.record_receipts).toHaveLength(3)
    })
    // Transaction-local identity must not leak to the next pooled request.
    expect(await query(database.db, 'SELECT * FROM cgt.transactions')).toHaveLength(0)
  })

  it('requires another confirmation when the portfolio changes after preview', async () => {
    const s = await setup('stale-preview')
    const draft = await prepare(s.user, s.account.id)
    await workspace.addAccount(s.user, { portfolioId: s.portfolio.id, broker: 'hl', label: 'Other broker', accountType: 'GIA' })
    const changed = await workspace.commitImport(s.user, draft.draftId, draft.revision)
    expect(changed.outcome).toBe('review_changed')
    expect((await workspace.overview(s.user)).imports).toHaveLength(0)
    if (changed.outcome !== 'review_changed') throw new Error('Expected changed review')
    expect((await workspace.commitImport(s.user, draft.draftId, changed.revision)).outcome).toBe('committed')
  })

  it('rejects unsupported formats and malformed rows without partial writes', async () => {
    const s = await setup('unsupported')
    const draft = await workspace.prepareImport(s.user, { accountId: s.account.id, csv, format: 'native' })
    expect(draft.review.status).toBe('unsupported')
    expect((await workspace.commitImport(s.user, draft.draftId, draft.revision)).outcome).toBe('needs_review')
    expect((await workspace.overview(s.user)).imports).toHaveLength(0)
  })

  it('rolls back the receipt and all writes if persistence fails mid-import', async () => {
    const s = await setup('transaction-rollback')
    const draft = await prepare(s.user, s.account.id)
    await database.pg.exec('RESET ROLE; REVOKE INSERT ON cgt.transactions FROM cgt_app; SET ROLE cgt_app')
    try {
      await expect(workspace.commitImport(s.user, draft.draftId, draft.revision)).rejects.toThrow(/permission denied/)
    } finally { await database.pg.exec('RESET ROLE; GRANT INSERT ON cgt.transactions TO cgt_app; SET ROLE cgt_app') }
    expect((await workspace.overview(s.user)).imports).toHaveLength(0)
    expect((await workspace.commitImport(s.user, draft.draftId, draft.revision)).outcome).toBe('committed')
  })

  it('refuses discarded or expired drafts and caps uncommitted sensitive files', async () => {
    const s = await setup('expiry')
    const draft = await prepare(s.user, s.account.id)
    await workspace.discardDraft(s.user, draft.draftId)
    await expect(workspace.commitImport(s.user, draft.draftId, draft.revision)).rejects.toMatchObject({ code: 'PREVIEW_EXPIRED' })
    const expiring = await prepare(s.user, s.account.id)
    await new OwnedDatabase(database.db).run(s.user, tx => query(tx, "UPDATE cgt.import_drafts SET expires_at = now() - interval '1 second'"))
    await expect(workspace.commitImport(s.user, expiring.draftId, expiring.revision)).rejects.toMatchObject({ code: 'PREVIEW_EXPIRED' })
    for (let i = 0; i < 5; i++) await prepare(s.user, s.account.id)
    await expect(prepare(s.user, s.account.id)).rejects.toMatchObject({ code: 'DRAFT_LIMIT' })
  })

  it('calculates persisted trades, retains snapshots and invalidates them on reversal', async () => {
    const s = await setup('calculate-reverse')
    const draft = await prepare(s.user, s.account.id)
    await workspace.commitImport(s.user, draft.draftId, draft.revision)
    const input = { portfolioId: s.portfolio.id, taxYear: '2024-25', historyThrough: '2025-05-05', confirmedAccountIds: [s.account.id] }
    const calculation = await workspace.calculate(s.user, input)
    expect(calculation.result.status).toBe('complete')
    expect(calculation.result.summary?.netGainGBP).toBe('391.00')
    expect(calculation.coverageConfirmed).toBe(true)
    expect((await workspace.calculate(s.user, input)).runId).toBe(calculation.runId)
    expect((await workspace.overview(s.user)).calculations).toHaveLength(1)
    await workspace.reverseImport(s.user, draft.draftId, 'Reimport with corrected values')
    expect((await workspace.overview(s.user)).calculations).toHaveLength(0)
    await new OwnedDatabase(database.db).run(s.user, async tx => {
      expect(await query(tx, 'SELECT * FROM cgt.calculation_runs')).toHaveLength(1)
      expect(await query(tx, 'SELECT * FROM cgt.transactions WHERE NOT active')).toHaveLength(2)
    })
    const replacement = await prepare(s.user, s.account.id)
    expect(replacement.review.counts.accepted).toBe(2)
    expect((await workspace.commitImport(s.user, replacement.draftId, replacement.revision)).outcome).toBe('committed')
  })

  it('accepts today in London just after BST midnight but rejects tomorrow', async () => {
    const s = await setup('london-history-cutoff')
    const draft = await prepare(s.user, s.account.id)
    await workspace.commitImport(s.user, draft.draftId, draft.revision)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-05-04T23:30:00Z'))
    try {
      const input = { portfolioId: s.portfolio.id, taxYear: '2024-25', historyThrough: '2025-05-05', confirmedAccountIds: [s.account.id] }
      expect((await workspace.calculate(s.user, input)).result.status).toBe('complete')
      await expect(workspace.calculate(s.user, { ...input, historyThrough: '2025-05-06' })).rejects.toMatchObject({ code: 'FUTURE_HISTORY' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not assert coverage when an account is missing, and blocks pending previews', async () => {
    const s = await setup('coverage')
    const draft = await prepare(s.user, s.account.id)
    const input = { portfolioId: s.portfolio.id, taxYear: '2024-25', historyThrough: '2025-05-05', confirmedAccountIds: [] }
    await expect(workspace.calculate(s.user, input)).rejects.toMatchObject({ code: 'PENDING_IMPORTS' })
    await workspace.commitImport(s.user, draft.draftId, draft.revision)
    expect((await workspace.calculate(s.user, input)).coverageConfirmed).toBe(false)
    await expect(workspace.calculate(s.user, { ...input, historyThrough: '2099-01-01' })).rejects.toMatchObject({ code: 'FUTURE_HISTORY' })
  })

  it('cannot access authentication secrets using financial credentials', async () => {
    await expect(query(database.db, 'SELECT * FROM auth."session"')).rejects.toThrow(/permission denied/)
    await expect(query(database.db, 'SELECT * FROM auth."account"')).rejects.toThrow(/permission denied/)
  })

  it('paginates the complete import history without losing or repeating receipts', async () => {
    const s = await setup('history-pages')
    for (let index=0; index<26; index++) {
      const draft = await prepare(s.user, s.account.id, csv.replace('synthetic-buy', `buy-${index}`).replace('synthetic-sell', `sell-${index}`))
      await workspace.commitImport(s.user, draft.draftId, draft.revision)
    }
    const first = await workspace.importHistory(s.user, 1)
    const second = await workspace.importHistory(s.user, 2)
    expect(first.total).toBe(26)
    expect(first.imports).toHaveLength(25)
    expect(second.imports).toHaveLength(1)
    expect(new Set([...first.imports,...second.imports].map(row => (row as {id:string}).id)).size).toBe(26)
    await expect(workspace.importHistory(s.user,0)).rejects.toMatchObject({code:'INVALID_PAGE'})
  })

  it('rejects privileged runtime credentials and accepts a dedicated least-privilege login', async () => {
    await expect(assertRuntimeRole(database.db, 'cgt_app')).rejects.toThrow(/Unsafe/)
    // Separate sessions: changing SESSION AUTHORIZATION must not contaminate later tests.
    for (const mixedPrivileges of [false, true]) {
      const isolated = await testDatabase('cgt_app')
      try {
        await isolated.pg.exec('RESET ROLE; CREATE ROLE runtime_test LOGIN; GRANT cgt_app TO runtime_test')
        if (mixedPrivileges) await isolated.pg.exec('GRANT cgt_billing TO runtime_test')
        await isolated.pg.exec('SET SESSION AUTHORIZATION runtime_test; SET ROLE cgt_app')
        if (mixedPrivileges) await expect(assertRuntimeRole(isolated.db, 'cgt_app')).rejects.toThrow(/Unsafe/)
        else await expect(assertRuntimeRole(isolated.db, 'cgt_app')).resolves.toBeUndefined()
      } finally { await isolated.db.destroy() }
    }
  }, 15000)

  it('limits expensive requests across application instances and resets expired windows', async () => {
    const s = await setup('rate-limit')
    for (let i = 0; i < 10; i++) await workspace.consumeRequest(s.user, 'calculate')
    const otherInstance = new Workspace(new OwnedDatabase(database.db))
    await expect(otherInstance.consumeRequest(s.user, 'calculate')).rejects.toMatchObject({ status: 429 })
    await new OwnedDatabase(database.db).run(s.user, tx => query(tx, "UPDATE cgt.request_limits SET window_start=now()-interval '2 minutes'"))
    await expect(otherInstance.consumeRequest(s.user, 'calculate')).resolves.toBeUndefined()
  })

  it('allows cleanup to delete only expired previews, without reading CSV contents', async () => {
    const s = await setup('cleanup')
    const expired = await prepare(s.user, s.account.id)
    const fresh = await prepare(s.user, s.account.id)
    await new OwnedDatabase(database.db).run(s.user, tx => query(tx, "UPDATE cgt.import_drafts SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.draftId]))
    await database.pg.exec('RESET ROLE; SET ROLE cgt_maintenance')
    try {
      await expect(query(database.db, 'SELECT csv FROM cgt.import_drafts')).rejects.toThrow(/permission denied/)
      const removed = await query<{ id: string }>(database.db, 'DELETE FROM cgt.import_drafts RETURNING id')
      expect(removed.map(row => row.id)).toContain(expired.draftId)
      expect(removed.map(row => row.id)).not.toContain(fresh.draftId)
    } finally { await database.pg.exec('RESET ROLE; SET ROLE cgt_app') }
    expect((await workspace.reviewImport(s.user, fresh.draftId)).review.status).toBe('ready')
  })
})

it("persists native classification confirmation through resume and server-side commit", async () => {
  const s = await setup("native-confirmation");
  const native = readFileSync(
    new URL("./fixtures/brokers/trading212-gbp.csv", import.meta.url),
    "utf8",
  );
  const unconfirmed = await workspace.prepareImport(s.user, {
    accountId: s.account.id,
    csv: native,
    format: "native",
  });
  expect(unconfirmed.review.status).toBe("needs_review");
  expect(
    (
      await workspace.commitImport(
        s.user,
        unconfirmed.draftId,
        unconfirmed.revision,
      )
    ).outcome,
  ).toBe("needs_review");
  const confirmed = await workspace.prepareImport(s.user, {
    accountId: s.account.id,
    csv: native,
    format: "native",
    ordinarySharesConfirmed: true,
  });
  expect(
    (await workspace.reviewImport(s.user, confirmed.draftId)).review.status,
  ).toBe("ready");
  expect(
    (
      await workspace.commitImport(
        s.user,
        confirmed.draftId,
        confirmed.revision,
      )
    ).outcome,
  ).toBe("committed");
  await new OwnedDatabase(database.db).run(s.user, async (tx) => {
    const rows = await query<{
      provenance: {
        native: {
          ordinarySharesConfirmed: boolean;
          fields: Record<string, string>;
        };
      };
    }>(tx, "SELECT provenance FROM cgt.transactions");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.provenance.native.ordinarySharesConfirmed).toBe(true);
    expect(rows[0]!.provenance.native.fields.ID).toContain("SYNTHETIC-T-");
  });
});
