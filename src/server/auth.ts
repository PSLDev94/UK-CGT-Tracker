import { betterAuth, type BetterAuthOptions } from 'better-auth'
import type { Database } from './database'

export interface AuthConfig {
  origin: string
  secret: string
  secureCookies: boolean
  /** Must be overwritten by the trusted ingress, never passed through from clients. */
  clientIpHeader: string
}
export type AuthMail = { to: string; kind: 'verification' | 'password-reset'; url: string }
export type SendAuthMail = (message: AuthMail) => Promise<void>

/** Injectable mail transport keeps verification/reset tests off the real email service. */
export function authOptions(db: Database, config: AuthConfig, sendMail: SendAuthMail): BetterAuthOptions {
  const origin = new URL(config.origin)
  if (origin.origin !== config.origin || config.secret.length < 32 || (config.secureCookies && origin.protocol !== 'https:')) {
    throw new Error('Invalid authentication origin or secret configuration')
  }
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
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
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
      ipAddress: { ipAddressHeaders: [config.clientIpHeader] },
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    user: { deleteUser: { enabled: false }, changeEmail: { enabled: false } },
  }
}

export function createAuth(db: Database, config: AuthConfig, sendMail: SendAuthMail) {
  return betterAuth(authOptions(db, config, sendMail))
}
