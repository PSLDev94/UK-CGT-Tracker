import type { Metadata } from "next";
import HomePreview from "./HomePreview";
import { samplePreview } from "./preview-model";

export const metadata: Metadata = {
  title: "Share gains, worked through · Design preview",
};

export default function PreviewHomePage() {
  return <HomePreview model={samplePreview()} />;
}
