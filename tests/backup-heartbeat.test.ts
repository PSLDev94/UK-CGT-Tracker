import { expect, it, vi } from "vitest";
import { signalBackupOutcome } from "../src/server/backup/heartbeat";

const endpoint = "https://hc-ping.com/00000000-0000-4000-8000-000000000000";
it.each([true, false])(
  "sends the recorded backup outcome (%s) without a payload",
  async (success) => {
    const send = vi.fn().mockResolvedValue(new Response("OK"));
    await signalBackupOutcome(endpoint, success, send);
    expect(send).toHaveBeenCalledExactlyOnceWith(
      success ? endpoint : endpoint + "/fail",
      {
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
    );
  },
);
it("allows an unconfigured staging installation and rejects invalid destinations", async () => {
  const send = vi.fn();
  await signalBackupOutcome(undefined, true, send);
  for (const invalid of [
    "",
    endpoint + "?key=value",
    endpoint.replace("hc-ping.com", "example.org"),
  ]) {
    await expect(signalBackupOutcome(invalid, true, send)).rejects.toThrow();
  }
  expect(send).not.toHaveBeenCalled();
});
it.each([
  new Response("unknown check"),
  new Response("ERROR", { status: 503 }),
])("requires the monitor to acknowledge the signal", async (response) => {
  await expect(
    signalBackupOutcome(endpoint, true, vi.fn().mockResolvedValue(response)),
  ).rejects.toThrow();
});
