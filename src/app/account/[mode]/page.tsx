import { notFound } from "next/navigation";
import { type AuthMode } from "@/ui/auth-form";
import { AuthPage } from "@/ui/auth-page";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{
    next?: string;
    token?: string;
    verification?: string;
    error?: string;
  }>;
}) {
  const { mode } = await params;
  if (!["sign-in", "sign-up", "recover", "reset", "verify"].includes(mode))
    notFound();
  const { next, token, verification, error } = await searchParams;
  // Better Auth appends an error to the same callback URL on failure.
  const verificationNotice =
    mode !== "sign-in"
      ? undefined
      : error !== undefined
        ? "failed"
        : verification === "complete"
          ? "complete"
          : undefined;
  return (
    <AuthPage
      next={typeof next === "string" ? next : undefined}
      verificationNotice={verificationNotice}
      mode={mode as AuthMode}
      token={typeof token === "string" ? token : undefined}
    />
  );
}
