import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdtempSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import { authenticate } from '../src/server/identity'
import { assertRuntimeRole, OwnedDatabase, query } from '../src/server/database'
import { Workspace } from '../src/server/workspace'
import { createAuth, type AuthMail } from '../src/server/auth'
import { Billing, type BillingGateway } from '../src/server/billing'
import { qualifyBillingLifecycle } from './billing-lifecycle'
import { qualifyReviewedOpeningPool } from './reviewed-opening-pool'
import { recordReviewedOpeningPool } from '../src/server/reviewed-opening-pools'

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
    expect((await owner.query('SELECT count(*)::int AS count FROM cgt_migrations.applied')).rows[0].count).toBe(readdirSync('db/migrations').filter(f=>f.endsWith('.sql')).length)
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

  it('checks mapped signed billing events through to both paid report downloads', async()=> {
    const s=await setup('lifecycle-billing')
    const native=readFileSync('tests/fixtures/brokers/trading212-gbp.csv','utf8')
    const draft=await workspace.prepareImport(s.user,{accountId:s.account.id,csv:native,format:'native',ordinarySharesConfirmed:true})
    await workspace.commitImport(s.user,draft.draftId,draft.revision,draft.reviewVersion)
    const run=await workspace.calculate(s.user,{portfolioId:s.portfolio.id,taxYear:'2024-25',historyThrough:'2025-05-05',personalScopeConfirmed:true, scopeDeclaration: "personal-market-trades-v2",confirmedAccountIds:[s.account.id]})
    expect(run.result.summary?.netGainGBP).toBe('5.25')
    await qualifyBillingLifecycle(billingDb,workspace,s.user,run.runId)
  })

  it('keeps reviewed opening positions restricted, traceable and current', async()=> {
    const s=await setup('reviewed-opening')
    const operator=new Kysely<Record<string,never>>({dialect:new PostgresDialect({pool:new Pool({connectionString:env.MIGRATION_DATABASE_URL})})})
    try {
      await qualifyReviewedOpeningPool({operator,app,workspace,user:s.user,portfolioId:s.portfolio.id,accountId:s.account.id})
    } finally { await operator.destroy() }
  })

  it('uses certified ownership to resolve a missing opening holding before a 30-day repurchase', async()=> {
    const s=await setup('opening-ownership')
    const data=[
      csv.split('\n')[0],
      'sold,2024-08-01,SELL,US0378331005,1,200,0,GBP,1,ORDINARY_SHARE',
      'bought,2024-08-15,BUY,US0378331005,1,180,0,GBP,1,ORDINARY_SHARE',
    ].join('\n')
    const draft=await workspace.prepareImport(s.user,{accountId:s.account.id,csv:data,format:'canonical-v1'})
    await workspace.commitImport(s.user,draft.draftId,draft.revision,draft.reviewVersion)
    const input={portfolioId:s.portfolio.id,taxYear:'2024-25',historyThrough:'2025-05-05',personalScopeConfirmed:true, scopeDeclaration: "personal-market-trades-v2",confirmedAccountIds:[s.account.id]}
    expect((await workspace.calculate(s.user,input)).result.summary).toBeNull()
    const operator=new Kysely<Record<string,never>>({dialect:new PostgresDialect({pool:new Pool({connectionString:env.MIGRATION_DATABASE_URL})})})
    try {
      await recordReviewedOpeningPool(operator,{ownerId:s.user.ownerId,portfolioId:s.portfolio.id,
        expectedRevision:(await workspace.overview(s.user)).portfolio.revision,securityId:'US0378331005',asOf:'2024-04-05',
        quantity:'1',costGBP:'100',caseReference:'OPEN-1',sourceReference:'BASIS-1'},true)
    } finally { await operator.destroy() }
    const result=(await workspace.calculate(s.user,input)).result
    expect(result.status).toBe('complete')
    expect(result.summary?.netGainGBP).toBe('20.00')
    expect(result.disposals[0]?.matches[0]?.rule).toBe('THIRTY_DAY')
  })

  it('persists native confirmation and reconciles overlapping files under real role isolation', async()=> {
    const s=await setup('native-postgres')
    const native=readFileSync('tests/fixtures/brokers/trading212-gbp.csv','utf8')
    const draft=await workspace.prepareImport(s.user,{accountId:s.account.id,csv:native,format:'native',ordinarySharesConfirmed:true})
    expect((await workspace.reviewImport(s.user,draft.draftId)).review.status).toBe('ready')
    expect((await workspace.commitImport(s.user,draft.draftId,draft.revision)).outcome).toBe('committed')
    const retry=await workspace.prepareImport(s.user,{accountId:s.account.id,csv:native,format:'native',ordinarySharesConfirmed:true})
    expect(retry.review.counts).toMatchObject({accepted:0,duplicate:2,excluded:1})
    const rows=await owner.query('SELECT provenance FROM cgt.transactions WHERE import_id=$1',[draft.draftId])
    expect(rows.rows.every(row=>row.provenance.native.ordinarySharesConfirmed===true)).toBe(true)
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

  it('serializes copies of one statement under two broker labels and checks the operator clearance', async()=>{
    const s=await setup('parallel-label-replay');
    const other=await workspace.addAccount(s.user,{portfolioId:s.portfolio.id,broker:'trading212',label:'Other GIA',accountType:'GIA'});
    const drafts=await Promise.all([s.account.id,other.id].map(accountId=>workspace.prepareImport(s.user,{accountId,csv,format:'canonical-v1'})));
    const outcomes=await Promise.all(drafts.map(d=>workspace.commitImport(s.user,d.draftId,d.revision)));
    const saved=outcomes.find(r=>r.outcome==='committed'), blocked=outcomes.find(r=>r.outcome==='review_changed');
    expect(saved?.outcome).toBe('committed');
    if (!blocked || !('review' in blocked) || !saved || !('importId' in saved)) throw new Error('Expected exactly one save');
    expect(blocked.review.status).toBe('needs_review');
    expect(blocked.review.issues[0]?.message).toContain(saved.importId);
    const otherDraft=drafts.find(d=>d.draftId!==saved.importId)!;
    const env={...process.env,OPERATOR_DATABASE_URL:process.env.POSTGRES_TEST_DATABASE_URL!};
    const args=['scripts/review-statement-overlap.mjs','--draft',otherDraft.draftId,'--other',saved.importId];
    expect(execFileSync(process.execPath,args,{env,encoding:'utf8'})).toMatch(/eligible for review/i);
    expect(execFileSync(process.execPath,[...args,'--apply','--case','synthetic','--evidence','two verified synthetic statements','--verified-separate-accounts'],{env,encoding:'utf8'})).toMatch(/review recorded/i);
    expect((await workspace.commitImport(s.user,otherDraft.draftId,blocked.revision)).outcome).toBe('committed');
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

  it('allocates the final session check in a shared window once across concurrent PostgreSQL requests', async()=>{
    const origin='http://localhost:3000', header='x-test-client-ip';
    const auth=createAuth(authDb,{origin,secret:randomBytes(32).toString('base64url'),secureCookies:false,clientIpHeader:header},async()=>{});
    const read=()=>auth.handler(new Request(origin+'/api/v2/auth/get-session',{headers:{[header]:'198.51.100.12'}}));
    const known=await owner.query("SELECT key FROM auth.\"rateLimit\" WHERE key LIKE 'session-read:%'");
    expect((await read()).status).toBe(200);
    const key=(await owner.query("SELECT key FROM auth.\"rateLimit\" WHERE key LIKE 'session-read:%' AND NOT (key=ANY($1::text[]))",[known.rows.map(r=>r.key)])).rows[0].key;
    await owner.query('UPDATE auth."rateLimit" SET count=59 WHERE key=$1',[key]);
    const results=await Promise.all([read(),read()]);
    expect(results.map(r=>r.status).sort()).toEqual([200,429]);
    expect(Number(results.find(r=>r.status===429)?.headers.get('retry-after'))).toBeGreaterThan(0);
    await owner.query('UPDATE auth."rateLimit" SET "lastRequest"="lastRequest"-60001 WHERE key=$1',[key]);
    expect((await read()).status).toBe(200);
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

import { brokerCases, fixture, fixtureDetails, fixtureRows } from '../tests/helpers/broker-corpus'
import { fingerprintDetails } from '../src/domain/imports/supporting-details'
import { createHash } from 'node:crypto'
import Papa from 'papaparse'
it.each(brokerCases)('qualifies $file import/report/retry using PostgreSQL 18 runtime roles',async c=>{
  const s=await setup(`broker-pg-${c.file}`)
  const account=await workspace.addAccount(s.user,{portfolioId:s.portfolio.id,broker:c.broker,label:`Synthetic ${c.file}`,accountType:'GIA'})
  const notes=fixtureDetails(c)
  async function review(file=fixture(c), declarations=notes) {
    let draft=await workspace.prepareImport(s.user,{accountId:account.id,csv:file,format:'native',ordinarySharesConfirmed:true})
    for(const [record,details] of Object.entries(declarations))
      draft=await workspace.supplyImportDetails(s.user,draft.draftId,Number(record),details,draft.reviewVersion)
    return draft
  }
  const draft=await review()
  expect(draft.review.status).toBe('ready')
  expect((await workspace.commitImport(s.user,draft.draftId,draft.revision,draft.reviewVersion)).outcome).toBe('committed')
  const result=await workspace.calculate(s.user,{portfolioId:s.portfolio.id,taxYear:'2024-25',historyThrough:'2025-05-05',personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds:[s.account.id,account.id]})
  expect(result.result.summary?.netGainGBP).toBe(c.gain)
  expect((await workspace.reportSnapshot(s.user,result.runId)).result).toEqual(result.result)
  const duplicate=await review()
  expect(duplicate.review.counts).toMatchObject({accepted:0,duplicate:2})
  expect((await workspace.commitImport(s.user,duplicate.draftId,duplicate.revision,duplicate.reviewVersion)).outcome).toBe('needs_review')
  await workspace.discardDraft(s.user,duplicate.draftId,duplicate.reviewVersion)
  if(Object.keys(notes).length) {
    // Seed the previously deployed fingerprint and supporting JSONB exactly as
    // the old writer did. All replays below go through the normal application role.
    for(const [record,detail] of Object.entries(notes)) {
      const historical={...detail,priceUnit:c.file==='freetrade-fx-fees' ? 'minor' : detail.priceUnit}
      const pgNote=(await owner.query('SELECT $1::jsonb AS note',[JSON.stringify(historical)])).rows[0].note
      expect(JSON.stringify(fingerprintDetails(pgNote))).toBe(JSON.stringify(pgNote))
      const row=draft.review.records.find(r=>r.record===Number(record))!
      const provenance={...row.provenance,native:{...row.provenance!.native,supportingDetails:pgNote}}
      const digest=createHash('sha256').update(JSON.stringify({trade:row.trade,provenance})).digest('hex')
      expect(digest).not.toBe(row.digest)
      const saved=await owner.query(
        "UPDATE cgt.transactions SET content_digest=$1, provenance=jsonb_set(provenance,'{native,supportingDetails}',$2::jsonb) WHERE import_id=$3 AND source_key=$4",
        [digest,JSON.stringify(pgNote),draft.draftId,row.sourceKey],
      )
      expect(saved.rowCount).toBe(1)
    }
    const relabelled=Object.fromEntries(Object.entries(notes).map(([record,note])=>
      [record,{...note,reference:note.reference+' (personal copy)'}]))
    const replay=await review(fixture(c),relabelled)
    expect(replay.review.counts).toMatchObject({duplicate:2,accepted:0,needsReview:0})
    await workspace.discardDraft(s.user,replay.draftId,replay.reviewVersion)

    // Increase the BUY fee and corresponding net cash by £1 for the same
    // execution. Its gross price still reconciles, but its financial facts differ.
    const rows=fixtureRows(c)
    const buy=rows[0]!
    if(c.file==='freetrade-fx-fees') {
      buy['Total Amount']='1005.50'
      buy['Stamp Duty']='1'
      relabelled['2']!.fees='6.875' // £5.50 at £0.80 per USD.
    } else {
      buy[c.amount]=buy[c.amount]!.startsWith('-') ? '-509.49' : '509.49'
      relabelled['2']!.fees='9.49'
    }
    const conflict=await review(Papa.unparse(rows),relabelled)
    expect(conflict.review.issues).toContainEqual(expect.objectContaining({code:'DUPLICATE_CONFLICT',record:2}))
    expect(conflict.review.counts).toMatchObject({duplicate:1,accepted:0,needsReview:1})
    expect((await workspace.commitImport(s.user,conflict.draftId,conflict.revision,conflict.reviewVersion)).outcome).toBe('needs_review')
    await workspace.discardDraft(s.user,conflict.draftId,conflict.reviewVersion)
    expect((await workspace.reportSnapshot(s.user,result.runId)).result).toEqual(result.result)
  }
  await workspace.reverseImport(s.user,draft.draftId,'Synthetic broker qualification complete')
  await expect(workspace.reportSnapshot(s.user,result.runId)).rejects.toMatchObject({status:404})
})

it('exports one verified owner, guards a billing hold and erases only the resolved account', async () => {
  const holder = await setup('erasure-review'), unaffected = await setup('erasure-neighbour')
  const draft = await workspace.prepareImport(holder.user,{accountId:holder.account.id,csv,format:'canonical-v1'})
  await workspace.commitImport(holder.user,draft.draftId,draft.revision)
  await workspace.calculate(holder.user,{portfolioId:holder.portfolio.id,taxYear:'2024-25',historyThrough:'2025-05-05',confirmedAccountIds:[holder.account.id],personalScopeConfirmed:true, scopeDeclaration: "personal-market-trades-v2"})
  await owner.query(`INSERT INTO auth.verification(id,identifier,value,"expiresAt") VALUES('erasure-token','reset-password:test','erasure-review',now()+interval '1 hour')`)
  const directory = mkdtempSync(join(tmpdir(),'cgt-case-'))
  const output = join(directory,'private-export.json')
  const operator = (script: string, ...args: string[]) => execFileSync(process.execPath, [script,'--owner',holder.user.ownerId,'--case-id','CASE-TEST',...args], {env:{...env,OPERATOR_DATABASE_URL:env.MIGRATION_DATABASE_URL},stdio:'pipe'}).toString()
  const erase = (...args: string[]) => JSON.parse(operator('scripts/erase-reviewed-account.mjs',...args))
  try {
    operator('scripts/export-reviewed-account.mjs','--output',output)
    const contents = JSON.parse(readFileSync(output,'utf8'))
    expect(contents.profile.id).toBe(holder.user.ownerId)
    expect(contents.transactions.length).toBeGreaterThan(0)
    expect(contents.calculation_runs).toHaveLength(1)
    expect(statSync(output).mode & 0o777).toBe(0o600)
    expect(readFileSync(output,'utf8')).not.toContain(unaffected.user.ownerId)
    expect(contents).not.toHaveProperty('session')
    expect(erase().outcome).toBe('dry_run')
    await owner.query(`INSERT INTO cgt.billing_accounts(owner_id,stripe_account_id,livemode,subscription_status,risk_hold,risk_reason) VALUES($1,'acct_fixture',false,'canceled',true,'review')`,[holder.user.ownerId])
    expect(()=>erase('--apply','--billing-reviewed')).toThrow()
    await owner.query('UPDATE cgt.billing_accounts SET risk_hold=false,risk_reason=NULL WHERE owner_id=$1',[holder.user.ownerId])
    expect(()=>erase('--apply')).toThrow()
    expect(erase('--apply','--billing-reviewed').outcome).toBe('erased')
    expect(erase().outcome).toBe('already_absent')
    expect((await owner.query('SELECT id FROM auth.verification WHERE value=$1',[holder.user.ownerId])).rows).toEqual([])
    expect((await workspace.overview(unaffected.user)).accounts).toHaveLength(1)
  } finally { rmSync(directory,{recursive:true,force:true}) }
})
