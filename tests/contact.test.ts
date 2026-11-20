import { describe, expect, it, vi } from "vitest";
import { createContactHandler } from "../src/server/contact-api";
import { AppError } from "../src/server/errors";
const input = {
  name: "Synthetic test",
  email: "synthetic@example.test",
  message: "Synthetic contact test without external delivery.",
  requestId: "10000000-0000-4000-8000-000000000001",
};
const request = (body = input) =>
  new Request("https://cgt.test/api/v2/contact", {
    method: "POST",
    headers: {
      origin: "https://cgt.test",
      "content-type": "application/json",
      "x-trusted-ip": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
describe("contact boundary", () => {
  it("accepts validated messages, hashes the trusted IP and retains an idempotency reference", async () => {
    const consume = vi.fn(async (key: string) => {
        void key;
      }),
      send = vi.fn(async () => {});
    const handler = createContactHandler({
      origin: "https://cgt.test",
      ipHeader: "x-trusted-ip",
      secret: "test-secret",
      consume,
      send,
    });
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(input);
    expect(consume.mock.calls[0]?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects forged origins, invalid identity fields, missing trusted ingress and rate-limit exhaustion without sending", async () => {
    const send = vi.fn(async () => {}),
      consume = vi.fn(async (key: string) => {
        void key;
      });
    const handler = createContactHandler({
      origin: "https://cgt.test",
      ipHeader: "x-trusted-ip",
      secret: "test-secret",
      consume,
      send,
    });
    const foreign = request();
    foreign.headers.set("origin", "https://evil.test");
    expect((await handler(foreign)).status).toBe(403);
    expect(
      (await handler(request({ ...input, email: "bad\r\nBcc:a@b.test" })))
        .status,
    ).toBe(400);
    const noIp = request();
    noIp.headers.delete("x-trusted-ip");
    noIp.headers.set("x-forwarded-for", "203.0.113.1");
    expect((await handler(noIp)).status).toBe(503);
    consume.mockRejectedValue(new AppError(429, "TOO_MANY_REQUESTS", "Wait"));
    expect((await handler(request())).status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });
});
