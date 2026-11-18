import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK CGT Allowance Checker 2025-26 — How Much Have You Used?",
  description:
    "Estimate CGT on ordinary shares for 2025–26 if you qualify for the £3,000 annual exempt amount. Check when gains need reporting to HMRC.",
  alternates: {
    canonical: "https://www.cgttracker.com/tools/cgt-allowance-checker",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
