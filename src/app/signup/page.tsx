import { AuthPage } from "@/ui/auth-page";
export const metadata = { title: "Signup" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AuthPage mode="sign-up" token={token} />;
}
