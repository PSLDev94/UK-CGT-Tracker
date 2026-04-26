import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bed & Breakfast Rule Calculator — Free UK CGT Tool',
  description: 'Free calculator to check if HMRC\'s 30-day bed and breakfast rule applies to your share sale. Enter your sell and re-buy details to see your actual gain or loss instantly.',
  alternates: { canonical: 'https://www.cgttracker.com/tools/bed-and-breakfast-calculator' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
