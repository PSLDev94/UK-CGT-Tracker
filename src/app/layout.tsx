import { connection } from "next/server";
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CGT Tracker · Know how your share gains add up",
    template: "%s · CGT Tracker",
  },
  description:
    "Review your trading records and trace UK share gains across your taxable broker accounts. CGT Tracker relaunch preview.",
  metadataBase: new URL("https://www.cgttracker.com"),
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection(); // Per-request CSP nonces require dynamic HTML.
  return (
    <html lang="en-GB">
      <body className="font-sans antialiased">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
