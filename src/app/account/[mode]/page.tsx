import { notFound } from "next/navigation";
import { AuthForm, type AuthMode } from "@/ui/auth-form";
import { Header } from "@/ui/header";

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
    <>
      <Header />
      <main id="main">
        <AuthForm
          mode={mode as AuthMode}
          token={typeof token === "string" ? token : undefined}
        />
      </main>
    </>
  );
}
