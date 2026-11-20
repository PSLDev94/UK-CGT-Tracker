import { recordJourney } from "./journey";
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { getIP } from 'better-auth/api'
import { createHmac } from 'node:crypto'
import { query, type Database } from './database'

export interface AuthConfig {
  origin: string
  secret: string
  secureCookies: boolean
  /** Must be overwritten by the trusted ingress, never passed through from clients. */
  clientIpHeader: string
}
export type AuthMail = { to: string; kind: 'verification' | 'password-reset'; url: string }
export type SendAuthMail = (message: AuthMail) => Promise<void>

const sessionReadMaximum = 60
const sessionWindowMs = 60_000
const isSessionRead = (request: Request) =>
  request.method === 'GET' && new URL(request.url).pathname === '/api/v2/auth/get-session'

// Better Auth's default counts from the last request. For this read endpoint
// an active shared network needs a fixed window even while navigation continues.
async function consumeSessionRead(db: Database, key: string) {
  const [window] = await query<{ count: number; seconds: number }>(db, `
    INSERT INTO auth."rateLimit" AS quota(id,key,count,"lastRequest")
    VALUES($1,$1,1,floor(extract(epoch FROM statement_timestamp())*1000)::bigint)
    ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN excluded."lastRequest" >= quota."lastRequest"+$2::bigint
        THEN 1 ELSE least(quota.count+1,$3::int+1) END,
      "lastRequest"=CASE WHEN excluded."lastRequest" >= quota."lastRequest"+$2::bigint
        THEN excluded."lastRequest" ELSE quota."lastRequest" END
    RETURNING count,greatest(1,ceil(("lastRequest"+$2::bigint-extract(epoch FROM clock_timestamp())*1000)/1000))::int AS seconds`,
    [key, sessionWindowMs, sessionReadMaximum])
  if (!window) throw new Error('Session read quota unavailable')
  if (window.count > sessionReadMaximum) {
    const seconds = String(Math.min(60, window.seconds))
    return Response.json({message: 'Too many session checks. Please try again shortly.'}, {
      status: 429, headers: {'Retry-After': seconds, 'X-Retry-After': seconds, 'Cache-Control': 'private, no-store'},
    })
  }
}

/** Injectable mail transport keeps verification/reset tests off the real email service. */
export function authOptions(db: Database, config: AuthConfig, sendMail: SendAuthMail): BetterAuthOptions {
  const origin = new URL(config.origin)
  if (origin.origin !== config.origin || config.secret.length < 32 || (config.secureCookies && origin.protocol !== 'https:')) {
    throw new Error('Invalid authentication origin or secret configuration')
  }
  const ipAddress = { ipAddressHeaders: [config.clientIpHeader] }
  return {
    appName: 'CGT Tracker',
    baseURL: config.origin,
    basePath: '/api/v2/auth',
    secret: config.secret,
    trustedOrigins: [config.origin],
    database: { db, type: 'postgres', schemaName: 'auth', transaction: true },
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendMail({ to: user.email, kind: 'password-reset', url }),
    },
    emailVerification: {
      afterEmailVerification: async () => { recordJourney("email_verified"); },
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendMail({ to: user.email, kind: 'verification', url }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 12,
      freshAge: 60 * 15,
      // Always consult persisted sessions; revocation takes effect immediately.
      cookieCache: { enabled: false },
    },
    plugins: [{
      id: 'bounded-session-reads',
      async onRequest(request) {
        if (!isSessionRead(request)) return
        const address = getIP(request, {advanced: {ipAddress}}) ?? 'unknown-ingress'
        const key = 'session-read:' + createHmac('sha256', config.secret).update(address).digest('hex')
        const response = await consumeSessionRead(db, key)
        if (response) return {response}
      },
    }],
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/get-session': (request, standardRule) => isSessionRead(request) ? false : standardRule,
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    advanced: {
      // Keep these protections active in tests as well as production.
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: config.secureCookies,
      cookiePrefix: 'cgt',
      ipAddress,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    user: { deleteUser: { enabled: false }, changeEmail: { enabled: false } },
  }
}

export function createAuth(db: Database, config: AuthConfig, sendMail: SendAuthMail) {
  return betterAuth(authOptions(db, config, sendMail))
}
