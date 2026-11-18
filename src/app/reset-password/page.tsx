import { AuthPage } from "@/ui/auth-page";
export const metadata = { title: "Reset Password" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string }>;
}) {
  const { next, token } = await searchParams;
  return (
    <AuthPage
      next={typeof next === "string" ? next : undefined}
      mode="reset"
      token={token}
    />
  );
}
