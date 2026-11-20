import { runtime as getRuntime } from '@/server/runtime'
import { errorResponse } from '@/server/http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try { return await (await getRuntime()).contactHandler(request) }
  catch (error) { return errorResponse(error) }
}
