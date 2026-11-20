export const contactTopics = {
  general: "General question",
  imports: "Broker or file import",
  reports: "Calculations and reports",
  billing: "Subscription and billing",
  deletion: "Account data or deletion",
} as const;
export type ContactTopic = keyof typeof contactTopics;
export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === "string" && Object.hasOwn(contactTopics, value);
}
