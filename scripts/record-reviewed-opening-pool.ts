import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { recordReviewedOpeningPool } from "../src/server/reviewed-opening-pools";

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      apply: { type: "boolean" },
      "professionally-reviewed": { type: "boolean" },
    },
  });
  if (!values.file || !process.env.OPERATOR_DATABASE_URL)
    throw new Error(
      "Supply --file and OPERATOR_DATABASE_URL. The default is a preview.",
    );
  if (values.apply && !values["professionally-reviewed"])
    throw new Error(
      "An applied position requires --professionally-reviewed and a completed independent review case.",
    );
  const input = JSON.parse(await readFile(values.file, "utf8"));
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.OPERATOR_DATABASE_URL,
        max: 1,
      }),
    }),
  });
  try {
    console.log(
      JSON.stringify(await recordReviewedOpeningPool(db, input, values.apply)),
    );
  } finally {
    await db.destroy();
  }
}
main().catch((error: Error & { code?: string }) => {
  console.error(
    error.code || error instanceof SyntaxError
      ? "Review failed. Check the source file, database permissions and transaction state."
      : error.message,
  );
  process.exitCode = 1;
});
