import { createHash } from "node:crypto";

export function sourceKey(broker: string, account: string, execution: string) {
  return createHash("sha256")
    .update(JSON.stringify([broker, account, execution]))
    .digest("hex");
}

/** Flex supplies ClientAccountID and TradeID separately. A template must carry
 * both until the local account has been bound by a previously saved execution. */
export function ibkrExecution(value: string, bound?: string | null) {
  const separator = value.indexOf(":");
  const external = separator > 0 ? value.slice(0, separator) : bound;
  const execution = separator > 0 ? value.slice(separator + 1) : value;
  if (
    !external ||
    !execution ||
    /[:\x00-\x1f]/.test(external + execution) ||
    external.length + 1 + execution.length > 200
  )
    throw new Error(
      "For this IBKR account use ClientAccountID:TradeID from the Flex statement in the template Transaction ID.",
    );
  if (bound && bound !== external)
    throw new Error(
      "The statement belongs to another IBKR account. Select its matching broker account before uploading.",
    );
  return { external, execution };
}
