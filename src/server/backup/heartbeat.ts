// The monitor receives only an empty success or failure signal. Its URL is secret.
export async function signalBackupOutcome(
  endpoint: string | undefined,
  succeeded: boolean,
  send: typeof fetch = fetch,
) {
  if (endpoint === undefined) return;
  if (
    !/^https:\/\/hc-ping\.com\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(
      endpoint,
    )
  )
    throw new Error("Invalid backup monitoring endpoint");
  const response = await send(succeeded ? endpoint : endpoint + "/fail", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200 || (await response.text()).trim() !== "OK")
    throw new Error("Backup monitor did not acknowledge the signal");
}
