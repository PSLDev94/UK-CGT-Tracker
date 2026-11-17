import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { AppError } from "./errors";
import {
  assertSameOrigin,
  errorResponse,
  limitedBody,
  privateResponse,
} from "./http";
export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  requestId: string;
}
export function createContactHandler(config: {
  origin: string;
  ipHeader: string;
  secret: string;
  consume: (key: string) => Promise<void>;
  send: (message: ContactMessage) => Promise<void>;
}) {
  return async (request: Request) => {
    try {
      if (request.method !== "POST")
        throw new AppError(405, "METHOD_NOT_ALLOWED", "Use POST.");
      assertSameOrigin(request, config.origin);
      if (
        request.headers.get("content-type")?.split(";")[0] !==
        "application/json"
      )
        throw new AppError(
          415,
          "INVALID_REQUEST",
          "Send the contact form as JSON.",
        );
      const ip = request.headers.get(config.ipHeader)?.trim() ?? "";
      if (!isIP(ip))
        throw new AppError(
          503,
          "CONTACT_UNAVAILABLE",
          "The contact form is temporarily unavailable. Email support@cgttracker.com.",
        );
      await config.consume(
        createHmac("sha256", config.secret).update(ip).digest("hex"),
      );
      let input: unknown;
      try {
        input = JSON.parse(await limitedBody(request, 32768));
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Check your message and try again.",
        );
      }
      const r = input as ContactMessage | null;
      if (
        !r ||
        typeof r.name !== "string" ||
        !r.name.trim() ||
        r.name.length > 100 ||
        typeof r.email !== "string" ||
        r.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ||
        typeof r.message !== "string" ||
        r.message.trim().length < 10 ||
        r.message.length > 5000 ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          r.requestId ?? "",
        )
      )
        throw new AppError(
          400,
          "INVALID_CONTACT",
          "Enter a name, valid email and a message of 10–5,000 characters.",
        );
      await config.send({
        name: r.name.trim(),
        email: r.email,
        message: r.message.trim(),
        requestId: r.requestId,
      });
      return privateResponse({ accepted: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
