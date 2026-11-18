import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bed & Breakfast Rule Calculator — Free UK CGT Tool",
  description:
    "Compare one ordinary-share sale and one repurchase under the UK 30-day rule. See the quantity matched, the gain or loss before fees and any shares still to match.",
  alternates: {
    canonical: "https://www.cgttracker.com/tools/bed-and-breakfast-calculator",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
