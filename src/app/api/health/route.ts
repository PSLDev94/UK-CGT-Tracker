export function GET() {
  return Response.json(
    { status: "ok", service: "cgt-tracker" },
    { headers: { "cache-control": "no-store" } },
  );
}
