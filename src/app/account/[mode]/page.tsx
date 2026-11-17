import { notFound } from "next/navigation";
import { type AuthMode } from "@/ui/auth-form";
import { AuthPage } from "@/ui/auth-page";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { mode } = await params;
  if (!["sign-in", "sign-up", "recover", "reset", "verify"].includes(mode))
    notFound();
  const { token } = await searchParams;
  return (
    <AuthPage
      mode={mode as AuthMode}
      token={typeof token === "string" ? token : undefined}
    />
  );
}
