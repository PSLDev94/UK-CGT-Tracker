import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'UK CGT Calculator for Shares — Section 104 & SA108 | CGT Tracker',
    template: '%s | UK CGT Tracker',
  },
  description: 'Calculate your UK capital gains tax on shares in minutes. Upload your broker CSV from Trading 212, Freetrade or Hargreaves Lansdown. Applies HMRC\'s Section 104, same-day and 30-day rules automatically. Free 14-day trial.',
  keywords: ['Trading 212 HMRC tax export', 'Freetrade CGT calculator', 'Hargreaves Lansdown capital gains tax', 'UK CGT calculator', 'capital gains tax UK', 'HMRC share matching rules', 'Section 104 pool calculator', 'Bed and Breakfast rule shares', 'SA108 form generator', 'Interactive Investor tax report', 'tax loss harvesting UK stocks'],
  authors: [{ name: 'CGT Tracker' }],
  creator: 'CGT Tracker',
  publisher: 'CGT Tracker',
  metadataBase: new URL('https://www.cgttracker.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: '/',
    title: 'UK CGT Calculator for Shares — Section 104 & SA108',
    description: 'Upload your Trading 212, Freetrade or HL CSV and instantly calculate your UK Capital Gains Tax. Automated HMRC-compliant SA108 report with Same-Day, B&B, and Section 104 Pool matching.',
    siteName: 'CGT Tracker',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CGT Tracker — UK Capital Gains Tax Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UK CGT Calculator for Shares — Section 104 & SA108',
    description: 'Upload your broker CSV and instantly apply HMRC matching rules. Works with Trading 212, Freetrade, Hargreaves Lansdown, Interactive Investor and more.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-GB" className={`${inter.variable} antialiased`}>
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
