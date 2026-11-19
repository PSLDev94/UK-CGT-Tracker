export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
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
    const seconds = Number(response.headers.get("Retry-After"));
    const message =
      Number.isInteger(seconds) && seconds > 0 && seconds <= 3600
        ? `Too many requests. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`
        : "Too many requests. Wait a moment, then try again.";
    throw new ApiError(message, 429, "RATE_LIMITED");
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
