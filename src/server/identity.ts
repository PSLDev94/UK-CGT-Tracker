import { AppError } from './errors'

interface Session {
  user: { id: string; emailVerified: boolean }
  session: { expiresAt: Date | string }
}
export type SessionReader = (headers: Headers) => Promise<Session | null>
declare const identityBrand: unique symbol
export type Identity = Readonly<{ ownerId: string; [identityBrand]: true }>
const verified = new WeakSet<object>()

/** The only identity factory. Never accept owner IDs from a request payload. */
export async function authenticate(headers: Headers, readSession: SessionReader): Promise<Identity> {
  const result = await readSession(headers)
  if (!result?.user.id || !(new Date(result.session.expiresAt).getTime() > Date.now())) {
    throw new AppError(401, 'SIGN_IN_REQUIRED', 'Sign in again to continue. Your saved imports are still here.')
  }
  if (!result.user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before uploading financial information.')
  }
  const identity = Object.freeze({ ownerId: result.user.id }) as Identity
  verified.add(identity)
  return identity
}

export function assertIdentity(identity: Identity): void {
  if (!identity || !verified.has(identity)) throw new AppError(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.')
}
