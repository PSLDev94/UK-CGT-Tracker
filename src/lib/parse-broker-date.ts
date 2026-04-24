/**
 * Universal broker date parser.
 *
 * Every CSV date string in the entire codebase must flow through this
 * single function. No other file should call `new Date(rawString)` for
 * broker data — doing so risks silent mis-parses (e.g. 1900s dates
 * from IBKR datetime strings).
 *
 * Returns an ISO date string "YYYY-MM-DD" or throws with an
 * actionable error message that can be surfaced to the user.
 */

export class DateParseError extends Error {
  public readonly rawValue: string
  constructor(message: string, rawValue: string) {
    super(message)
    this.name = 'DateParseError'
    this.rawValue = rawValue
  }
}

/**
 * Parse any broker date/datetime string into a Date object.
 * Strips time components, normalises separators, and validates the
 * result falls within a sane year range (2000–2050).
 */
export function parseBrokerDate(rawValue: string): Date {
  if (!rawValue || typeof rawValue !== 'string') {
    throw new DateParseError(`Invalid date value: ${rawValue}`, String(rawValue))
  }

  // Step 1 — strip whitespace
  let cleaned = rawValue.trim()

  // Step 2 — strip time portion from datetimes
  // Handles: "2024-04-10 09:30:00", "2024-04-10T09:15:32Z",
  //          "2024-04-10T09:15:32+01:00", "06/04/2024 14:22:31"
  cleaned = cleaned.split('T')[0].split(' ')[0]

  // Step 3 — detect and normalise the date format

  // Pattern: YYYY-MM-DD or YYYY/MM/DD (ISO standard)
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split(/[-/]/).map(Number)
    return validateYear(new Date(y, m - 1, d), rawValue)
  }

  // Pattern: DD/MM/YYYY or DD-MM-YYYY (UK standard, 2-digit day/month)
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split(/[-/]/).map(Number)
    // If first segment > 12 it must be day (DD/MM).
    // If ambiguous (both ≤ 12), default to DD/MM for UK brokers.
    return validateYear(new Date(y, m - 1, d), rawValue)
  }

  // Pattern: D/M/YYYY or D/M/YY (single-digit day/month, optional 2-digit year)
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(cleaned)) {
    const parts = cleaned.split(/[-/]/).map(Number)
    const y = parts[2] < 100 ? 2000 + parts[2] : parts[2]
    return validateYear(new Date(y, parts[1] - 1, parts[0]), rawValue)
  }

  // Pattern: DD Mon YYYY e.g. "06 Apr 2024" or "6 April 2024"
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(cleaned)) {
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return validateYear(d, rawValue)
  }

  // Pattern: Mon DD YYYY e.g. "Apr 06 2024"
  if (/^[A-Za-z]+\s+\d{1,2}\s+\d{4}$/.test(cleaned)) {
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return validateYear(d, rawValue)
  }

  // Final fallback — attempt native parse but validate the result
  const fallback = new Date(cleaned)
  if (isNaN(fallback.getTime())) {
    throw new DateParseError(
      `Could not parse date: "${rawValue}"`,
      rawValue
    )
  }

  return validateYear(fallback, rawValue)
}

/**
 * Sanity-check: reject years outside 2000–2050 to turn silent data
 * corruption into a loud, catchable error.
 */
function validateYear(d: Date, rawValue: string): Date {
  const year = d.getFullYear()
  if (year < 2000 || year > 2050) {
    throw new DateParseError(
      `Date parsed as year ${year} which is likely wrong. Raw value: "${rawValue}"`,
      rawValue
    )
  }
  return d
}

/**
 * Convenience wrapper: parse a broker date string and return
 * an ISO "YYYY-MM-DD" string, or null if parsing fails.
 * Logs a warning on failure rather than throwing.
 */
export function parseBrokerDateToISO(rawValue: string): string | null {
  try {
    const d = parseBrokerDate(rawValue)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch (err) {
    console.warn(`[parseBrokerDate] Failed to parse: "${rawValue}"`, err)
    return null
  }
}
