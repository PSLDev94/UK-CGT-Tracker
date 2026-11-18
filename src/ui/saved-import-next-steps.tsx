import Link from "next/link";
import { TAX_YEARS } from "../domain/values";
import type { SavedReceipt } from "./workspace-types";

const calculationsPath = (year: string) => `/dashboard/calculations?year=${year}`;

export function SavedImportNextSteps({ receipt, accountName, requestedYear, uploadPath }: {
  receipt: SavedReceipt;
  accountName: string;
  requestedYear?: string;
  uploadPath: string;
}) {
  const { accepted_count: included, disposalYears } = receipt;
  const returnToPrevious = requestedYear && !disposalYears.some(({ year }) => year === requestedYear);

  return (
    <>
      <p>{included} {included === 1 ? "transaction" : "transactions"} included in {accountName}.</p>
      {disposalYears.length === 0 ? (
        <p>
          {included
            ? "This file added purchases only. They can help match sales from other imports."
            : "This file added no new transactions."}{" "}
          No new sales were saved.
        </p>
      ) : (
        <>
          {disposalYears.length > 1 && <p>Sales span several tax years. Choose which year to calculate.</p>}
          {returnToPrevious && (
            <p>You previously selected {requestedYear}. This import contains no sales in that year.</p>
          )}
          <ul className="space-y-3" aria-label="Tax years with saved sales">
            {disposalYears.map(({ year, count }) => (
              <li key={year} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{year} · {count} {count === 1 ? "sale" : "sales"}</span>
                {Object.hasOwn(TAX_YEARS, year) ? (
                  <Link
                    className={disposalYears.length === 1 || year === requestedYear ? "button primary" : "button secondary"}
                    href={calculationsPath(year)}
                  >
                    Calculate gains for {year}
                  </Link>
                ) : <span className="caption">Outside the supported calculation years</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="actions">
        {returnToPrevious && (
          <Link className={disposalYears.length ? undefined : "button primary"} href={calculationsPath(requestedYear)}>
            Return to {requestedYear} calculation
          </Link>
        )}
        <Link className={!disposalYears.length && !requestedYear ? "button primary" : undefined} href={uploadPath}>
          Add another file
        </Link>
        {!disposalYears.length && !requestedYear && <Link href="/dashboard/calculations">Choose a calculation year</Link>}
      </div>
    </>
  );
}
