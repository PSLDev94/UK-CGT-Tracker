import { runtime as getRuntime } from '@/server/runtime'
import { errorResponse } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try { return await (await getRuntime()).workspaceHandler(request) }
  catch (error) { return errorResponse(error) }
}
