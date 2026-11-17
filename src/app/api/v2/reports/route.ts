import { runtime as getRuntime } from "@/server/runtime";
import { billingRuntime } from "@/server/billing-runtime";
import { createReportHandler } from "@/server/reports-api";
import { errorResponse } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const app = await getRuntime();
    return await createReportHandler({
      origin: app.origin,
      readSession: (headers) => app.auth.api.getSession({ headers }),
      snapshot: (identity, id) => app.workspace.reportSnapshot(identity, id),
      consume: (identity) =>
        app.workspace.consumeRequest(identity, "calculate"),
      entitled: async (identity) =>
        (await (await billingRuntime()).billing.status(identity)).entitled,
    })(request);
  } catch (error) {
    return errorResponse(error);
  }
}
