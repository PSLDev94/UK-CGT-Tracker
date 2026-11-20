import type { Metadata } from "next";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { samplePreview } from "@/domain/reports/sample-view";
import SampleCalculation from "./SampleCalculation";
import styles from "./calculations.module.css";

export const metadata: Metadata = {
  title: "Sample capital gains statement",
  description:
    "Inspect three illustrative share sales, the purchase matches behind them and the annual statement.",
};

export default function SampleStatementPage() {
  return (
    <div className={styles.sheet}>
      <PublicNav />
      <SampleCalculation model={samplePreview()} />
      <PublicFooter />
    </div>
  );
}
