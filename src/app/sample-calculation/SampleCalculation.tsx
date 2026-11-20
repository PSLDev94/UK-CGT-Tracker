"use client";

import { Fragment, useSyncExternalStore } from "react";
import { ArrowDownToLine, ChevronDown, FileText } from "lucide-react";
import type { PreviewModel } from "@/domain/reports/sample-view";
import styles from "./calculations.module.css";

type Sale = PreviewModel["sales"][number];

const reportUrl = "/samples/cgt-evidence.pdf";

function subscribeToFragment(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function selectedSale() {
  return window.location.hash.slice(1);
}

function selectSale(id: string) {
  const url = new URL(window.location.href);
  url.hash = id;
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function isLoss(result: string) {
  return /^[-−]/.test(result);
}

function SaleDetail({ sale }: { sale: Sale }) {
  const loss = isLoss(sale.result);
  return (
    <div className={styles.evidence}>
      <section aria-label={`How the ${sale.name} result was calculated`}>
        <h3>How this sale was matched</h3>
        <p className={styles.explanation}>
          {sale.id === "apple" &&
            "The sale used the average acquisition cost of the shares in the Section 104 pool."}
          {sale.id === "tesla" &&
            "The repurchase within 30 days took priority over the shares already in the pool."}
          {sale.id === "lloyds" &&
            "The sale matched the shares bought on the same day."}
        </p>
        <dl className={styles.working}>
          <div>
            <dt>Gross sale proceeds</dt>
            <dd>{sale.gross}</dd>
          </div>
          <div>
            <dt>Matched acquisition cost</dt>
            <dd>{sale.cost}</dd>
          </div>
          <div>
            <dt>Selling costs</dt>
            <dd>{sale.fee}</dd>
          </div>
          <div>
            <dt>Total allowable costs</dt>
            <dd>{sale.totalCost}</dd>
          </div>
          <div className={styles.subtotal}>
            <dt>{loss ? "Loss on this sale" : "Gain on this sale"}</dt>
            <dd>{sale.result}</dd>
          </div>
        </dl>
      </section>
      <section aria-label={`Source records for ${sale.name}`}>
        <h3>Source records</h3>
        <ul className={styles.sources}>
          {sale.sources.map((source) => (
            <li key={source.ref}>
              <div className={styles.sourceHeading}>
                <strong>{source.role}</strong>
                <span>{source.date}</span>
              </div>
              <div>{source.label}</div>
              <code>{source.ref}</code>
            </li>
          ))}
        </ul>
        <a href={reportUrl} className={styles.evidenceLink}>
          View the evidence in the PDF
        </a>
      </section>
    </div>
  );
}

export default function SampleCalculation({ model }: { model: PreviewModel }) {
  const activeId = useSyncExternalStore(
    subscribeToFragment,
    selectedSale,
    () => "",
  );
  const annualOutcome = isLoss(model.net) ? "Net loss" : "Net gain";

  return (
    <main id="main" className={styles.page}>
      <header className={styles.heading}>
        <h1>Capital gains statement</h1>
        <p>
          Illustrative {model.year} tax year <span aria-hidden="true">·</span>{" "}
          {model.broker} dealing account
        </p>
      </header>

      <section
        className={styles.year}
        aria-label="Annual result and account coverage"
      >
        <div className={styles.outcome}>
          <h2>{annualOutcome} for the year</h2>
          <p className={styles.amount}>{model.net}</p>
          <p className={styles.allowance}>
            Before the annual exempt amount and losses brought forward.
          </p>
          <dl className={styles.totals}>
            <div>
              <dt>Total gains</dt>
              <dd>{model.gains}</dd>
            </div>
            <div>
              <dt>Total losses</dt>
              <dd>{model.losses}</dd>
            </div>
          </dl>
        </div>
        <div className={styles.coverage}>
          <h2>Account history</h2>
          <dl>
            <div>
              <dt>Confirmed through</dt>
              <dd>{model.coverage}</dd>
            </div>
            <div>
              <dt>Calculation saved</dt>
              <dd>{model.saved}</dd>
            </div>
          </dl>
          <a className={styles.report} href="/samples/cgt-summary.pdf">
            <FileText size={17} aria-hidden="true" />
            Open annual statement PDF
          </a>
        </div>
      </section>

      <section aria-labelledby="sales-heading" className={styles.ledger}>
        <div className={styles.ledgerHeading}>
          <h2 id="sales-heading">Sales and matches</h2>
          <span>
            {model.sales.length} sales <span aria-hidden="true">·</span> GBP
          </span>
        </div>
        <table
          className={styles.table}
          role="table"
          aria-labelledby="sales-heading"
        >
          <thead>
            <tr>
              <th scope="col">Security</th>
              <th scope="col">Sale date</th>
              <th scope="col" className={styles.qty}>
                Qty
              </th>
              <th scope="col">Matching rule</th>
              <th scope="col" className={styles.result}>
                Gain / loss
              </th>
              <th scope="col" className={styles.action}>
                <span className={styles.srOnly}>Match details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {model.sales.map((sale) => {
              const open = activeId === sale.id;
              const label = isLoss(sale.result) ? "Loss" : "Gain";
              return (
                <Fragment key={sale.id}>
                  <tr
                    id={sale.id}
                    className={styles.sale}
                    data-open={open}
                    tabIndex={-1}
                  >
                    <th scope="row" className={styles.asset}>
                      <strong>{sale.name}</strong>
                      <small>{sale.isin}</small>
                    </th>
                    <td className={styles.date}>{sale.date}</td>
                    <td className={styles.qty}>
                      {sale.qty}
                      <span className={styles.mobileOnly}> shares</span>
                    </td>
                    <td className={styles.rule}>{sale.rule}</td>
                    <td className={styles.result}>
                      <strong>{sale.result}</strong>
                      <small>{label}</small>
                    </td>
                    <td className={styles.action}>
                      <button
                        id={`toggle-${sale.id}`}
                        type="button"
                        aria-expanded={open}
                        aria-controls={`match-${sale.id}`}
                        aria-label={`${open ? "Hide" : "View"} match for ${sale.name}`}
                        onClick={() => selectSale(open ? "" : sale.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape" && open) selectSale("");
                        }}
                      >
                        {open ? "Hide match" : "View match"}
                        <ChevronDown size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  <tr
                    id={`match-${sale.id}`}
                    className={styles.detailRow}
                    hidden={!open}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        selectSale("");
                        document.getElementById(`toggle-${sale.id}`)?.focus();
                      }
                    }}
                  >
                    <td colSpan={6}>
                      <SaleDetail sale={sale} />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div className={styles.download}>
          <a href={reportUrl} download>
            <ArrowDownToLine size={16} aria-hidden="true" />
            Download evidence PDF
          </a>
        </div>
      </section>
    </main>
  );
}
