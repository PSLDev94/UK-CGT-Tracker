import type { Metadata } from "next";
import CalculationPreview from "./CalculationPreview";
import { samplePreview } from "../preview-model";

export const metadata: Metadata = {
  title: "Sample calculation · Design preview",
};

export default function PreviewCalculationPage() {
  return <CalculationPreview model={samplePreview()} />;
}
