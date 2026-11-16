import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getMigrations } from 'better-auth/db/migration'
import { authOptions, createAuth, type AuthMail } from '../src/server/auth'
import { authenticate } from '../src/server/identity'
import { query } from '../src/server/database'
import { testDatabase } from './helpers/database'

const origin = 'http://localhost:3000'
const config = { origin, secret: 'local-test-only-secret-with-at-least-32-characters', secureCookies: false, clientIpHeader: 'x-test-ip' }
const inbox: AuthMail[] = []
const sendMail = async (mail: AuthMail) => { inbox.push(mail) }
let database: Awaited<ReturnType<typeof testDatabase>>
let auth: ReturnType<typeof createAuth>
let nextIp = 1
const password = 'A long test password 123!'

function request(path: string, body?: unknown, cookie?: string, ip = `192.0.2.${nextIp++}`) {
  return auth.handler(new Request(`${origin}/api/v2/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin, 'content-type': 'application/json', 'x-test-ip': ip, ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }))
}
const cookieOf = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')

async function verifiedUser(email: string) {
  const signUp = await request('/sign-up/email', { email, password, name: 'Test investor', callbackURL: `${origin}/workspace` })
  expect(signUp.status).toBe(200)
  const mail = inbox.findLast(value => value.to === email && value.kind === 'verification')!
  expect(mail).toBeDefined()
  const verification = await auth.handler(new Request(mail.url))
  expect([200, 302]).toContain(verification.status)
  const login = await request('/sign-in/email', { email, password })
  expect(login.status).toBe(200)
  return { cookie: cookieOf(login), login }
}

beforeAll(async () => {
  database = await testDatabase('cgt_auth')
  auth = createAuth(database.db, config, sendMail)
}, 30000)
afterAll(async () => { await database.db.destroy() })

describe('real Better Auth handlers with PostgreSQL and captured email', () => {
  it('requires email verification and stores a password hash, never the password', async () => {
    const email = 'verification@example.test'
    const response = await request('/sign-up/email', { email, password, name: 'Investor' })
    expect(response.status).toBe(200)
    expect(cookieOf(response)).not.toContain('session_token')
    expect((await request('/sign-in/email', { email, password })).status).toBe(403)
    const rows = await query<{ password: string }>(database.db, 'SELECT password FROM auth."account"')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.password).not.toBe(password)
    expect(inbox.find(mail => mail.to === email)?.kind).toBe('verification')
  })

  it('checks verified persisted sessions and sets HttpOnly/SameSite cookies', async () => {
    const { cookie, login } = await verifiedUser('session@example.test')
    const headers = new Headers({ cookie })
    const session = await auth.api.getSession({ headers })
    expect(session?.user.emailVerified).toBe(true)
    expect((await authenticate(headers, h => auth.api.getSession({ headers: h }))).ownerId).toBe(session!.user.id)
    expect(login.headers.get('set-cookie')).toContain('HttpOnly')
    expect(login.headers.get('set-cookie')).toContain('SameSite=Lax')
    expect((await request('/sign-out', {}, cookie)).status).toBe(200)
    await expect(authenticate(headers, h => auth.api.getSession({ headers: h }))).rejects.toMatchObject({ status: 401 })
  })

  it('resets passwords, revokes old sessions and rejects token reuse', async () => {
    const email = 'reset@example.test'
    const { cookie } = await verifiedUser(email)
    expect((await request('/request-password-reset', { email, redirectTo: `${origin}/reset-password` })).status).toBe(200)
    const mail = inbox.findLast(value => value.to === email && value.kind === 'password-reset')!
    const resetUrl = new URL(mail.url)
    // Better Auth emails its verification endpoint, which redirects to the UI with a token.
    const redirect = await auth.handler(new Request(resetUrl))
    const token = new URL(redirect.headers.get('location')!, origin).searchParams.get('token')!
    expect(token).toBeTruthy()
    const nextPassword = 'Different long test password 456!'
    expect((await request('/reset-password', { token, newPassword: nextPassword })).status).toBe(200)
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull()
    expect((await request('/sign-in/email', { email, password })).status).toBe(401)
    expect((await request('/sign-in/email', { email, password: nextPassword })).status).toBe(200)
    expect((await request('/reset-password', { token, newPassword: password })).status).toBe(400)
  })

  it('uses the same reset response for registered and unknown emails', async () => {
    const known = await request('/request-password-reset', { email: 'session@example.test', redirectTo: `${origin}/reset-password` })
    const unknown = await request('/request-password-reset', { email: 'not-registered@example.test', redirectTo: `${origin}/reset-password` })
    expect(known.status).toBe(unknown.status)
    expect(await known.json()).toEqual(await unknown.json())
    expect(inbox.some(mail => mail.to === 'not-registered@example.test')).toBe(false)
  })

  it('rejects foreign origins and external password-reset redirects', async () => {
    const response = await auth.handler(new Request(`${origin}/api/v2/auth/sign-in/email`, {
      method: 'POST', headers: { origin: 'https://untrusted.example', 'content-type': 'application/json', cookie: 'cgt.session_token=fake' },
      body: JSON.stringify({ email: 'session@example.test', password }),
    }))
    expect(response.status).toBe(403)
    expect((await request('/request-password-reset', { email: 'session@example.test', redirectTo: 'https://untrusted.example' })).status).toBe(403)
  })

  it('enforces database-backed authentication rate limits', async () => {
    const ip = '198.51.100.15'
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await request('/sign-in/email', { email: 'unknown@example.test', password }, undefined, ip)).status)
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[5]).toBe(429)
    expect((await query(database.db, 'SELECT * FROM auth."rateLimit"')).length).toBeGreaterThan(0)
  })

  it('rejects missing, unverified and expired identities', async () => {
    await expect(authenticate(new Headers(), async () => null)).rejects.toMatchObject({ status: 401 })
    await expect(authenticate(new Headers(), async () => ({ user: { id: 'x', emailVerified: false }, session: { expiresAt: new Date(Date.now() + 10000) } }))).rejects.toMatchObject({ status: 403 })
    await expect(authenticate(new Headers(), async () => ({ user: { id: 'x', emailVerified: true }, session: { expiresAt: new Date(0) } }))).rejects.toMatchObject({ status: 401 })
  })

  it('has no auth schema drift and no access to financial tables', async () => {
    const migrations = await getMigrations(authOptions(database.db, config, sendMail))
    expect(migrations.toBeCreated).toEqual([])
    expect(migrations.toBeAdded).toEqual([])
    expect(migrations.toBeAddedIndexes).toEqual([])
    await expect(query(database.db, 'SELECT * FROM cgt.transactions')).rejects.toThrow(/permission denied/)
    await expect(query(database.db, 'SELECT * FROM cgt.billing_accounts')).rejects.toThrow(/permission denied/)
  })
})
