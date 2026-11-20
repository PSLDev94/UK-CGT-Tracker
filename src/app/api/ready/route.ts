import { runtime as getRuntime } from '@/server/runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Readiness checks restricted DB connections; no mail/payment side effects. */
export async function GET() {
  const headers = { 'cache-control': 'no-store' }
  try {
    await (await getRuntime()).checkDatabase()
    return Response.json({ status: 'ready' }, { headers })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers })
  }
}
