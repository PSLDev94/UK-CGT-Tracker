import type { Trade } from "../domain/cgt/types";
import { query, type Connection } from "./database";

export function calculationTrades(
  tx: Connection,
  portfolioId: string,
  through: string,
) {
  return query<Trade>(
    tx,
    `SELECT t.source_key AS id,t.security_id AS "securityId",t.trade_date::text AS date,t.side,
        t.quantity::text AS quantity,t.consideration_gbp::text AS "considerationGBP",t.fees_gbp::text AS "feesGBP"
        FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
        WHERE a.portfolio_id=$1 AND t.active AND t.trade_date <= $2::date ORDER BY t.trade_date,t.source_key`,
    [portfolioId, through],
  );
}
