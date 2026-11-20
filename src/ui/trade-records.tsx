"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PreviewModel } from "@/domain/reports/sample-view";
import styles from "./trade-records.module.css";

export function HomeMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    function closeOutside(event: PointerEvent) {
      if (
        menu.current?.open &&
        event.target instanceof Node &&
        !menu.current.contains(event.target)
      ) {
        menu.current.open = false;
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, []);

  return (
    <details ref={menu} className={styles.menu}>
      <summary>Menu</summary>
      <div
        className={styles.menuLinks}
        onClick={() => {
          if (menu.current) menu.current.open = false;
        }}
      >
        <a href="#brokers">Brokers</a>
        <a href="/samples/cgt-evidence.pdf">Sample report</a>
        <Link href="/pricing">Pricing</Link>
        <Link href="/guide">CGT guide</Link>
      </div>
    </details>
  );
}

type Sale = PreviewModel["sales"][number];
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function explanation(sale: Sale) {
  if (sale.id === "tesla") {
    const saleDate = sale.sources.find((source) => source.kind === "sale")!;
    const boughtBack = sale.sources.find(
      (source) => source.kind === "matched-purchase",
    )!;
    const days =
      (Date.parse(boughtBack.isoDate) - Date.parse(saleDate.isoDate)) /
      86_400_000;
    return `The ${sale.qty} shares bought back ${days} days later set the cost of this sale. The earlier purchase stays in the pool.`;
  }
  if (sale.id === "apple") {
    return `The ${sale.qty} shares take their cost from the Section 104 pool. The ${sale.fee} selling fee also reduces the gain.`;
  }
  return `The ${sale.qty} shares sold match the shares bought that day. Their purchase cost sets the gain.`;
}

export function TradeSelector({
  sales,
  year,
  broker,
}: {
  sales: Sale[];
  year: string;
  broker: string;
}) {
  const [selected, setSelected] = useState("tesla");
  const sale = sales.find((entry) => entry.id === selected)!;
  const outcome = sale.result.startsWith("−") ? "loss" : "gain";
  const records = [...sale.sources].sort(
    (a, b) => a.isoDate.localeCompare(b.isoDate) || a.row - b.row,
  );

  return (
    <section
      id="preview"
      className={styles.match}
      aria-label="Explore a sample share sale"
    >
      <header className={styles.matchHead}>
        <h2>Sample dealing account</h2>
        <span>
          {broker} <span aria-hidden="true">/</span> {year}
        </span>
      </header>
      <div
        className={styles.tradeOptions}
        role="group"
        aria-label="Choose a sample sale"
      >
        {sales.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={sale.id === entry.id}
            aria-controls="trade-detail"
            onClick={() => setSelected(entry.id)}
          >
            {entry.id === "lloyds" ? "Lloyds" : entry.name}
          </button>
        ))}
      </div>
      <div id="trade-detail" className={styles.tradeDetail}>
        <div className={styles.resultHeading}>
          <h3>
            {sale.name} · {outcome} on sale
          </h3>
          <p>{sale.rule}</p>
        </div>
        <p className={styles.tradeResult}>{sale.result}</p>
        <p className={styles.saleReason}>{explanation(sale)}</p>
        <ol
          className={styles.tradeTrace}
          aria-label="Transactions in chronological order"
          style={{ "--stops": records.length } as CSSProperties}
        >
          {records.map((source) => (
            <li
              key={source.ref}
              className={
                source.kind === "pool-retained" ? styles.retained : undefined
              }
            >
              <time className={styles.traceDate} dateTime={source.isoDate}>
                {shortDate.format(new Date(source.isoDate))}
              </time>
              <strong>
                {source.kind === "sale"
                  ? "Sold"
                  : source.kind === "matched-purchase" && sale.id === "tesla"
                    ? "Bought back"
                    : "Bought"}
              </strong>
              <span className={styles.tracePrice}>{source.amount}</span>
            </li>
          ))}
        </ol>
        <Link
          className={styles.sourceLink}
          href={`/sample-calculation#${sale.id}`}
        >
          Inspect source records <span aria-hidden="true">→</span>
        </Link>
      </div>
      <p role="status" className={styles.readoutOnly}>
        {sale.name}, {outcome} on sale {sale.result}. {sale.rule}.
      </p>
    </section>
  );
}
