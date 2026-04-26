import { NextResponse } from 'next/server'

const SITEMAP_URL = 'https://www.cgttracker.com/sitemap.xml'

export async function POST(req: Request) {
  // Verify deploy secret via query parameter (Vercel Deploy Hooks cannot send custom headers)
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (!secret || secret !== process.env.DEPLOY_PING_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const results: Record<string, { status: number | string; ok: boolean }> = {}

  // Ping Google
  try {
    const googleRes = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`
    )
    results.google = { status: googleRes.status, ok: googleRes.ok }
  } catch (err: any) {
    results.google = { status: err.message, ok: false }
  }

  // Ping Bing
  try {
    const bingRes = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`
    )
    results.bing = { status: bingRes.status, ok: bingRes.ok }
  } catch (err: any) {
    results.bing = { status: err.message, ok: false }
  }

  console.log('[Ping] Search engine sitemap ping results:', results)

  return NextResponse.json({
    success: true,
    sitemap: SITEMAP_URL,
    results,
    timestamp: new Date().toISOString(),
  })
}
