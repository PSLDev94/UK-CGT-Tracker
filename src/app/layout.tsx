import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'UK CGT Tracker | Automated Capital Gains Tax Calculator for HMRC',
    template: '%s | UK CGT Tracker',
  },
  description: 'Calculate your UK Capital Gains Tax instantly. Upload your broker CSV and our engine strictly applies HMRC Same-Day, 30-Day B&B, and Section 104 Pool rules to generate your SA108 report.',
  keywords: ['UK CGT calculator', 'capital gains tax', 'HMRC share matching', 'Section 104 pool', 'Bed and Breakfast rule', 'tax loss harvesting UK', 'SA108 form generator', 'Trading 212 taxes', 'Freetrade tax report'],
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
    title: 'Automated UK Capital Gains Tax Calculator',
    description: 'Instantly accurately calculate your UK Capital Gains Tax. Upload your CSV and get an HMRC compliant self-assessment SA108 report applying Section 104 pools automatically.',
    siteName: 'UK CGT Tracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculate your UK Capital Gains Tax in minutes',
    description: 'Upload your broker CSV and instantly apply HMRC matching rules to prepare your self-assessment.',
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
