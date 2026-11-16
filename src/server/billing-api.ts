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
  ) => Promise<void>,
) {
  return async (request: Request) => {
    try {
      if (request.method !== "POST")
        throw new AppError(405, "METHOD_NOT_ALLOWED", "Use POST.");
      assertSameOrigin(request, origin);
      const identity = await authenticate(request.headers, readSession);
      await consume(identity);
      const input = await jsonInput(request);
      // Customer IDs, prices, return URLs and ownership never come from the client.
      if (Object.keys(input).some((key) => key !== "action"))
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Only a billing action is accepted.",
        );
      if (input.action === "status")
        return privateResponse(await billing.status(identity));
      if (input.action === "checkout")
        return privateResponse(await billing.checkout(identity));
      if (input.action === "portal")
        return privateResponse(await billing.portal(identity));
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Choose an available billing action.",
      );
    } catch (error) {
      return errorResponse(error);
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
