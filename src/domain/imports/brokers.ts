/** Certification is per export variant, not per marketing logo. */
export const BROKERS = [
  { id: 'trading212', name: 'Trading 212', variants: ['Invest history CSV'] },
  { id: 'freetrade', name: 'Freetrade', variants: ['Activity CSV'] },
  { id: 'hl', name: 'Hargreaves Lansdown', variants: ['Fund and Share Account transactions CSV'] },
  { id: 'ii', name: 'Interactive Investor', variants: ['Trading account transactions CSV'] },
  { id: 'ibkr', name: 'Interactive Brokers', variants: ['Activity Statement CSV', 'Activity Flex Query CSV'] },
  { id: 'ajbell', name: 'AJ Bell', variants: ['Dealing account transactions CSV'] },
] as const

export type BrokerId = typeof BROKERS[number]['id']

// No representative real exports were present in the original repository.
// Native adapters must be certified with anonymised fixtures before being enabled.
export const BROKER_COVERAGE = BROKERS.flatMap(broker => broker.variants.map(variant => ({
  brokerId: broker.id, brokerName: broker.name, variant,
  status: 'awaiting_verified_fixtures' as const,
  enabled: false,
})))
