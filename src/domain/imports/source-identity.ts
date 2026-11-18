/** Identifying values as displayed on the original broker row, including its date format. */
export function sourceIdentity(source: Record<string, string> = {}) {
  return {
    description:
      source.Description ||
      source.Title ||
      source.Name ||
      source.Ticker ||
      source.Symbol ||
      source.ISIN,
    date:
      source["Trade date"] ||
      source.Date ||
      source.TradeDate ||
      source.Timestamp ||
      source["Time (UTC)"] ||
      source.Time,
    executionReference:
      source.Reference || source["Order ID"] || source.TradeID || source.ID,
  };
}
