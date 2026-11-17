import { AuthPage } from "@/ui/auth-page";
export const metadata = { title: "Forgot Password" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AuthPage mode="recover" token={token} />;
}
