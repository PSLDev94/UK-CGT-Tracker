/** ISIN syntax plus ISO 6166/Luhn check digit. Does not establish asset type. */
export function validISIN(value: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value)) return false;
  const digits = [...value]
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join("");
  let total = 0;
  for (
    let index = digits.length - 1, offset = 0;
    index >= 0;
    index--, offset++
  ) {
    let digit = Number(digits[index]) * (offset % 2 === 1 ? 2 : 1);
    if (digit > 9) digit -= 9;
    total += digit;
  }
  return total % 10 === 0;
}
