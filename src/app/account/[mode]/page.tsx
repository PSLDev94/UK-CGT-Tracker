import { notFound } from "next/navigation";
import { type AuthMode } from "@/ui/auth-form";
import { AuthPage } from "@/ui/auth-page";

const titles: Record<AuthMode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create your account",
  recover: "Request a password reset",
  reset: "Choose a new password",
  verify: "Verify your email",
};

type AccountPageProps = {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{
    next?: string;
    token?: string;
    verification?: string;
    error?: string;
  }>;
};

async function accountState({ params, searchParams }: AccountPageProps) {
  const [{ mode }, { next, token, verification, error }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!Object.hasOwn(titles, mode)) notFound();
  // Better Auth appends an error to the same callback URL on failure.
  const verificationNotice =
    mode !== "sign-in"
      ? undefined
      : error !== undefined
        ? "failed"
        : verification === "complete"
          ? "complete"
          : undefined;
  return { mode: mode as AuthMode, next, token, verificationNotice } as const;
}

export async function generateMetadata(props: AccountPageProps) {
  const { mode, verificationNotice } = await accountState(props);
  if (verificationNotice === "failed")
    return { title: "Verification link unavailable" };
  if (verificationNotice === "complete")
    return { title: "Email verified · Sign in" };
  return { title: titles[mode] };
}

export default async function AccountPage(props: AccountPageProps) {
  const { mode, verificationNotice, next, token } = await accountState(props);
  return (
    <AuthPage
      next={typeof next === "string" ? next : undefined}
      verificationNotice={verificationNotice}
      mode={mode}
      token={typeof token === "string" ? token : undefined}
    />
  );
}
