import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="brand-mark">
        <ChartNoAxesCombined size={22} aria-hidden="true" />
      </span>
      <span>
        CGT Tracker
        <span className="brand-caption">Clarity in every calculation</span>
      </span>
    </Link>
  );
}
