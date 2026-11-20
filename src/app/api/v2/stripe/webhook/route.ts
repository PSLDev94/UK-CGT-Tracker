import { billingRuntime } from "@/server/billing-runtime";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await (await billingRuntime()).webhook(request);
  } catch (error) {
    return errorResponse(error);
  }
}
