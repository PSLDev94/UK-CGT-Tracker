import assert from 'node:assert/strict'

const origin = process.env.STAGING_ORIGIN
assert.equal(origin, 'https://web-staging-e003bc3b.up.railway.app', 'This probe is restricted to the approved staging host')
const results = []
async function request(path, options, expected) {
  const response = await fetch(`${origin}${path}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) })
  results.push({ path, status: response.status })
  assert.equal(response.status, expected, `Unexpected response from ${path}`)
  return response
}

const home = await request('/', undefined, 200)
assert.equal(home.headers.get('x-frame-options'), 'DENY')
assert.match(home.headers.get('x-robots-tag') ?? '', /noindex/)
const html = await home.text()
assert.match(html, /Calculate gains on your/)
const stylesheet = html.match(/href="([^" ]*\/_next\/static\/[^" ]+\.css[^" ]*)"/)?.[1]
assert(stylesheet?.startsWith('/_next/static/'), 'A packaged stylesheet must be present')
assert.match((await request(stylesheet, undefined, 200)).headers.get('content-type') ?? '', /text\/css/)
for (const path of ['/supported-brokers', '/workspace', '/account/sign-up', '/api/health']) await request(path, undefined, 200)
assert.equal((await (await request('/api/ready', undefined, 200)).json()).status, 'ready')
const session = await request('/api/v2/auth/get-session', undefined, 200)
assert.match(session.headers.get('cache-control') ?? '', /no-store/)
assert.equal(await session.json(), null)
const post = (body, requestOrigin = origin, extra = {}) => ({ method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) })
const unauthenticated = await request('/api/v2/workspace', post({ action: 'overview' }), 401)
assert.match(unauthenticated.headers.get('cache-control') ?? '', /no-store/)
await request('/api/v2/workspace', post({ action: 'overview' }, 'https://foreign.example'), 403)
await request('/api/v2/auth/sign-in/email', post({}, 'https://foreign.example'), 403)

// This only attempts nonexistent-user sign-in. It creates no accounts and sends
// no email. Vary forged forwarding headers to verify that ingress supplies the
// trusted rate-limit identity. The endpoint window resets after one minute.
const limited = []
for (let index = 1; index <= 7; index++) {
  const response = await fetch(`${origin}/api/v2/auth/sign-in/email`, {
    ...post({ email: 'qa-rate-limit@example.invalid', password: 'Smoke test password 2026!' }, origin,
      { 'x-real-ip': `192.0.2.${index}`, 'x-forwarded-for': `198.51.100.${index}` }),
    signal: AbortSignal.timeout(15000),
  })
  assert([401, 429].includes(response.status), 'Sign-in probe returned an unexpected status')
  limited.push(response.status)
  await response.arrayBuffer()
}
assert.deepEqual(limited.slice(-2), [429, 429], 'Forged client-IP headers must not evade the rate limit')
console.log(JSON.stringify({ checks: results, spoofedHeaderSignInStatuses: limited, result: 'passed' }, null, 2))
