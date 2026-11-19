// Read-only operator audit. The output contains aggregate counts by tax year only.
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { calculateGains, ENGINE_VERSION } from "../src/domain/cgt/calculate";
import { CURRENT_SCOPE_DECLARATION, type Calculation } from "../src/domain/cgt/types";
import { TAX_YEARS, type TaxYear } from "../src/domain/values";
import { query } from "../src/server/database";
import { activeImportIssue } from "../src/server/import-integrity";
import { reviewedCalculationInputs } from "../src/server/reviewed-opening-pools";
import { AppError } from "../src/server/errors";

async function main() {
  if (!process.env.OPERATOR_DATABASE_URL)
    throw new Error(
      "Set OPERATOR_DATABASE_URL for an isolated restored database or a reviewed read-only connection.",
    );
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.OPERATOR_DATABASE_URL,
        max: 1,
      }),
    }),
  });
  try {
    await db
      .transaction()
      .setIsolationLevel("repeatable read")
      .execute(async (tx) => {
        await query(tx, "SET TRANSACTION READ ONLY");
        await query(tx, "SET LOCAL row_security=off");
        const years = await query<{
          portfolio_id: string;
          tax_year: string;
          cutoff: string;
          previous: Calculation;
          engine_version: string;
          revision_changed: boolean;
        }>(
          tx,
          `SELECT p.portfolio_id,p.tax_year,r.history_through::text AS cutoff,r.result AS previous,r.engine_version,
          r.portfolio_revision<>f.revision AS revision_changed FROM cgt.published_calculations p
          JOIN cgt.calculation_runs r ON r.id=p.run_id JOIN cgt.portfolios f ON f.id=p.portfolio_id ORDER BY p.tax_year`,
        );
        const summary: Record<string, Record<string, number>> = {};
        for (const year of years) {
          const counts = (summary[year.tax_year] ??= {
            published: 0,
            obsolete: 0,
            scopeUnconfirmed: 0,
            revisionChanged: 0,
            unsafeImport: 0,
            unsupportedYear: 0,
            missingTrades: 0,
            invalidCutoff: 0,
            basisReviewRequired: 0,
            blockedMatching: 0,
            changedStatusOrTotal: 0,
            sameStatusAndTotal: 0,
          });
          counts.published++;
          if (
            year.engine_version !== ENGINE_VERSION ||
            year.previous.engineVersion !== ENGINE_VERSION
          )
            counts.obsolete++;
          if (year.previous.scopeDeclaration !== CURRENT_SCOPE_DECLARATION)
            counts.scopeUnconfirmed++;
          if (year.revision_changed) {
            counts.revisionChanged++;
            continue;
          }
          if (await activeImportIssue(tx, year.portfolio_id, year.cutoff)) {
            counts.unsafeImport++;
            continue;
          }
          if (!Object.hasOwn(TAX_YEARS, year.tax_year)) {
            counts.unsupportedYear++;
            continue;
          }
          if (year.cutoff < TAX_YEARS[year.tax_year as TaxYear].start) {
            counts.invalidCutoff++;
            continue;
          }
          let inputs: Awaited<ReturnType<typeof reviewedCalculationInputs>>;
          try {
            inputs = await reviewedCalculationInputs(
              tx,
              year.portfolio_id,
              year.tax_year as TaxYear,
              year.cutoff,
            );
          } catch (error) {
            if (
              !(error instanceof AppError) ||
              error.code !== "BASIS_REVIEW_REQUIRED"
            )
              throw error;
            counts.basisReviewRequired++;
            continue;
          }
          const { trades, openingPools } = inputs;
          if (!trades.length && !openingPools.length) {
            counts.missingTrades++;
            continue;
          }
          const result = calculateGains(trades, {
            taxYear: year.tax_year as TaxYear,
            historyThrough: year.cutoff,
            openingPools,
          });
          if (result.status === "blocked") counts.blockedMatching++;
          if (
            year.previous.status !== result.status ||
            year.previous.summary?.netGainGBP !== result.summary?.netGainGBP
          )
            counts.changedStatusOrTotal++;
          else counts.sameStatusAndTotal++;
        }
        const portfolios = await query<{ id: string }>(
          tx,
          "SELECT id FROM cgt.portfolios",
        );
        let portfoliosRequiringImportReview = 0;
        for (const p of portfolios)
          if (await activeImportIssue(tx, p.id))
            portfoliosRequiringImportReview++;
        const receiptsNeedingOriginalFile = await query<{
          parser: string; reason: string; receipts: number;
        }>(tx, `SELECT i.parser_version AS parser, v.issue AS reason, count(*)::int AS receipts
          FROM cgt.unverified_import_receipts v JOIN cgt.imports i ON i.id=v.id
          GROUP BY i.parser_version,v.issue ORDER BY i.parser_version,v.issue`);
        const correctedFx = await query<{ parser: string; trades: number }>(tx,
          `SELECT i.parser_version AS parser, count(*)::int AS trades
           FROM cgt.transactions t JOIN cgt.imports i ON i.id=t.import_id
           WHERE t.active AND (t.consideration_gbp <> cgt.ledger_gbp(t.consideration_gbp,t.provenance->>'consideration',t.provenance->>'gbpPerUnit')
             OR t.fees_gbp <> cgt.ledger_gbp(t.fees_gbp,t.provenance->>'fees',t.provenance->>'gbpPerUnit'))
           GROUP BY i.parser_version ORDER BY i.parser_version`);
        console.log(
          JSON.stringify(
            {
              engine: ENGINE_VERSION,
              portfolios: portfolios.length,
              portfoliosRequiringImportReview,
              receiptsNeedingOriginalFile,
              correctedFx,
              years: summary,
            },
            null,
            2,
          ),
        );
      });
  } finally {
    await db.destroy();
  }
}
main().catch(() => {
  console.error(
    "Audit failed. Check schema, operator role and database availability. No reports were changed.",
  );
  process.exitCode = 1;
});
