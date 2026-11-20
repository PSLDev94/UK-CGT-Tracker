import type { ReviewedOpeningPool } from "../domain/cgt/types";
import { validISIN } from "../domain/imports/isin";
import {
  calendarDate,
  decimal,
  plusDays,
  TAX_YEARS,
  ukCalendarDate,
  type TaxYear,
} from "../domain/values";
import { calculationTrades } from "./calculation-trades";
import { type Connection, type Database, query } from "./database";
import { AppError, requireUuid } from "./errors";

interface Review extends ReviewedOpeningPool {
  digest: string;
  supersedes: string | null;
  withdrawal: boolean;
  revision: number;
}
const fields = `security_id AS "securityId",as_of::text AS "asOf",trim_scale(quantity)::text AS quantity,
  trim_scale(cost_gbp)::text AS "costGBP",case_reference AS "caseReference",source_reference AS "sourceReference",
  reviewed_input_digest AS digest,supersedes_case_reference AS supersedes,is_withdrawal AS withdrawal,portfolio_revision AS revision`;

/** Tie the signed-off position to the actual receipts, including the 30-day
 * window after the cutoff. A reversal or a late import requires fresh review. */
async function reviewContext(
  tx: Connection,
  portfolio: string,
  security: string,
  asOf: string,
) {
  const [result] = await query<{ digest: string; crossing: boolean }>(
    tx,
    `
    WITH trades AS (
      SELECT t.id,t.content_digest,t.side,t.quantity,t.trade_date
      FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      WHERE a.portfolio_id=$1 AND t.security_id=$2 AND t.active AND t.trade_date <= $3::date + 30
    ), days AS (
      SELECT trade_date,sum(CASE WHEN side='BUY' THEN quantity ELSE -quantity END) AS net
      FROM trades WHERE trade_date > $3::date - 30 GROUP BY trade_date
    )
    SELECT (SELECT encode(sha256(convert_to(coalesce(string_agg(id::text || content_digest,'' ORDER BY id),''),'UTF8')),'hex')
       FROM trades) AS digest,
      EXISTS(SELECT 1 FROM days s JOIN days b ON b.trade_date <= s.trade_date+30
        WHERE s.net<0 AND s.trade_date <= $3::date AND b.net>0 AND b.trade_date > $3::date) AS crossing`,
    [portfolio, security, asOf],
  );
  return result!;
}

export async function reviewedCalculationInputs(
  tx: Connection,
  portfolioId: string,
  taxYear: TaxYear,
  historyThrough: string,
) {
  const trades = await calculationTrades(tx, portfolioId, historyThrough);
  const reviews = await query<Review>(
    tx,
    `
    SELECT DISTINCT ON(security_id) ${fields} FROM cgt.reviewed_opening_pools p
    WHERE portfolio_id=$1 AND as_of < $2::date AND as_of <= $3::date AND NOT is_withdrawal
      AND NOT EXISTS (SELECT 1 FROM cgt.reviewed_opening_pools next WHERE next.portfolio_id=p.portfolio_id
        AND next.security_id=p.security_id AND next.supersedes_case_reference=p.case_reference)
    ORDER BY security_id,as_of DESC,portfolio_revision DESC`,
    [portfolioId, TAX_YEARS[taxYear].start, historyThrough],
  );
  const openingPools: ReviewedOpeningPool[] = [];
  const cutoffs = new Map<string, string>();
  for (const review of reviews) {
    if (historyThrough < plusDays(review.asOf, 30))
      throw new AppError(
        409,
        "BASIS_REVIEW_REQUIRED",
        "Extend the history cutoff to cover the 30 days after the reviewed opening position.",
      );
    const context = await reviewContext(
      tx,
      portfolioId,
      review.securityId,
      review.asOf,
    );
    if (context.crossing || context.digest !== review.digest)
      throw new AppError(
        409,
        "BASIS_REVIEW_REQUIRED",
        "The trading history covered by a reviewed opening position changed. Ask support to have its basis checked again.",
      );
    openingPools.push({
      securityId: review.securityId,
      asOf: review.asOf,
      quantity: review.quantity,
      costGBP: review.costGBP,
      caseReference: review.caseReference,
      sourceReference: review.sourceReference,
    });
    cutoffs.set(review.securityId, review.asOf);
  }
  return {
    openingPools,
    trades: cutoffs.size
      ? trades.filter((t) => t.date > (cutoffs.get(t.securityId) ?? ""))
      : trades,
  };
}

interface ReviewCase {
  ownerId: string;
  portfolioId: string;
  expectedRevision: number;
  securityId: string;
  caseReference: string;
  sourceReference: string;
  supersedesCaseReference?: string;
}
export type OpeningReviewRequest =
  | (ReviewCase & ReviewedOpeningPool & { decision?: "record" })
  | (ReviewCase & { decision: "withdraw"; supersedesCaseReference: string });

