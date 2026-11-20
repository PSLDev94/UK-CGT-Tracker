"use client";

import Link from "next/link";
import styles from "./public-pages.module.css";
import { ArrowRight } from "lucide-react";
import { usePublicAccount } from "@/ui/public-account";
import { authHref } from "@/ui/return-path";

export function CalculatorUploadLink() {
  const signedIn = usePublicAccount();
  const upload = "/dashboard/upload";
  return (
    <Link
      href={signedIn ? upload : authHref("/signup", upload)}
      className={styles.action}
    >
      {signedIn ? "Upload your CSV" : "Upload your CSV free"}
      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
    </Link>
  );
}
