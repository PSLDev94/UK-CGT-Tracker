import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import { authenticate } from '../src/server/identity'
import { assertRuntimeRole, OwnedDatabase, query } from '../src/server/database'
import { Workspace } from '../src/server/workspace'
import { createAuth, type AuthMail } from '../src/server/auth'
import { Billing, type BillingGateway } from '../src/server/billing'

const csv = readFileSync('tests/fixtures/canonical-trades.csv', 'utf8')
let owner: Client
let app: Kysely<Record<string, never>>
let authDb: Kysely<Record<string, never>>
let billingDb: Kysely<Record<string, never>>
let workspace: Workspace
let env: NodeJS.ProcessEnv
const run = (script: string, overrides: Partial<NodeJS.ProcessEnv> = {}) => execFileSync(process.execPath, [script], { env: { ...env, ...overrides }, stdio: 'pipe' }).toString()
const identity = (id: string) => authenticate(new Headers(), async () => ({ user: { id, emailVerified: true }, session: { expiresAt: new Date(Date.now()+3600000) } }))
async function setup(id: string) {
  await owner.query('INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', [id, `${id}@example.test`])
  const user = await identity(id)
  const { portfolio } = await workspace.overview(user)
  const account = await workspace.addAccount(user, { portfolioId: portfolio.id, broker: 'trading212', label: 'Test account', accountType: 'GIA' })
  return { user, portfolio, account }
}

beforeAll(async () => {
  const source=process.env.POSTGRES_TEST_DATABASE_URL
  if (!source) throw new Error('A disposable local PostgreSQL 18 instance is required')
  const target=new URL(source)
  if (!['localhost','127.0.0.1'].includes(target.hostname) || target.pathname!=='/cgt_qualification') throw new Error('Refusing to run qualification against a non-test database')
  env={...process.env,MIGRATION_DATABASE_URL:source}
  for (const role of ['app','auth','billing','maintenance']) {
    const url=new URL(source)
    url.username=`cgt_runtime_${role}`
    url.password=randomBytes(32).toString('base64url')
    env[`${role.toUpperCase()}_DATABASE_URL`]=url.href
  }
  owner=new Client({connectionString:source})
  await owner.connect()
  const existing=await owner.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('cgt','auth','cgt_migrations')")
  if(existing.rowCount) throw new Error('Qualification requires a fresh disposable database')
  run('scripts/migrate.ts')
  run('scripts/provision-runtime-logins.ts')
  const database=(connectionString: string, role: string) => new Kysely<Record<string,never>>({dialect:new PostgresDialect({pool:new Pool({connectionString,max:12,options:`-c role=${role} -c statement_timeout=15000`})})})
  app=database(env.APP_DATABASE_URL!, 'cgt_app')
  authDb=database(env.AUTH_DATABASE_URL!, 'cgt_auth')
  billingDb=database(env.BILLING_DATABASE_URL!, 'cgt_billing')
  workspace=new Workspace(new OwnedDatabase(app))
})
afterAll(async()=> { await Promise.allSettled([app?.destroy(),authDb?.destroy(),billingDb?.destroy(),owner?.end()]) })

