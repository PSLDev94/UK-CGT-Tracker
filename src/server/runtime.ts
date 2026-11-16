import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { createAuth } from './auth'
import { assertRuntimeRole, OwnedDatabase } from './database'
import { resendAuthMailer } from './mail'
import { Workspace } from './workspace'
import { createWorkspaceHandler } from './workspace-api'
import { AppError } from './errors'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new AppError(503, 'SETUP_INCOMPLETE', 'The new workspace is not available yet. Please try again later.')
  return value
}

async function initialise() {
  const origin = required('APP_ORIGIN')
  const secureCookies = process.env.NODE_ENV === 'production'
  const config = { origin, secureCookies, secret: required('BETTER_AUTH_SECRET'), clientIpHeader: required('AUTH_CLIENT_IP_HEADER') }
  const sendMail = resendAuthMailer(required('RESEND_API_KEY'), required('AUTH_EMAIL_FROM'))
  const appUrl = required('APP_DATABASE_URL')
  const authUrl = required('AUTH_DATABASE_URL')
  if (appUrl === authUrl) throw new Error('Authentication and financial database logins must be separate')
  const pool = (connectionString: string, role: string) => new Pool({
    connectionString, max: 8, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000,
    options: `-c role=${role} -c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000`,
  })
  const appDb = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool: pool(appUrl, 'cgt_app') }) })
  const authDb = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool: pool(authUrl, 'cgt_auth') }) })
  try {
    await Promise.all([assertRuntimeRole(appDb, 'cgt_app'), assertRuntimeRole(authDb, 'cgt_auth')])
    const auth = createAuth(authDb, config, sendMail)
    const workspace = new Workspace(new OwnedDatabase(appDb))
    return { auth, origin, workspaceHandler: createWorkspaceHandler(workspace, headers => auth.api.getSession({ headers }), origin) }
  } catch (error) {
    await Promise.allSettled([appDb.destroy(), authDb.destroy()])
    throw error
  }
}

// Lazy initialisation: the build never connects to production or needs secrets.
let instance: ReturnType<typeof initialise> | undefined
export function runtime() {
  instance ??= initialise().catch(error => { instance = undefined; throw error })
  return instance
}
