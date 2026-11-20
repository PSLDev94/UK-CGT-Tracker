/** Only these deliberate errors may be returned to a browser. */
export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, 'INVALID_ID', 'Select a valid account or import.')
  }
  return value
}

export function requireLabel(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100 || /[\x00-\x1f]/.test(value)) {
    throw new AppError(400, 'INVALID_NAME', 'Enter a name of 1–100 characters.')
  }
  return value.trim()
}
