import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { publicSearchHost } from "@/server/public-site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const publicHost = publicSearchHost((await headers()).get("host"));
  const disallow = ["/api/", "/dashboard", "/workspace", "/billing", "/account", "/login", "/signup", "/forgot-password", "/reset-password", "/design-preview"];
  return { rules: publicHost ? { userAgent: "*", allow: "/", disallow } : { userAgent: "*", disallow: "/" } };
}
