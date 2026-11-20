import { BROKERS } from "../domain/imports/brokers";

type Stage =
  | "email_verified"
  | "preview_ready"
  | "preview_blocked"
  | "repair_saved"
  | "repair_ready"
  | "import_saved"
  | "calculation_complete"
  | "calculation_incomplete"
  | "reports_opened"
  | "checkout_opened"
  | "csv_served"
  | "pdf_served";

// Counts of completed operations. No per-person identifier or event payload.
export function recordJourney(stage: Stage, broker?: string) {
  const recognized = BROKERS.find((item) => item.id === broker);
  console.info(
    JSON.stringify({
      event: "cgt_journey",
      stage,
      ...(recognized && { broker: recognized.id }),
    }),
  );
}
