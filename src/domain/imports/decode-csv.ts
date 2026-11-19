/** HL's dated Transaction Summary also ships as Windows-1252. Restrict fallback
 * to its exact header; every record is still checked by the statement parser. */
export function decodeBrokerCsv(
  bytes: ArrayBuffer,
  broker: string | undefined,
  format: string,
): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    if (broker === "hl" && format === "native") {
      const legacy = new TextDecoder("windows-1252").decode(bytes);
      if (
        /^Transaction Summary(?:,|\r?$)/m.test(legacy) &&
        /^Trade date,Settle date,Reference,Description,Unit cost \(p\),Quantity,Value \(£\),?\r?$/m.test(
          legacy,
        ) &&
        !/[\u0080-\u009f\ufffd]/.test(legacy)
      )
        return legacy;
    }
    throw new Error(
      "This file is not UTF-8 or a recognised HL Transaction Summary. Use the original supported export or save the CSV as UTF-8.",
    );
  }
}
