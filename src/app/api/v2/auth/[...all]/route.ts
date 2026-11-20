import { runtime as getRuntime } from "@/server/runtime";
import { assertSameOrigin, errorResponse, limitedBody } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    const { auth, origin } = await getRuntime();
    if (request.method === "POST") {
      assertSameOrigin(request, origin);
      const body = await limitedBody(request, 32 * 1024);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      request = new Request(request.url, { method: "POST", headers, body });
    }
    const response = await auth.handler(request);
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("x-content-type-options", "nosniff");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
