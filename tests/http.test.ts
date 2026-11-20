import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { testDatabase } from './helpers/database'
import { OwnedDatabase } from '../src/server/database'
import { Workspace } from '../src/server/workspace'
import { createWorkspaceHandler } from '../src/server/workspace-api'
import { errorResponse, limitedBody } from '../src/server/http'

const origin = 'https://staging.example.test'
let database: Awaited<ReturnType<typeof testDatabase>>
let workspace: Workspace
let handler: ReturnType<typeof createWorkspaceHandler>
const session = { user: { id: 'http-user', emailVerified: true }, session: { expiresAt: new Date(Date.now() + 3600000) } }
const request = (body: unknown, headers = {}) => new Request(`${origin}/api/v2/workspace`, { method: 'POST',
  headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

beforeAll(async () => {
  database = await testDatabase('cgt_app')
  await database.pg.exec(`RESET ROLE; INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES('http-user','HTTP test','http@example.test',true); SET ROLE cgt_app;`)
  workspace = new Workspace(new OwnedDatabase(database.db))
  handler = createWorkspaceHandler(workspace, async () => session, origin)
}, 30000)
afterAll(async () => { await database.db.destroy() })

describe('private HTTP request boundary', () => {
  it('rejects unauthenticated, unverified and cross-origin requests', async () => {
    const signedOut = createWorkspaceHandler(workspace, async () => null, origin)
    expect((await signedOut(request({ action: 'overview' }))).status).toBe(401)
    const unverified = createWorkspaceHandler(workspace, async () => ({ ...session, user: { ...session.user, emailVerified: false } }), origin)
    expect((await unverified(request({ action: 'overview' }))).status).toBe(403)
    expect((await handler(request({ action: 'overview' }, { origin: 'https://untrusted.example' }))).status).toBe(403)
    expect((await handler(request({ action: 'overview' }, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
  })

  it('returns uncached private responses and ignores a forged owner field', async () => {
    const response = await handler(request({ action: 'overview', ownerId: 'someone-else' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).portfolio.name).toBe('Personal investments')
  })

  it('validates body shape, content type, actions and fields', async () => {
    expect((await handler(request([]))).status).toBe(400)
    expect((await handler(request({ action: 'add-account' }))).status).toBe(400)
    expect((await handler(request({ action: 'unknown' }))).status).toBe(400)
    expect((await handler(request({}, { 'content-type': 'text/plain' }))).status).toBe(415)
    const malformed = new Request(`${origin}/api/v2/workspace`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{' })
    expect((await handler(malformed)).status).toBe(400)
  })

  it('enforces streamed byte limits regardless of Content-Length and rejects invalid UTF-8', async () => {
    await expect(limitedBody(new Request(origin, { method: 'POST', body: '123456', headers: { 'content-length': '1' } }), 5)).rejects.toMatchObject({ status: 413 })
    await expect(limitedBody(new Request(origin, { method: 'POST', body: new Uint8Array([0xc3, 0x28]) }), 5)).rejects.toMatchObject({ code: 'INVALID_ENCODING' })
  })

  it('paginates every review record and commits server evidence, not client-supplied rows', async () => {
    const overview = await (await handler(request({ action: 'overview' }))).json()
    const account = await (await handler(request({ action: 'add-account', portfolioId: overview.portfolio.id, broker: 'trading212', accountType: 'GIA', label: 'HTTP test' }))).json()
    const fixture = readFileSync(new URL('./fixtures/canonical-trades.csv', import.meta.url), 'utf8').trim().split('\n')
    const csv = [fixture[0], ...Array.from({ length: 101 }, (_, i) => fixture[1]!.replace('synthetic-buy', `buy-${i}`))].join('\n')
    const preview = await (await handler(request({ action: 'prepare-import', accountId: account.id, format: 'canonical-v1', csv }))).json()
    expect(preview.review.counts.accepted).toBe(101)
    expect(preview.review.records).toHaveLength(100)
    const second = await (await handler(request({ action: 'review-import', draftId: preview.draftId, page: 2 }))).json()
    expect(second.review.records).toHaveLength(1)
    expect(second.review.records[0].record).toBe(102)
    const saved = await (await handler(request({ action: 'commit-import', draftId: preview.draftId, revision: second.revision,
      review: { counts: { accepted: 999999 }, records: [] }, ownerId: 'forged' }))).json()
    expect(saved.outcome).toBe('committed')
    expect(saved.counts.accepted).toBe(101)
  })

  it('does not expose database errors or financial values in responses or logs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = errorResponse(new Error('private-database-password-and-csv-record'))
      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('private-database')
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-database')
    } finally { log.mockRestore() }
  })
})
