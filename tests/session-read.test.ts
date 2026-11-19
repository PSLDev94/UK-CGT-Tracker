import { afterEach, describe, expect, it, vi } from "vitest";
import { readWorkspaceSession } from "../src/ui/api";

const limited = (headers: HeadersInit) => new Response("{}", { status: 429, headers });
const ok = () => Response.json({ user: { name: "Test investor" } });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("session-read cooldown", () => {
  it("honours the standard HTTP date before the provider's fallback hint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(limited({ "Retry-After": "Thu, 19 Nov 2026 12:00:04 GMT", "X-Retry-After": "1" }))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetcher);
    const waiting = vi.fn();
    const session = readWorkspaceSession(new AbortController().signal, waiting);
    await vi.advanceTimersByTimeAsync(3999);
    expect(waiting).toHaveBeenCalledWith("We'll check your session again in 4 seconds.");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(session).resolves.toEqual({ user: { name: "Test investor" } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels the pending automatic retry on navigation", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(limited({ "X-Retry-After": "3" }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const waiting = vi.fn();
    const session = readWorkspaceSession(controller.signal, waiting);
    await vi.advanceTimersByTimeAsync(0);
    expect(waiting).toHaveBeenCalledWith("We'll check your session again in 3 seconds.");
    const rejected = expect(session).rejects.toThrow();
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(waiting).toHaveBeenCalledTimes(1);
  });

  it("leaves longer provider windows to manual recovery without issuing early reads", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(limited({ "Retry-After": "120" }));
    vi.stubGlobal("fetch", fetcher);
    const waiting = vi.fn();
    await expect(readWorkspaceSession(new AbortController().signal, waiting)).rejects.toMatchObject({
      status: 429, retryAfterSeconds: 120, message: "Too many requests. Try again in 120 seconds.",
    });
    await vi.advanceTimersByTimeAsync(130000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(waiting).not.toHaveBeenCalled();
  });
});
