import { recordJourney } from "./journey";
import { createHash } from "node:crypto";
import { reportDestination } from "../domain/reports/destination";
import type { Billing } from "./billing";
import { authenticate, type SessionReader } from "./identity";
import {
  assertSameOrigin,
  errorResponse,
  jsonInput,
  limitedBody,
  privateResponse,
} from "./http";
import { AppError } from "./errors";
import type { StripeGateway } from "./stripe-gateway";

export function createBillingHandler(
  billing: Billing,
  readSession: SessionReader,
  origin: string,
  consume: (
    identity: Awaited<ReturnType<typeof authenticate>>,
    bucket: "general" | "billing",
  ) => Promise<void>,
) {
  return async (request: Request) => {
    try {
      if (request.method !== "POST")
        throw new AppError(405, "METHOD_NOT_ALLOWED", "Use POST.");
      assertSameOrigin(request, origin);
      const identity = await authenticate(request.headers, readSession);
      await consume(identity, "general");
      const input = await jsonInput(request);
      // Checkout URLs are fixed server-side, even when an existing Stripe
      // session is reused. A tab-specific navigation cookie stays on our origin.
      const allowed =
        input.action === "report-access"
          ? ["action"]
          : input.action === "status"
            ? ["action", "tab"]
            : ["action", "tab", "year", "format"];
      const target = reportDestination(input.year, input.format);
      if (
        Object.keys(input).some((key) => !allowed.includes(key)) ||
        (("year" in input || "format" in input) && !target) ||
        (input.tab !== undefined &&
          (typeof input.tab !== "string" || !/^[0-9a-f-]{36}$/.test(input.tab)))
      ) {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Choose a valid billing action and report.",
        );
      }
      if (input.action === "report-access") {
        return privateResponse(await billing.reportAccess(identity));
      }
      await consume(identity, "billing");
      const owner = createHash("sha256")
        .update(identity.ownerId)
        .digest("hex")
        .slice(0, 24);
      const cookieName = `cgt_report_${input.tab ?? "return"}`;
      if (input.action === "status") {
        const saved = request.headers
          .get("cookie")
          ?.split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith(cookieName + "="));
        const [binding, year, format] =
          saved?.slice(cookieName.length + 1).split(".") ?? [];
        return privateResponse({
          ...(await billing.status(identity)),
          returnReport:
            binding === owner ? reportDestination(year, format) : null,
        });
      }
      if (input.action === "checkout" || input.action === "portal") {
        const response = privateResponse(await billing[input.action](identity));
        if (input.action === "checkout") recordJourney("checkout_opened");
        const value = target ? `${owner}.${target.year}.${target.format}` : "";
        response.headers.append(
          "set-cookie",
          `${cookieName}=${value}; Path=/api/v2/billing; HttpOnly; SameSite=Lax; Max-Age=${target ? 86400 : 0}${origin.startsWith("https:") ? "; Secure" : ""}`,
        );
        return response;
      }
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Choose an available billing action.",
      );
    } catch (error) {
      const response = errorResponse(error);
      if (error instanceof AppError && error.code === "TOO_MANY_REQUESTS") {
        response.headers.set("Retry-After", "60");
      }
      return response;
    }
  };
}
export function createStripeWebhookHandler(
  billing: Billing,
  gateway: StripeGateway,
  secret: string,
) {
  return async (request: Request) => {
    try {
      const signature = request.headers.get("stripe-signature");
      if (!signature)
        throw new AppError(
          400,
          "INVALID_SIGNATURE",
          "A webhook signature is required.",
        );
      const raw = await limitedBody(request, 1024 * 1024);
      const event = await gateway.event(raw, signature, secret);
      return privateResponse(
        event
          ? await billing.event(event)
          : { received: true, outcome: "ignored" },
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}
