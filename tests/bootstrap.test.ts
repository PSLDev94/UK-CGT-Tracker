import { describe, expect, it } from 'vitest'
import { runtimeLoginConfiguration } from '../scripts/provision-runtime-logins'

function configuration(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MIGRATION_DATABASE_URL: 'postgresql://postgres:owner@localhost:5432/cgt_test',
    ...Object.fromEntries(['app','auth','billing','maintenance'].map((role,index) => [
      `${role.toUpperCase()}_DATABASE_URL`, `postgresql://cgt_runtime_${role}:${String(index).repeat(40)}@localhost:5432/cgt_test`,
    ])),
  }
}
describe('runtime login configuration', () => {
  it('accepts four distinct restricted logins on the migration database', () => {
    expect(runtimeLoginConfiguration(configuration()).map(value => value.role)).toEqual(['cgt_app','cgt_auth','cgt_billing','cgt_maintenance'])
  })
  it.each(['different-host','different-database','owner-login','shared-password','short-password','injected-role','different-options'])('rejects %s before connecting', kind => {
    const env=configuration(), url=new URL(env.APP_DATABASE_URL!)
    if (kind==='different-host') url.hostname='other-host'
    if (kind==='different-database') url.pathname='/other'
    if (kind==='owner-login') url.username='postgres'
    if (kind==='shared-password') url.password=new URL(env.AUTH_DATABASE_URL!).password
    if (kind==='short-password') url.password='short'
    if (kind==='injected-role') url.username='cgt_runtime_app;SUPERUSER'
    if (kind==='different-options') url.search='?options=-c%20role%3Dpostgres'
    env.APP_DATABASE_URL=url.href
    expect(()=>runtimeLoginConfiguration(env)).toThrow()
  })
})
