import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK CGT Allowance Checker by Tax Year",
  description:
    "Check your individual CGT allowance and estimate tax on ordinary shares from 2021–22 to 2026–27. See the rates and reporting guidance for your tax year.",
  alternates: {
    canonical: "https://www.cgttracker.com/tools/cgt-allowance-checker",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
