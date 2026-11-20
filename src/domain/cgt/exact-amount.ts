/**
 * Finite decimal inputs and proportional share costs, kept as exact fractions.
 * Recurring fractions are formatted only when an evidence or money field is written.
 */
const zero = BigInt(0)
const one = BigInt(1)
const two = BigInt(2)
const ten = BigInt(10)

function gcd(a: bigint, b: bigint): bigint {
  while (b !== zero) [a, b] = [b, a % b]
  return a < zero ? -a : a
}

export class ExactAmount {
  static readonly zero = new ExactAmount(zero, one)

  private constructor(private readonly numerator: bigint, private readonly denominator: bigint) {}

  private static reduced(n: bigint, d: bigint) {
    if (d <= zero) throw new Error('A positive denominator is required')
    if (n === zero) return ExactAmount.zero
    const factor = gcd(n, d)
    return new ExactAmount(n / factor, d / factor)
  }

  /** A validated decimal literal, or one of the engine's fixed-point output strings. */
  static from(value: string) {
    const [whole, fraction = ''] = value.split('.')
    return ExactAmount.reduced(BigInt(whole + fraction), ten ** BigInt(fraction.length))
  }

  plus(other: ExactAmount) {
    if (this.isZero()) return other
    if (other.isZero()) return this
    const common = gcd(this.denominator, other.denominator)
    const left = other.denominator / common
    const right = this.denominator / common
    return ExactAmount.reduced(this.numerator * left + other.numerator * right, this.denominator * left)
  }

  times(other: ExactAmount) {
    return ExactAmount.reduced(this.numerator * other.numerator, this.denominator * other.denominator)
  }

  minus(other: ExactAmount) { return this.plus(other.negated()) }
  negated() { return new ExactAmount(-this.numerator, this.denominator) }
  isZero() { return this.numerator === zero }
  isPositive() { return this.numerator > zero }
  isNegative() { return this.numerator < zero }

  static min(a: ExactAmount, b: ExactAmount) {
    return a.numerator * b.denominator <= b.numerator * a.denominator ? a : b
  }

  /** The cost allocated to a quantity out of this holding. */
  portion(quantity: ExactAmount, total: ExactAmount) {
    if (total.numerator <= zero) throw new Error('Cannot divide a cost across an empty holding')
    if (quantity.numerator === total.numerator && quantity.denominator === total.denominator) return this
    return ExactAmount.reduced(
      this.numerator * quantity.numerator * total.denominator,
      this.denominator * quantity.denominator * total.numerator,
    )
  }

  /** Round half away from zero using the exact remainder, including exact half-penny ties. */
  toFixed(places: number): string {
    const scale = ten ** BigInt(places)
    const magnitude = (this.numerator < zero ? -this.numerator : this.numerator) * scale
    const units = magnitude / this.denominator + ((magnitude % this.denominator) * two >= this.denominator ? one : zero)
    const sign = this.isNegative() && units !== zero ? '-' : ''
    return sign + String(units / scale) + (places ? '.' + String(units % scale).padStart(places, '0') : '')
  }

  toPence() { return ExactAmount.from(this.toFixed(2)) }

  toString() {
    if (this.denominator === one) return String(this.numerator)
    return this.toFixed(40).replace(/0+$/, '').replace(/\.$/, '')
  }
}
