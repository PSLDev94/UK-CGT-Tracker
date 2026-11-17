"use client";

import Link from "next/link";
import {
  WalletCards,
  FileUp,
  ChartNoAxesCombined,
  History,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "./brand";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { BROKERS } from "../domain/imports/brokers";
import { TAX_YEARS, calendarDate, ukCalendarDate } from "../domain/values";
import { authApi, workspaceApi, ApiError } from "./api";
import {
  Button,
  Field,
  SelectField,
  Notice,
  focusFirstError,
} from "./primitives";
import { ImportReviewPanel } from "./import-review";
import { CalculationResult } from "./calculation-result";
import type { Overview, Preview, SavedImport } from "./workspace-types";

type View = "accounts" | "imports" | "calculations" | "history";
type History = {
  imports: SavedImport[];
  total: number;
  page: number;
  pageSize: number;
};
type CommitResult =
  | ({ outcome: "review_changed" | "needs_review" } & Omit<Preview, "draftId">)
  | { outcome: "committed" | "already_committed"; importId: string };

function useModal(
  ref: React.RefObject<HTMLDialogElement | null>,
  open: boolean,
) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>("[data-modal-cancel]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (open && previous?.isConnected) previous.focus();
    };
  }, [open, ref]);
}

export function WorkspaceScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [userName, setUserName] = useState("");
  const [view, setView] = useState<View>("accounts");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const confirmedNavigation = useRef(false);
  const reloadGeneration = useRef(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ordinarySharesConfirmed, setOrdinarySharesConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [taxYear, setTaxYear] = useState("2025-26");
  const [dirty, setDirty] = useState(false);
  const [reverse, setReverse] = useState<SavedImport | null>(null);
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const reverseDialog = useRef<HTMLDialogElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  useModal(reverseDialog, !!reverse);
  useModal(leaveDialog, !!leaveAction);

  const fail = useCallback((caught: unknown) => {
    const problem = caught as ApiError;
    if (problem.status === 401) setAuthRequired(true);
    setError(
      problem.message || "This action could not be completed. Try again.",
    );
    requestAnimationFrame(() => messageRef.current?.focus());
  }, []);

  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    const [overview, imports] = await Promise.all([
      workspaceApi<Overview>({ action: "overview" }),
      workspaceApi<History>({ action: "import-history", page: 1 }),
    ]);
    if (generation === reloadGeneration.current) {
      setData(overview);
      setHistory(imports);
    }
  }, []);

  const initialise = useCallback(() => {
    return authApi<{ user: { name: string } } | null>("get-session")
      .then(async (session) => {
        if (!session) {
          setAuthRequired(true);
          return;
        }
        setUserName(session.user.name);
        setAuthRequired(false);
        await reload();
      })
      .catch(fail)
      .finally(() => setLoading(false));
  }, [fail, reload]);

  useEffect(() => {
    void initialise();
  }, [initialise]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !busyRef.current)
        void reload().catch(fail);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [reload, fail]);
  useEffect(() => {
    if (!dirty && !file && !busy) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (confirmedNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank" ||
        anchor.getAttribute("href")?.startsWith("#")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveAction(() => () => {
        confirmedNavigation.current = true;
        location.assign(anchor.href);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, file, busy]);

  async function perform(work: () => Promise<void>) {
    if (busyRef.current) return;
    reloadGeneration.current++;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (caught) {
      fail(caught);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form),
      label = String(values.get("label") ?? "").trim(),
      broker = String(values.get("broker") ?? "");
    const next: Record<string, string> = {};
    if (!label || label.length > 100)
      next.label = "Name this account using 1–100 characters.";
    if (!BROKERS.some((b) => b.id === broker))
      next.broker = "Choose the broker for this account.";
    if (!values.get("taxable"))
      next.taxable = "Confirm this is a taxable general investment account.";
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(form, next);
      return;
    }
    await perform(async () => {
      await workspaceApi({
        action: "add-account",
        portfolioId: data!.portfolio.id,
        broker,
        label,
        accountType: "GIA",
      });
      await reload();
      form.reset();
      setDirty(false);
      setMessage("Account added. You can now review a file for this account.");
      setView("imports");
    });
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form),
      accountId = String(values.get("accountId") ?? ""),
      format = String(values.get("format") ?? "native");
    const next: Record<string, string> = {};
    if (!accountId) next.accountId = "Choose the account this file belongs to.";
    if (!file) next.csv = "Choose a CSV file.";
    else if (
      !file.name.toLowerCase().endsWith(".csv") ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    )
      next.csv = "Choose a non-empty CSV file of no more than 10 MiB.";
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(form, next);
      return;
    }
    await perform(async () => {
      let csv: string;
      try {
        csv = new TextDecoder("utf-8", { fatal: true }).decode(
          await file!.arrayBuffer(),
        );
      } catch {
        throw new ApiError(
          "This file is not UTF-8. Export or save it as UTF-8 CSV, then try again.",
          400,
          "INVALID_ENCODING",
        );
      }
      const result = await workspaceApi<Preview>({
        action: "prepare-import",
        accountId,
        format,
        ordinarySharesConfirmed: values.get("ordinarySharesConfirmed") === "on",
        csv,
      });
      setPreview(result);
      setOrdinarySharesConfirmed(false);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setDirty(false);
      await reload();
      setMessage(
        "Preview saved for 24 hours. Review the records below before saving transactions.",
      );
    });
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form),
      historyThrough = String(values.get("historyThrough") ?? "");
    const next: Record<string, string> = {};
    try {
      calendarDate(historyThrough);
      if (historyThrough > ukCalendarDate(new Date()))
        next.historyThrough = "Choose today or an earlier date.";
    } catch {
      next.historyThrough =
        "Use a valid date in YYYY-MM-DD format, for example 2026-05-05.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(form, next);
      return;
    }
    await perform(async () => {
      await workspaceApi({
        action: "calculate",
        portfolioId: data!.portfolio.id,
        taxYear,
        historyThrough,
        confirmedAccountIds: values.getAll("confirmedAccountIds"),
      });
      await reload();
      setDirty(false);
      setMessage(
        "Calculation saved. Review the matching evidence and account coverage below.",
      );
    });
  }

  const signOut = () =>
    void perform(async () => {
      await authApi("sign-out", {});
      setData(null);
      setPreview(null);
      setFile(null);
      setDirty(false);
      setAuthRequired(true);
      setMessage("You have been signed out.");
    });
  const accountName = (id: string) =>
    data?.accounts.find((a) => a.id === id)?.label ?? "Broker account";
  const currentCalculation = data?.calculations.find(
    (c) => c.tax_year === taxYear,
  );
  const auditDate = (date: string) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(new Date(date));

  return (
    <div className="workspace">
      <aside className="workspace-nav" aria-label="Workspace navigation">
        <Brand />
        <span className="nav-label">WORKSPACE</span>
        {(["accounts", "imports", "calculations", "history"] as View[]).map(
          (tab) => (
            <button
              key={tab}
              disabled={busy}
              aria-current={view === tab ? "page" : undefined}
              onClick={() => {
                setView(tab);
                setError("");
                setErrors({});
              }}
            >
              {(() => {
                const Icon = {
                  accounts: WalletCards,
                  imports: FileUp,
                  calculations: ChartNoAxesCombined,
                  history: History,
                }[tab];
                return <Icon size={19} aria-hidden="true" />;
              })()}
              {
                {
                  accounts: "Broker accounts",
                  imports: "Import & review",
                  calculations: "Share gains",
                  history: "Import history",
                }[tab]
              }
            </button>
          ),
        )}
        <div className="nav-help">
          <ShieldCheck size={20} aria-hidden="true" />
          <strong>Your records, together.</strong>
          <p>One personal portfolio across your taxable accounts.</p>
        </div>
        <div className="nav-end">
          <Link href="/supported-brokers">
            Broker support <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <p className="caption">{userName || "Private workspace"}</p>
          {data && !authRequired && <Link href="/billing">Billing test</Link>}
          <button
            disabled={busy || authRequired || !data}
            onClick={() => (dirty ? setLeaveAction(() => signOut) : signOut())}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="workspace-main">
        <div className="workspace-topbar">
          <span>Personal portfolio</span>
          <span className="tag">Relaunch preview</span>
        </div>
        <div className="page-intro">
          <span className="eyebrow">Your portfolio, in focus</span>
          <h1>
            {
              {
                accounts: "Broker accounts",
                imports: "Import & review",
                calculations: "Share gains",
                history: "Import history",
              }[view]
            }
          </h1>
          <p className="muted">
            Ordinary shares · Taxable accounts · One personal portfolio
          </p>
        </div>
        <div ref={messageRef} tabIndex={-1}>
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
        </div>
        {loading ? (
          <Notice>Loading your workspace…</Notice>
        ) : authRequired ? (
          <section className="panel">
            <h2>Sign in to your workspace.</h2>
            <p>
              Your financial records are available only after you sign in and
              verify your email.
            </p>
            <div className="actions">
              <Link className="button primary" href="/account/sign-in">
                Sign in
              </Link>
              <Link href="/account/sign-up">Create account</Link>
            </div>
          </section>
        ) : !data ? (
          <section className="panel">
            <h2>The workspace is not available yet.</h2>
            <p>
              Staging configuration is still being completed. No file has been
              uploaded.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setError("");
                void initialise();
              }}
            >
              Try again
            </Button>
          </section>
        ) : (
          <>
            <section hidden={view !== "accounts"}>
              <div className="portfolio-summary" aria-label="Portfolio summary">
                <div>
                  <span>Taxable accounts</span>
                  <strong>
                    {data.accounts.length.toLocaleString("en-GB")}
                  </strong>
                  <small>Combined for share matching</small>
                </div>
                <div>
                  <span>Import records</span>
                  <strong>
                    {(history?.total ?? 0).toLocaleString("en-GB")}
                  </strong>
                  <small>Including reversed imports</small>
                </div>
                <div>
                  <span>Saved previews</span>
                  <strong>{data.drafts.length.toLocaleString("en-GB")}</strong>
                  <small>Awaiting your review</small>
                </div>
              </div>
              <div className="accounts-layout">
                <div className="panel accounts-panel">
                  <div className="panel-heading">
                    <h2>Your taxable accounts</h2>
                    <Button
                      variant="secondary"
                      disabled={busy || !data.accounts.length}
                      onClick={() => setView("imports")}
                    >
                      Import a CSV <ArrowUpRight size={16} aria-hidden="true" />
                    </Button>
                  </div>
                  {!data.accounts.length ? (
                    <div className="empty">
                      <h3>Start with your first broker account.</h3>
                      <p>
                        Add each taxable account you trade through. Their share
                        histories will be combined for matching.
                      </p>
                    </div>
                  ) : (
                    <ul className="record-list">
                      {data.accounts.map((a) => (
                        <li key={a.id}>
                          <div>
                            <strong>{a.label}</strong>
                            <p>
                              {BROKERS.find((b) => b.id === a.broker)?.name} ·
                              General investment account
                            </p>
                          </div>
                          <span className="tag">Taxable</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <section className="panel account-form">
                  <h2>Add a broker account</h2>
                  <p className="caption">
                    Keep each source identifiable. Add taxable accounts only.
                  </p>
                  <form
                    noValidate
                    onSubmit={addAccount}
                    onChange={() => setDirty(true)}
                    className="form-stack"
                  >
                    <div className="form-columns">
                      <SelectField
                        id="broker"
                        name="broker"
                        label="Broker"
                        defaultValue=""
                        error={errors.broker}
                      >
                        <option value="">Choose broker</option>
                        {BROKERS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </SelectField>
                      <Field
                        id="label"
                        name="label"
                        label="Account name"
                        placeholder="For example, my Trading 212 Invest"
                        maxLength={100}
                        error={errors.label}
                      />
                    </div>
                    <div>
                      <label className="checkbox-label">
                        <input
                          name="taxable"
                          type="checkbox"
                          aria-invalid={!!errors.taxable}
                          aria-describedby={
                            errors.taxable ? "taxable-error" : undefined
                          }
                        />
                        <span>
                          This is a taxable general investment account, not an
                          ISA or pension.
                        </span>
                      </label>
                      {errors.taxable && (
                        <small className="field-error" id="taxable-error">
                          {errors.taxable}
                        </small>
                      )}
                    </div>
                    <div>
                      <Button type="submit" busy={busy}>
                        {busy ? "Adding account…" : "Add account"}
                      </Button>
                    </div>
                  </form>
                </section>
              </div>
            </section>
            <section hidden={view !== "imports"}>
              <Notice tone="warning">
                Selected Trading 212 and Freetrade GBP layouts are available for
                preview testing. Other layouts, foreign currencies and corporate
                actions remain in review. A readable CSV does not prove complete
                history.{" "}
                <Link href="/supported-brokers">
                  Check support and template guidance
                </Link>
                .
              </Notice>
              {!data.accounts.length ? (
                <section className="panel">
                  <h2>Add an account first.</h2>
                  <p>
                    Each uploaded file needs a broker and account so its records
                    remain identifiable.
                  </p>
                  <Button onClick={() => setView("accounts")}>
                    Add broker account
                  </Button>
                </section>
              ) : (
                <section className="panel">
                  <h2>Review a CSV file</h2>
                  <form
                    noValidate
                    onSubmit={upload}
                    onChange={(event) => {
                      setDirty(true);
                      const target = event.target;
                      if (
                        target instanceof HTMLSelectElement &&
                        (target.name === "accountId" ||
                          target.name === "format")
                      )
                        setOrdinarySharesConfirmed(false);
                    }}
                    className="form-stack"
                  >
                    <div className="form-columns">
                      <SelectField
                        id="accountId"
                        name="accountId"
                        label="Broker account"
                        error={errors.accountId}
                        defaultValue=""
                      >
                        <option value="">Choose account</option>
                        {data.accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </SelectField>
                      <SelectField
                        id="format"
                        name="format"
                        label="File format"
                        defaultValue="native"
                      >
                        <option value="native">
                          Broker export — limited preview support
                        </option>
                        <option value="canonical-v1">
                          CGT Tracker CSV template
                        </option>
                      </SelectField>
                    </div>
                    <div className="upload-box">
                      <div className="field">
                        <label htmlFor="csv">CSV file</label>
                        <input
                          ref={fileInput}
                          id="csv"
                          name="csv"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(e) => {
                            setFile(e.target.files?.[0] ?? null);
                            setOrdinarySharesConfirmed(false);
                          }}
                          aria-invalid={!!errors.csv}
                          aria-describedby={`csv-help${errors.csv ? " csv-error" : ""}`}
                        />
                        <small id="csv-help">
                          One UTF-8 CSV, up to 10 MiB. A local selection is kept
                          only on this page; reselect it after a reload.
                        </small>
                        {errors.csv && (
                          <small id="csv-error" className="field-error">
                            {errors.csv}
                          </small>
                        )}
                      </div>
                      {file && (
                        <p className="caption">
                          Selected: {file.name} · {Math.ceil(file.size / 1024)}{" "}
                          KiB
                        </p>
                      )}
                    </div>
                    <label className="checkbox-label">
                      <input
                        name="ordinarySharesConfirmed"
                        type="checkbox"
                        checked={ordinarySharesConfirmed}
                        onChange={(e) =>
                          setOrdinarySharesConfirmed(e.target.checked)
                        }
                      />
                      <span>
                        For a native broker export, I have checked that every
                        traded instrument is an ordinary share, not a fund, ETF,
                        bond or derivative. Leave unchecked if unsure; the file
                        will stay in review.
                      </span>
                    </label>
                    <p className="caption">
                      Check transfers and corporate actions against your account
                      records. Freetrade exports can omit them. Do not remove
                      unsupported rows to force an import; missing history can
                      change your gains.
                    </p>
                    <div>
                      <Button type="submit" busy={busy}>
                        {busy ? "Reviewing…" : "Review file"}
                      </Button>
                    </div>
                  </form>
                </section>
              )}
              {preview && (
                <ImportReviewPanel
                  preview={preview}
                  accountLabel={accountName(preview.accountId)}
                  busy={busy}
                  onPage={(page) =>
                    void perform(async () =>
                      setPreview(
                        await workspaceApi<Preview>({
                          action: "review-import",
                          draftId: preview.draftId,
                          page,
                        }),
                      ),
                    )
                  }
                  onDiscard={() =>
                    void perform(async () => {
                      await workspaceApi({
                        action: "discard-draft",
                        draftId: preview.draftId,
                      });
                      setPreview(null);
                      await reload();
                      setMessage(
                        "Preview discarded. Saved transactions were not changed.",
                      );
                    })
                  }
                  onCommit={() =>
                    void perform(async () => {
                      const result = await workspaceApi<CommitResult>({
                        action: "commit-import",
                        draftId: preview.draftId,
                        revision: preview.revision,
                      });
                      if (
                        result.outcome === "review_changed" ||
                        result.outcome === "needs_review"
                      ) {
                        setPreview({ ...result, draftId: preview.draftId });
                        setMessage(
                          "The review changed or needs attention. Check the latest records before confirming again.",
                        );
                        return;
                      }
                      setPreview(null);
                      await reload();
                      setMessage(
                        result.outcome === "already_committed"
                          ? "This import was already saved. No duplicate transactions were added."
                          : "Transactions saved. Your calculations must now be refreshed.",
                      );
                    })
                  }
                />
              )}
              {data.drafts.length > 0 && (
                <section className="panel">
                  <h2>Saved previews</h2>
                  <ul className="record-list">
                    {data.drafts.map((d) => (
                      <li key={d.id}>
                        <div>
                          <strong>{accountName(d.account_id)}</strong>
                          <p>Expires {auditDate(d.expires_at)} (London)</p>
                        </div>
                        <Button
                          variant="secondary"
                          busy={busy}
                          onClick={() =>
                            void perform(async () =>
                              setPreview(
                                await workspaceApi<Preview>({
                                  action: "review-import",
                                  draftId: d.id,
                                  page: 1,
                                }),
                              ),
                            )
                          }
                        >
                          Open preview
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </section>
            <section hidden={view !== "calculations"}>
              <div className="calculation-layout">
                <section className="panel">
                  <h2>Calculation settings</h2>
                  <p>
                    Confirm complete acquisition history across your taxable
                    accounts, including trades within the 30-day look-ahead.
                    Missing accounts can change the result.
                  </p>
                  <form
                    noValidate
                    onSubmit={calculate}
                    onChange={() => setDirty(true)}
                    className="form-stack"
                  >
                    <div className="form-columns">
                      <SelectField
                        id="taxYear"
                        name="taxYear"
                        label="Tax year"
                        value={taxYear}
                        onChange={(e) => setTaxYear(e.target.value)}
                      >
                        {Object.keys(TAX_YEARS)
                          .reverse()
                          .map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                      </SelectField>
                      <Field
                        id="historyThrough"
                        name="historyThrough"
                        label="History complete through"
                        placeholder="2026-05-05"
                        hint="YYYY-MM-DD. Use today or an earlier date."
                        error={errors.historyThrough}
                      />
                    </div>
                    <fieldset>
                      <legend>Accounts with complete history</legend>
                      {data.accounts.length ? (
                        data.accounts.map((a) => (
                          <label key={a.id} className="checkbox-label">
                            <input
                              name="confirmedAccountIds"
                              value={a.id}
                              type="checkbox"
                            />
                            <span>{a.label}</span>
                          </label>
                        ))
                      ) : (
                        <p>Add your taxable accounts before calculating.</p>
                      )}
                    </fieldset>
                    <p className="caption">
                      Leave an account unchecked if its history is incomplete.
                      The result will show that account coverage has not been
                      confirmed.
                    </p>
                    <div>
                      <Button
                        type="submit"
                        busy={busy}
                        disabled={!data.accounts.length}
                      >
                        {busy ? "Calculating…" : "Calculate gains"}
                      </Button>
                    </div>
                  </form>
                </section>
                {currentCalculation && (
                  <CalculationResult
                    result={currentCalculation.result}
                    coverage={currentCalculation.coverage_confirmed}
                  />
                )}
                {!currentCalculation && (
                  <div className="calculation-empty panel">
                    <ChartNoAxesCombined size={36} aria-hidden="true" />
                    <h2>Your gains, explained.</h2>
                    <p>
                      Choose a tax year and confirm your account history to see
                      gains, losses and the share matching behind each disposal.
                    </p>
                    <span className="caption">
                      Same day · 30-day rule · Section 104
                    </span>
                  </div>
                )}
              </div>
            </section>
            <section hidden={view !== "history"}>
              <section className="panel">
                <h2>Import history</h2>
                {!history?.total ? (
                  <div className="empty">
                    <h3>No saved imports yet.</h3>
                    <p>
                      Review a file, then save its validated transactions to
                      begin your history.
                    </p>
                    <Button onClick={() => setView("imports")}>
                      Review a file
                    </Button>
                  </div>
                ) : (
                  <>
                    <ul className="record-list">
                      {history.imports.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{accountName(item.account_id)}</strong>{" "}
                            <span className="tag">
                              {item.status === "committed"
                                ? "Saved"
                                : "Reversed"}
                            </span>
                            <p>
                              {item.accepted_count} included ·{" "}
                              {item.excluded_count} excluded ·{" "}
                              {item.duplicate_count} duplicate ·{" "}
                              {item.record_count} total
                            </p>
                            <p>{auditDate(item.created_at)} (London)</p>
                            {item.reversal_reason && (
                              <p>Reversal reason: {item.reversal_reason}</p>
                            )}
                          </div>
                          {item.status === "committed" && (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setReverse(item);
                                setErrors({});
                              }}
                            >
                              Reverse import
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="pagination">
                      <Button
                        variant="secondary"
                        disabled={busy || history.page === 1}
                        onClick={() =>
                          void perform(async () =>
                            setHistory(
                              await workspaceApi<History>({
                                action: "import-history",
                                page: history.page - 1,
                              }),
                            ),
                          )
                        }
                      >
                        Previous
                      </Button>
                      <span>
                        Page {history.page} of{" "}
                        {Math.ceil(history.total / history.pageSize)}
                      </span>
                      <Button
                        variant="secondary"
                        disabled={
                          busy ||
                          history.page * history.pageSize >= history.total
                        }
                        onClick={() =>
                          void perform(async () =>
                            setHistory(
                              await workspaceApi<History>({
                                action: "import-history",
                                page: history.page + 1,
                              }),
                            ),
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        )}
      </main>
      <dialog
        ref={reverseDialog}
        aria-labelledby="reverse-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setReverse(null);
        }}
      >
        <h2 id="reverse-title">Reverse this import?</h2>
        <p>
          This removes {reverse?.accepted_count} transactions from{" "}
          {reverse ? accountName(reverse.account_id) : "this account"} from
          future calculations. Current results will be invalidated. The original
          records stay in the history.
        </p>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget,
              reason = String(new FormData(form).get("reason") ?? "").trim();
            if (!reason || reason.length > 100) {
              setErrors({
                reason: "Explain the correction in 1–100 characters.",
              });
              focusFirstError(form, { reason: "required" });
              return;
            }
            void perform(async () => {
              await workspaceApi({
                action: "reverse-import",
                importId: reverse!.id,
                reason,
              });
              await reload();
              setReverse(null);
              setMessage(
                "Import reversed. Review a corrected file and recalculate your gains.",
              );
              form.reset();
            });
          }}
        >
          <Field
            id="reason"
            name="reason"
            label="Reason for reversing"
            maxLength={100}
            error={errors.reason}
          />
          <div className="actions">
            <Button
              variant="secondary"
              autoFocus
              data-modal-cancel
              disabled={busy}
              onClick={() => setReverse(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" busy={busy}>
              {busy ? "Reversing…" : "Reverse import"}
            </Button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={leaveDialog}
        aria-labelledby="leave-title"
        onCancel={() => setLeaveAction(null)}
      >
        <h2 id="leave-title">Leave this workspace?</h2>
        <p>
          Unsaved form entries and local file selections will be lost. Saved
          previews remain available. A request already sent may still finish.
        </p>
        <div className="actions">
          <Button
            variant="secondary"
            autoFocus
            data-modal-cancel
            onClick={() => setLeaveAction(null)}
          >
            Stay here
          </Button>
          <Button
            onClick={() => {
              const action = leaveAction;
              setLeaveAction(null);
              setDirty(false);
              action?.();
            }}
          >
            Leave workspace
          </Button>
        </div>
      </dialog>
    </div>
  );
}