describe('PostgreSQL 18 deployment qualification',()=> {
  it('applies migrations once and verifies existing logins without rotating passwords', async()=> {
    expect(run('scripts/migrate.ts')).toBe('')
    expect(run('scripts/provision-runtime-logins.ts')).toContain('Four separate runtime logins verified')
    expect((await owner.query('SELECT count(*)::int AS count FROM cgt_migrations.applied')).rows[0].count).toBe(6)
    await expect(assertRuntimeRole(app,'cgt_app')).resolves.toBeUndefined()
    await expect(assertRuntimeRole(authDb,'cgt_auth')).resolves.toBeUndefined()
    await expect(assertRuntimeRole(billingDb,'cgt_billing')).resolves.toBeUndefined()
  })

  it('keeps auth and financial tables inaccessible to the opposite login', async()=> {
    await expect(query(app,'SELECT * FROM auth."session"')).rejects.toMatchObject({code:'42501'})
    await expect(query(authDb,'SELECT * FROM cgt.transactions')).rejects.toMatchObject({code:'42501'})
    await expect(query(app,'SET ROLE cgt_auth')).rejects.toMatchObject({code:'42501'})
    await expect(query(billingDb,'SELECT * FROM auth."user"')).rejects.toMatchObject({code:'42501'})
    await expect(query(billingDb,'SELECT * FROM cgt.transactions')).rejects.toMatchObject({code:'42501'})
  })

  it('serialises competing checkout requests and webhook retries with the billing-only login', async()=> {
    const s=await setup('parallel-billing')
    let customers=0
    let sessions=0
    const session={id:'cs_parallel',status:'open' as const,url:'https://checkout.stripe.com/c/pay/fixture'}
    const gateway:BillingGateway={
      createCustomer:async()=>{ customers++; return 'cus_parallel' },
      createCheckout:async()=>{ sessions++; return session },
      checkout:async()=>session, subscriptions:async()=>[], portal:async()=> 'https://billing.stripe.com/p/session/fixture',
    }
    const billing=new Billing(billingDb,gateway,{origin:'https://cgt.example',accountId:'acct_parallel',priceId:'price_parallel',livemode:false})
    await Promise.all(Array.from({length:10},()=>billing.checkout(s.user)))
    expect(customers).toBe(1)
    expect(sessions).toBe(1)
    const results=await Promise.all(Array.from({length:10},()=>billing.event({id:'evt_parallel',type:'invoice.paid',customerId:'cus_parallel'})))
    expect(results.filter(r=>r.outcome==='reconciled')).toHaveLength(1)
    expect(results.filter(r=>r.outcome==='duplicate')).toHaveLength(9)
    expect((await owner.query("SELECT count(*)::int AS count FROM cgt.stripe_events WHERE event_id='evt_parallel'")).rows[0].count).toBe(1)
  })

  it('creates one portfolio under simultaneous first visits', async()=> {
    await owner.query('INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)', ['parallel-owner','parallel@example.test'])
    const user=await identity('parallel-owner')
    const results=await Promise.all(Array.from({length:12},()=>workspace.overview(user)))
    expect(new Set(results.map(result=>result.portfolio.id)).size).toBe(1)
  })

  it('commits simultaneous retries once and serialises simultaneous reversal', async()=> {
    const s=await setup('parallel-import')
    const draft=await workspace.prepareImport(s.user,{accountId:s.account.id,csv,format:'canonical-v1'})
    const results=await Promise.all(Array.from({length:12},()=>workspace.commitImport(s.user,draft.draftId,draft.revision)))
    expect(results.filter(result=>result.outcome==='committed')).toHaveLength(1)
    expect(results.filter(result=>result.outcome==='already_committed')).toHaveLength(11)
    const before=(await workspace.overview(s.user)).portfolio.revision
    await Promise.all(Array.from({length:8},()=>workspace.reverseImport(s.user,draft.draftId,'Concurrent correction')))
    expect((await workspace.overview(s.user)).portfolio.revision).toBe(before+1)
    expect((await owner.query('SELECT count(*)::int AS count FROM cgt.transactions WHERE import_id=$1 AND active',[draft.draftId])).rows[0].count).toBe(0)
  })

  it('requires fresh confirmation when concurrent imports compete on a portfolio revision', async()=> {
    const s=await setup('parallel-revisions')
    const first=await workspace.prepareImport(s.user,{accountId:s.account.id,csv,format:'canonical-v1'})
    const second=await workspace.prepareImport(s.user,{accountId:s.account.id,csv:csv.replaceAll('synthetic-','second-'),format:'canonical-v1'})
    const outcomes=await Promise.all([first,second].map(draft=>workspace.commitImport(s.user,draft.draftId,draft.revision)))
    expect(outcomes.map(result=>result.outcome).sort()).toEqual(['committed','review_changed'])
  })

  it('returns the saved receipt when another request commits between the receipt and draft reads', async()=> {
    const s=await setup('commit-read-race')
    const draft=await workspace.prepareImport(s.user,{accountId:s.account.id,csv,format:'canonical-v1'})
    let interleaved=false
    const interleavedDb=app.withPlugin({
      transformQuery({node}) { return node },
      async transformResult({result}) {
        // Compiled raw SQL bypasses transformQuery. The transaction's identity
        // setup returns one row; its first empty result is the receipt lookup.
        if (!interleaved && result.rows.length===0) {
          interleaved=true
          expect((await workspace.commitImport(s.user,draft.draftId,draft.revision)).outcome).toBe('committed')
        }
        return result
      },
    })
    const competing=new Workspace(new OwnedDatabase(interleavedDb))
    expect((await competing.commitImport(s.user,draft.draftId,draft.revision)).outcome).toBe('already_committed')
    expect(interleaved).toBe(true)
  })

  it('does not leak owner context between concurrent pooled requests', async()=> {
    const a=await setup('isolation-a'),b=await setup('isolation-b')
    const db=new OwnedDatabase(app)
    await Promise.all(Array.from({length:40},(_,index)=> {
      const user=index%2 ? a.user : b.user
      return db.run(user, async tx=> {
        await query(tx,'SELECT pg_sleep(0.005)')
        const rows=await query<{owner_id:string}>(tx,'SELECT owner_id FROM cgt.broker_accounts')
        expect(rows).toHaveLength(1)
        expect(rows[0]!.owner_id).toBe(user.ownerId)
      })
    }))
    expect(await query(app,'SELECT * FROM cgt.broker_accounts')).toEqual([])
  })

  it('completes verification and session revocation using the restricted auth login', async()=> {
    const inbox: AuthMail[]=[]
    const origin='http://localhost:3301'
    const auth=createAuth(authDb,{origin,secret:randomBytes(32).toString('base64url'),secureCookies:false,clientIpHeader:'x-test-client-ip'},async mail=>{inbox.push(mail)})
    const request=(path:string,body:unknown,cookie='')=>auth.handler(new Request(`${origin}/api/v2/auth${path}`,{method:'POST',headers:{origin,'content-type':'application/json','x-test-client-ip':'127.0.0.1',cookie},body:JSON.stringify(body)}))
    const credentials={email:'qualification@example.test',password:'A long qualification password 123!'}
    expect((await request('/sign-up/email',{...credentials,name:'Qualification'})).status).toBe(200)
    expect((await request('/sign-in/email',credentials)).status).toBe(403)
    expect(inbox).toHaveLength(1)
    expect((await auth.handler(new Request(inbox[0]!.url))).status).toBeLessThan(400)
    const login=await request('/sign-in/email',credentials)
    expect(login.status).toBe(200)
    const cookie=login.headers.get('set-cookie')!.split(';')[0]!
    expect((await auth.api.getSession({headers:new Headers({cookie})}))?.user.emailVerified).toBe(true)
    expect((await request('/sign-out',{},cookie)).status).toBe(200)
    expect(await auth.api.getSession({headers:new Headers({cookie})})).toBeNull()
  })

  it('fails closed when an existing runtime login acquires an extra membership', async()=> {
    await owner.query('CREATE ROLE qualification_unexpected NOLOGIN')
    await owner.query('GRANT qualification_unexpected TO cgt_runtime_app')
    try { expect(()=>run('scripts/provision-runtime-logins.ts')).toThrow() }
    finally { await owner.query('REVOKE qualification_unexpected FROM cgt_runtime_app') }
    expect(run('scripts/provision-runtime-logins.ts')).toContain('verified')
  })

  it('rejects mismatched supplied credentials without rotating an existing login', ()=> {
    const url=new URL(env.APP_DATABASE_URL!)
    url.password=randomBytes(32).toString('base64url')
    expect(()=>run('scripts/provision-runtime-logins.ts',{APP_DATABASE_URL:url.href})).toThrow()
    expect(run('scripts/provision-runtime-logins.ts')).toContain('verified')
  })
})
