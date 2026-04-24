import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'UK CGT Calculator for Trading 212, Freetrade & HL | CGT Tracker',
    template: '%s | UK CGT Tracker',
  },
  description: 'Calculate your UK Capital Gains Tax instantly from Trading 212, Freetrade, Hargreaves Lansdown & Interactive Investor CSV exports. Automated HMRC share matching with Same-Day, Bed & Breakfast, and Section 104 Pool rules for your SA108 self-assessment.',
  keywords: ['Trading 212 HMRC tax export', 'Freetrade CGT calculator', 'Hargreaves Lansdown capital gains tax', 'UK CGT calculator', 'capital gains tax UK', 'HMRC share matching rules', 'Section 104 pool calculator', 'Bed and Breakfast rule shares', 'SA108 form generator', 'Interactive Investor tax report', 'tax loss harvesting UK stocks'],
  authors: [{ name: 'UK CGT Tracker' }],
  creator: 'UK CGT Tracker',
  publisher: 'UK CGT Tracker',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.cgttracker.co.uk'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: '/',
    title: 'UK CGT Calculator — Trading 212, Freetrade & Hargreaves Lansdown',
    description: 'Upload your Trading 212, Freetrade or HL CSV and instantly calculate your UK Capital Gains Tax. Automated HMRC-compliant SA108 report with Same-Day, B&B, and Section 104 Pool matching.',
    siteName: 'UK CGT Tracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculate your UK Capital Gains Tax in minutes — Trading 212, Freetrade & more',
    description: 'Upload your broker CSV and instantly apply HMRC matching rules. Works with Trading 212, Freetrade, Hargreaves Lansdown, Interactive Investor and more.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head>
        <Script 
          src="https://www.googletagmanager.com/gtag/js?id=G-M5S5LH31T9" 
          strategy="afterInteractive" 
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-M5S5LH31T9');
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
        {children}
      </body>
    </html>
  )
}
