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
    throw new ApiError(
      "The connection was interrupted. This request may have reached the server. Check your workspace before repeating an upload or adding an account.",
      0,
      "CONNECTION_INTERRUPTED",
    );
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
