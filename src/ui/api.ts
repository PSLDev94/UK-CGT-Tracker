export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

function retryAfterSeconds(headers: Headers): number | undefined {
  for (const name of ["Retry-After", "X-Retry-After"]) {
    const value = headers.get(name)?.trim();
    if (!value) continue;
    const seconds = /^\d+$/.test(value)
      ? Number(value)
      : name === "Retry-After" && /^[A-Za-z]{3}, /.test(value)
        ? Math.ceil((Date.parse(value) - Date.now()) / 1000)
        : NaN;
    if (Number.isSafeInteger(seconds)) return Math.max(1, seconds);
  }
}

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
        : AbortSignal.timeout(45000),
    });
  } catch {
    const action = body && typeof body === "object" && "action" in body ? body.action : undefined;
    const writesPortfolio = path === "/api/v2/workspace" && ["add-account", "prepare-import", "supply-import-details", "discard-draft", "commit-import", "reverse-import", "calculate"].includes(String(action));
    const readingReports = action === "overview" && body && typeof body === "object" && "surface" in body && body.surface === "reports";
    const message = readingReports ? "Your saved reports couldn’t load. Try again."
      : writesPortfolio ? "The connection was interrupted. Your change may have reached the server. Check your workspace before trying again."
      : "The connection was interrupted. Try again.";
    throw new ApiError(
      message,
      0,
      "CONNECTION_INTERRUPTED",
    );
  }
  if (response.status === 429) {
    const seconds = retryAfterSeconds(response.headers);
    const message =
      seconds !== undefined && seconds <= 3600
        ? `Too many requests. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`
        : "Too many requests. Wait a moment, then try again.";
    throw new ApiError(message, 429, "RATE_LIMITED", seconds);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok && !(response.status === 409 && data?.review)) {
    throw new ApiError(
      data?.error?.message ??
        data?.message ??
        "The request could not be completed. Try again.",
      response.status,
      data?.error?.code ?? data?.code ?? "REQUEST_FAILED",
    );
  }
  return data as T;
}

export const workspaceApi = <T>(body: unknown, signal?: AbortSignal) =>
  api<T>("/api/v2/workspace", body, signal);
export const authApi = <T>(path: string, body?: unknown) =>
  api<T>(`/api/v2/auth/${path}`, body);


// The session GET is safe to repeat. Keep writes such as checkout and signup under user control.
export async function readWorkspaceSession<T>(signal: AbortSignal, onWait: (message: string) => void): Promise<T> {
  const read = () => api<T>("/api/v2/auth/get-session", undefined, signal);
  try {
    return await read();
  } catch (error) {
    if (signal.aborted || !(error instanceof ApiError) || error.status !== 429) throw error;
    const seconds = error.retryAfterSeconds ?? 5;
    // Respect longer provider cooldowns with the stated wait and a manual retry.
    if (seconds > 60) throw error;
    onWait(`We'll check your session again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`);
    await new Promise<void>((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", cancel);
        resolve();
      }, seconds * 1000);
      signal.addEventListener("abort", cancel, { once: true });
    });
    signal.throwIfAborted();
    onWait("");
    return read();
  }
}