/** Operator connection only. Never expose this operation through an HTTP route. */
export function recordReviewedOpeningPool(
  db: Database,
  input: OpeningReviewRequest,
  apply = false,
) {
  requireUuid(input.portfolioId);
  if (
    !input.ownerId ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    !validISIN(input.securityId)
  )
    throw new Error(
      "Supply the verified owner, portfolio revision and a valid ISIN.",
    );
  const reference = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;
  const references = [input.caseReference, input.sourceReference];
  if (
    input.supersedesCaseReference !== undefined ||
    input.decision === "withdraw"
  )
    references.push(input.supersedesCaseReference!);
  if (
    !references.every((r) => typeof r === "string" && reference.test(r)) ||
    input.supersedesCaseReference === input.caseReference
  )
    throw new Error(
      "Use distinct case IDs for corrections and short case and source reference IDs without personal details.",
    );
  if (
    input.decision !== undefined &&
    !["record", "withdraw"].includes(input.decision)
  )
    throw new Error("Choose a record or withdrawal decision.");
  if (input.decision !== "withdraw") {
    calendarDate(input.asOf);
    if (
      input.asOf < "2008-04-05" ||
      plusDays(input.asOf, 30) > ukCalendarDate(new Date())
    )
      throw new Error(
        "Use a modern opening date with a completed 30-day review window.",
      );
    const quantity = decimal(input.quantity, "Opening quantity"),
      cost = decimal(input.costGBP, "Opening basis");
    if (
      quantity.gte("1e26") ||
      cost.gte("1e26") ||
      (quantity.isZero() && !cost.isZero())
    )
      throw new Error(
        "Opening quantity and basis must fit the supported range and reconcile.",
      );
  }

  return db.transaction().execute(async (tx) => {
    await query(tx, "SET LOCAL row_security=off");
    await query(tx, "SET LOCAL lock_timeout='5s'");
    const [portfolio] = await query<{ revision: number }>(
      tx,
      "SELECT revision FROM cgt.portfolios WHERE id=$1 AND owner_id=$2 FOR UPDATE",
      [input.portfolioId, input.ownerId],
    );
    if (!portfolio)
      throw new Error("The verified owner and portfolio do not match.");
    const records = await query<Review>(
      tx,
      `SELECT ${fields} FROM cgt.reviewed_opening_pools
      WHERE portfolio_id=$1 AND security_id=$2`,
      [input.portfolioId, input.securityId],
    );
    const sameCase = records.find(
      (r) => r.caseReference === input.caseReference,
    );
    const superseded = new Set(records.map((r) => r.supersedes));
    const active = records.filter(
      (r) => !r.withdrawal && !superseded.has(r.caseReference),
    );
    const named = records.find(
      (r) => r.caseReference === input.supersedesCaseReference,
    );
    const asOf = input.decision === "withdraw" ? named?.asOf : input.asOf;
    if (!asOf)
      throw new Error(
        "The review decision to withdraw was not found for this holding.",
      );
    const context =
      input.decision === "withdraw"
        ? { digest: named!.digest, crossing: false }
        : await reviewContext(tx, input.portfolioId, input.securityId, asOf);
    if (context.crossing)
      throw new Error(
        "An acquisition may identify a sale across this cutoff. Choose a settled opening date and obtain a basis for that date.",
      );
    const quantity =
      input.decision === "withdraw" ? named!.quantity : input.quantity;
    const costGBP =
      input.decision === "withdraw" ? named!.costGBP : input.costGBP;
    if (sameCase) {
      if (
        sameCase.asOf !== asOf ||
        sameCase.sourceReference !== input.sourceReference ||
        sameCase.digest !== context.digest ||
        sameCase.withdrawal !== (input.decision === "withdraw") ||
        (input.supersedesCaseReference !== undefined &&
          sameCase.supersedes !== input.supersedesCaseReference) ||
        !decimal(quantity, "Quantity").eq(sameCase.quantity) ||
        !decimal(costGBP, "Cost").eq(sameCase.costGBP)
      )
        throw new Error(
          "That case already records different evidence. Preserve it and use a new reviewed case for a correction.",
        );
      return { outcome: "already_recorded", revision: sameCase.revision };
    }
    if (portfolio.revision !== input.expectedRevision)
      throw new Error(
        "The portfolio changed. Review the current records before applying this position.",
      );
    const atDate = active.find((r) => r.asOf === asOf);
    if (input.supersedesCaseReference && (!named || !active.includes(named)))
      throw new Error("The named review is absent or already superseded.");
    if (named && atDate && atDate !== named)
      throw new Error(
        "Another active decision already covers this date. Resolve both cases before recording a replacement.",
      );
    if (!apply) return { outcome: "preview", revision: portfolio.revision };
    const [changed] = await query<{ revision: number }>(
      tx,
      "UPDATE cgt.portfolios SET revision=revision+1 WHERE id=$1 RETURNING revision",
      [input.portfolioId],
    );
    const revision = changed!.revision;
    await query(
      tx,
      `INSERT INTO cgt.reviewed_opening_pools
      (portfolio_id,owner_id,portfolio_revision,security_id,as_of,quantity,cost_gbp,case_reference,source_reference,
       reviewed_input_digest,supersedes_case_reference,is_withdrawal)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        input.portfolioId,
        input.ownerId,
        revision,
        input.securityId,
        asOf,
        quantity,
        costGBP,
        input.caseReference,
        input.sourceReference,
        context.digest,
        named?.caseReference ?? atDate?.caseReference ?? null,
        input.decision === "withdraw",
      ],
    );
    return {
      outcome: input.decision === "withdraw" ? "withdrawn" : "recorded",
      revision,
    };
  });
}
