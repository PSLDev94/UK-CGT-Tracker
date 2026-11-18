"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePublicAccount } from "@/ui/public-account";
import { authHref } from "@/ui/return-path";

export function CalculatorUploadLink() {
  const signedIn = usePublicAccount();
  const upload = "/dashboard/upload";
  return (
    <Link
      href={signedIn ? upload : authHref("/signup", upload)}
      className="inline-flex max-w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-lg font-medium text-white transition-colors hover:bg-blue-700"
    >
      {signedIn ? "Upload your CSV" : "Upload your CSV free"}
      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
    </Link>
  );
}
