import { afterEach, expect, it, vi } from "vitest";
import { contractTitle, invoiceContractText, subscriptionTerms } from "../src/domain/reports/subscription-terms";
import { resendContractMailer } from "../src/server/mail";

afterEach(() => vi.unstubAllGlobals());

it("preserves the published terms, seller and cooling-off form in the purchase copy", () => {
  const trader = { legalName: "Example Ltd", address: "1 Example Street, Example Town", registration: "Example registration" };
  const text = invoiceContractText(trader);
  expect(text).toContain(contractTitle);
  for (const section of subscriptionTerms(trader)) expect(text).toContain(section.heading + "\n" + section.text);
  for (const value of ["Example Ltd, trading as PSL Digital", trader.address, trader.registration, "£49", "14 days", "I give notice", "support@cgttracker.com"])
    expect(text).toContain(value);
});

it("sends the dated, frozen invoice text under a stable invoice-specific key and retries provider failure", async () => {
  const fetchMock = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ message: "Synthetic outage", name: "application_error" }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ id: "fake-message-id" }));
  vi.stubGlobal("fetch", fetchMock);
  const submit = resendContractMailer("synthetic-not-a-secret", "accounts@cgttracker.com");
  const contract = { invoiceId: "in_sample", reference: "CGT-100", paidAt: "2026-01-10T12:31:00.000Z",
    recipient: "buyer@example.test", text: contractTitle + "\nThe original purchase terms" };
  await expect(submit(contract)).rejects.toThrow("could not be submitted");
  await submit(contract);
  for (const [url, init] of fetchMock.mock.calls) {
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("cgt-contract-in_sample");
    const body = JSON.parse(String(init?.body));
    expect(body.to).toEqual(contract.recipient);
    expect(body.text).toContain(contract.text);
    expect(body.text).toContain("invoice CGT-100 was marked paid on 2026-01-10");
    expect(body.text).toContain("https://www.cgttracker.com/billing");
  }
});
