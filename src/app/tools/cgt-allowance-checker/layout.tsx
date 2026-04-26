import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UK CGT Allowance Checker 2025-26 — How Much Have You Used?',
  description: 'Check how much of your £3,000 CGT annual exempt amount you\'ve used this tax year. Enter your gains and losses to see your position.',
  alternates: { canonical: 'https://www.cgttracker.com/tools/cgt-allowance-checker' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
