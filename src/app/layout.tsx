import { connection } from "next/server";
import { headers } from "next/headers";
import { isProductionSite, productionOrigin } from "@/server/public-site";
import { hasPublicSession } from "@/server/public-session";
import { PublicAccountProvider } from "@/ui/public-account";
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const indexable = (await headers()).get("x-cgt-public-index") === "allow";
  const description = "Review your trading records and trace UK share gains across your taxable broker accounts.";
  return {
    title: {
      default: "CGT Tracker · Know how your share gains add up",
      template: "%s · CGT Tracker",
    },
    description: isProductionSite() ? description : description + " CGT Tracker relaunch preview.",
    metadataBase: new URL(productionOrigin),
    robots: { index: indexable, follow: indexable },
  };
}

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
        <PublicAccountProvider signedIn={await hasPublicSession()}>
          {children}
        </PublicAccountProvider>
      </body>
    </html>
  );
}
