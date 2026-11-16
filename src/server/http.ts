import { randomUUID } from 'node:crypto'
import { AppError } from './errors'

export function privateResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } })
}

export function assertSameOrigin(request: Request, origin: string): void {
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AppError(403, 'INVALID_ORIGIN', 'Open CGT Tracker in your browser and try again.')
  }
}

/** Enforce the actual streamed size, including when Content-Length is absent or false. */
export async function limitedBody(request: Request, maximum: number): Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0) > maximum) throw new AppError(413, 'FILE_TOO_LARGE', 'This request is too large. Choose a CSV of no more than 10 MiB.')
  if (!request.body) throw new AppError(400, 'EMPTY_REQUEST', 'No data was received. Try again.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maximum) {
        await reader.cancel()
        throw new AppError(413, 'FILE_TOO_LARGE', 'This request is too large. Choose a CSV of no more than 10 MiB.')
      }
      chunks.push(value)
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) }
    catch { throw new AppError(400, 'INVALID_ENCODING', 'Save the file as UTF-8 CSV and try again.') }
  } finally { reader.releaseLock() }
}

export async function jsonInput(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw new AppError(415, 'INVALID_CONTENT_TYPE', 'Send this request as JSON.')
  }
  const raw = await limitedBody(request, 12 * 1024 * 1024)
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new AppError(400, 'INVALID_JSON', 'The request could not be read. Try again.') }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'INVALID_REQUEST', 'The request could not be read. Try again.')
  return input as Record<string, unknown>
}

export function stringField(body: Record<string, unknown>, name: string): string {
  if (typeof body[name] !== 'string') throw new AppError(400, 'INVALID_REQUEST', `Provide ${name}.`)
  return body[name]
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) return privateResponse({ error: { code: error.code, message: error.message } }, error.status)
  const reference = randomUUID()
  // Deliberately no error object: database errors can contain financial records.
  console.error(JSON.stringify({ event: 'request_failed', reference }))
  return privateResponse({ error: { code: 'REQUEST_FAILED', message: 'This action could not be completed. Try again or quote this reference to support.', reference } }, 500)
}
