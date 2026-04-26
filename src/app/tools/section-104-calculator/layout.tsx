import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Section 104 Pool Calculator — Free UK CGT Tool',
  description: 'Free Section 104 pool calculator for UK investors. Enter your share purchase history to calculate your average cost basis for CGT.',
  alternates: { canonical: 'https://www.cgttracker.com/tools/section-104-calculator' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
