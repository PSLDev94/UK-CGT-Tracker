"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkspaceEntry } from "./workspace-entry";
import { safeReturnPath } from "./return-path";
import { latestCalculation } from "./latest-calculation";
import { PortfolioOverview } from "./portfolio-overview";
import {
  DashboardSidebar,
  type WorkspaceView,
} from "@/components/dashboard-sidebar";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { BROKERS } from "../domain/imports/brokers";
import {
  TAX_YEARS,
  calendarDate,
  ukCalendarDate,
  plusDays,
  type TaxYear,
} from "../domain/values";
import { authApi, workspaceApi, ApiError } from "./api";
import {
  Button,
  Field,
  SelectField,
  Notice,
  focusFirstError,
} from "./primitives";
import { ImportHistoryDetail, ImportReceiptIdentity } from "./import-history-detail";
import { ImportReviewPanel } from "./import-review";
import { ReportRecovery } from "./report-recovery";
import { SavedImportNextSteps } from "./saved-import-next-steps";
import { displayDate } from "./format";
import { CalculationResult } from "./calculation-result";
import { readDisposalLocation } from "./disposal-location";
import { useModal, useNavigationGuard, LeaveDialog } from "./navigation-guard";
import type { HistoryImport, Overview, Preview } from "./workspace-types";

type History = {
  imports: HistoryImport[];
  total: number;
  page: number;
  pageSize: number;
};
type CommitResult =
  | ({ outcome: "review_changed" | "needs_review" } & Omit<Preview, "draftId">)
  | { outcome: "committed" | "already_committed"; importId: string };

const uploadGuidance: Record<string, string> = {
  trading212: "Choose the Invest History CSV with all activity categories.",
  freetrade:
    "Choose the Activity Feed CSV. Check transfers and corporate actions separately because this export can omit them.",
  hl: "Choose the Transaction Summary CSV and have your contract notes ready.",
  ii: "Choose the trading account transactions CSV. Have contract notes for currency, identifiers and fees.",
  ibkr: "Choose an execution Flex Query CSV with ISINs, commission and base-currency FX.",
  ajbell:
    "Choose Transaction history and have contract notes for references, dealing costs and verified units.",
};
function focusHeading(heading: HTMLElement | null) {
  if (!heading) return;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: "start", behavior: "instant" });
}

// Remember only that the user chose a file in this history entry. The CSV and
// its name stay out of browser storage and are never restored across sign-ins.
function markPendingFile(selected: boolean) {
  window.history.replaceState({ ...window.history.state, cgtPendingFile: selected }, "");
}

export function WorkspaceScreen(props: { initialView?: WorkspaceView }) {
  return (
    <Suspense fallback={<p role="status">Loading workspace…</p>}>
      <WorkspaceBody {...props} />
    </Suspense>
  );
}

function WorkspaceBody({
  initialView = "accounts",
}: {
  initialView?: WorkspaceView;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ heading: string } | null>(
    null,
  );
  useEffect(() => {
    if (!focusRequest) return;
    focusHeading(document.getElementById(focusRequest.heading));
  }, [focusRequest]);
  const [history, setHistory] = useState<History | null>(null);
  const historyPage = useRef(1);
  const [userName, setUserName] = useState<string | null>(null);
  const view = initialView;
  const params = useSearchParams();
  const router = useRouter();
  const requestedDraft = view === "imports" ? params.get("draft") : null;
  const accountId = params.get("account") ??
    (data?.accounts.length === 1 ? data.accounts[0].id : "");
  const selectedAccount = data?.accounts.find((account) => account.id === accountId);
  const format = params.get("format") === "canonical-v1" ? "canonical-v1" : "native";
  function chooseUploadOption(key: "account" | "format", value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState({ cgtPendingFile: Boolean(file) }, "", url);
    setOrdinarySharesConfirmed(false);
  }
  const uploadParams = new URLSearchParams(params);
  if (selectedAccount) uploadParams.set("account", selectedAccount.id);
  const uploadLocation = "/dashboard/upload" + (uploadParams.size ? "?" + uploadParams : "");
  const brokerHelp = "/supported-brokers?" + new URLSearchParams({ from: safeReturnPath(uploadLocation) });
  const savedImportId = view === "imports" ? params.get("saved") : null;
  const justSaved = data?.savedReceipt?.id === savedImportId ? data.savedReceipt : null;
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const reloadGeneration = useRef(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ordinarySharesConfirmed, setOrdinarySharesConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestedYear = params.get("year") ?? "";
  const latestRun = latestCalculation(data?.calculations ?? []);
  const taxYear = (
    Object.hasOwn(TAX_YEARS, requestedYear)
      ? requestedYear
      : (latestRun?.tax_year ?? "2025-26")
  ) as TaxYear;
  const currentCalculation = data?.calculations.find((c) => c.tax_year === taxYear);
  const previousInputs = !currentCalculation &&
    data?.previousCalculationInputs?.find((input) => input.taxYear === taxYear);
  const disposalLocation = readDisposalLocation(params.get("source"));
  const savedDate = currentCalculation?.result.historyThrough ?? "";
  const savedAccounts = currentCalculation?.coverage_accounts ??
    (currentCalculation?.coverage_confirmed ? data!.accounts.map((account) => account.id) : []);
  const [calculationDraft, setCalculationDraft] = useState<{
    year: string;
    revision: number;
    historyThrough: string;
    confirmedAccountIds: string[];
  } | null>(null);
  const draft = calculationDraft?.year === taxYear && calculationDraft.revision === data?.portfolio.revision
    ? calculationDraft : null;
  const historyThrough = draft?.historyThrough ?? savedDate;
  const confirmedAccountIds = draft?.confirmedAccountIds ?? savedAccounts;
  const settingsEdited = historyThrough !== savedDate ||
    confirmedAccountIds.length !== savedAccounts.length ||
    confirmedAccountIds.some((id) => !savedAccounts.includes(id));
  const withRecoveryYear = (path: string) => Object.hasOwn(TAX_YEARS, requestedYear)
    ? path + (path.includes("?") ? "&" : "?") + "year=" + encodeURIComponent(requestedYear)
    : path;
  function editCalculation(date: string, accounts: string[]) {
    if (data) setCalculationDraft({ year: taxYear, revision: data.portfolio.revision, historyThrough: date, confirmedAccountIds: accounts });
    setMessage("");
  }
  const [formDirty, setDirty] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const dirty = formDirty || detailsDirty || (view === "imports" && ordinarySharesConfirmed && !preview) ||
    (view === "calculations" && settingsEdited);
  const [reverse, setReverse] = useState<HistoryImport | null>(null);
  const navigation = useNavigationGuard(dirty || !!file, busy);
  const reverseDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  useModal(reverseDialog, !!reverse);

  const fail = useCallback((caught: unknown) => {
    const problem = caught as ApiError;
    if (problem.status === 401) setAuthRequired(true);
    setError(
      problem.message || "This action could not be completed. Try again.",
    );
    requestAnimationFrame(() => messageRef.current?.focus());
  }, []);

  const reload = useCallback(async (receiptId = savedImportId) => {
    const generation = ++reloadGeneration.current;
    const [overview, imports] = await Promise.all([
      workspaceApi<Overview>({ action: "overview", surface: view, ...(receiptId && { receiptId }) }),
      view === "history" ? workspaceApi<History>({ action: "import-history", page: historyPage.current }) : null,
    ]);
    if (generation === reloadGeneration.current) {
      setData(overview);
      setHistory(imports);
    }
  }, [view, savedImportId]);

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
    if (
      !requestedDraft ||
      !data ||
      preview?.draftId === requestedDraft ||
      !data.drafts.some((d) => d.id === requestedDraft)
    )
      return;
    let current = true;
    workspaceApi<Preview>({
      action: "review-import",
      draftId: requestedDraft,
      page: 1,
    })
      .then((result) => {
        if (current) {
          setFailedDraft(null);
          setPreview(result);
        }
      })
      .catch((caught) => {
        if (current) {
          setFailedDraft(requestedDraft);
          fail(caught);
        }
      });
    return () => {
      current = false;
    };
  }, [requestedDraft, data, preview?.draftId, previewAttempt, fail]);

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

  function openHistoryPage(page: number) {
    void perform(async () => {
      const result = await workspaceApi<History>({ action: "import-history", page });
      historyPage.current = result.page;
      setHistory(result);
    });
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
      const account = await workspaceApi<{ id: string }>({
        action: "add-account",
        portfolioId: data!.portfolio.id,
        broker,
        label,
        accountType: "GIA",
      });
      await reload();
      form.reset();
      setDirty(false);
      router.push(
        withRecoveryYear("/dashboard/upload?account=" + encodeURIComponent(account.id)),
      );
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
      setPreviewFile({ id: result.draftId, name: file!.name });
      setPreview(result);
      markPendingFile(false);
      window.history.pushState(
        null,
        "",
        withRecoveryYear("/dashboard/upload?draft=" + encodeURIComponent(result.draftId)),
      );
      setOrdinarySharesConfirmed(false);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setDirty(false);
      await reload();
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
      try {
        await workspaceApi({
          action: "calculate",
          portfolioId: data!.portfolio.id,
          portfolioRevision: data!.portfolio.revision,
          taxYear,
          historyThrough,
          confirmedAccountIds: values.getAll("confirmedAccountIds"),
        });
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "PORTFOLIO_CHANGED") {
          setCalculationDraft(null);
          await reload();
        }
        throw caught;
      }
      await reload();
      setCalculationDraft(null);
      setDirty(false);
      setMessage("Calculation saved.");
      setFocusRequest({ heading: "calculation-result-heading" });
    });
  }

  const signOut = () =>
    void perform(async () => {
      await authApi("sign-out", {});
      if (file) markPendingFile(false);
      setData(null);
      setPreview(null);
      setFile(null);
      setDirty(false);
      setAuthRequired(true);
      router.refresh();
      setMessage("You have been signed out.");
    });
  const accountName = (id: string) =>
    data?.accounts.find((a) => a.id === id)?.label ?? "Broker account";
  const auditDate = (date: string) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(new Date(date));

  if (authRequired) {
    return <WorkspaceEntry next={window.location.pathname + window.location.search} message={message} />;
  }
  if (userName === null) {
    return (
      <main id="main" className="classic-auth">
        {loading ? <Notice>Loading your workspace…</Notice> : (
          <section className="auth-wrap panel">
            <h1>Your workspace couldn’t be loaded</h1>
            {error && <Notice tone="error">{error}</Notice>}
            <Button onClick={() => { setLoading(true); setError(""); void initialise(); }}>Try again</Button>
          </section>
        )}
      </main>
    );
  }

  return (
    <div className="workspace">
      <DashboardSidebar
        userEmail={userName}
        brokerSupportHref={view === "imports" ? brokerHelp : undefined}
        busy={busy}
        onSignOut={() => navigation.request(signOut)}
      />
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
                imports: requestedDraft ? "Review your import" : "Upload CSV",
                calculations: "Calculations",
                overview: "Overview",
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
        ) : !data ? (
          <section className="panel">
            <h2>Your workspace couldn’t be loaded</h2>
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
            {view === "overview" && (
              <PortfolioOverview data={data} latestRun={latestRun} />
            )}
            {view === "accounts" && (
              <section>
                {data.accounts.length > 0 && (
                  <div
                    className="portfolio-summary"
                    role="group"
                    aria-label="Portfolio summary"
                  >
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
                        {(data.importCount ?? data.imports.length).toLocaleString("en-GB")}
                      </strong>
                      <small>Including reversed imports</small>
                    </div>
                    <div>
                      <span>Saved previews</span>
                      <strong>
                        {data.drafts.length.toLocaleString("en-GB")}
                      </strong>
                      <small>Awaiting your review</small>
                    </div>
                  </div>
                )}
                <div className="accounts-layout">
                  {data.accounts.length > 0 && (
                    <div className="panel accounts-panel">
                      <h2>Your taxable accounts</h2>
                      <ul className="record-list">
                        {data.accounts.map((a) => (
                          <li key={a.id}>
                            <div>
                              <strong>{a.label}</strong>
                              <p>
                                {BROKERS.find((b) => b.id === a.broker)?.name} ·
                                Taxable general investment account
                              </p>
                            </div>
                            <Link
                              href={
                                withRecoveryYear("/dashboard/upload?account=" +
                                encodeURIComponent(a.id))
                              }
                              aria-label={`Upload CSV for ${a.label}`}
                            >
                              Upload CSV{" "}
                              <ArrowUpRight size={14} aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <section className="panel account-form">
                    <h2>
                      {data.accounts.length
                        ? "Add a broker account"
                        : "Start with your first broker account."}
                    </h2>
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
            )}
            {view === "imports" && (
              <section>
                {Object.hasOwn(TAX_YEARS, requestedYear) && !justSaved && (
                  <p className="caption">
                    After saving the earlier acquisitions, return to your {requestedYear} calculation.
                  </p>
                )}
                {justSaved && !requestedDraft && (
                  <section className="panel">
                    <h2
                      ref={focusHeading}
                      id="saved-import-heading"
                      tabIndex={-1}
                      className="scroll-mt-20"
                    >
                      Transactions saved
                    </h2>
                    <SavedImportNextSteps
                      receipt={justSaved}
                      accountName={accountName(justSaved.account_id)}
                      requestedYear={Object.hasOwn(TAX_YEARS, requestedYear) ? requestedYear : undefined}
                      staleYears={data.staleReportYears ?? []}
                      uploadPath={withRecoveryYear("/dashboard/upload?" + new URLSearchParams({ account: justSaved.account_id }))}
                    />
                  </section>
                )}
                {justSaved && !requestedDraft && (
                  <ReportRecovery
                    years={data.staleReportYears ?? []}
                    draftId={data.drafts[0]?.id}
                    linkedYears={[...justSaved.disposalYears.map(({ year }) => year), requestedYear].filter((year) => Object.hasOwn(TAX_YEARS, year))}
                  />
                )}
                {requestedDraft &&
                  preview?.draftId !== requestedDraft &&
                  !data.drafts.some((d) => d.id === requestedDraft) && (
                    <section className="panel">
                      <h2>This preview is unavailable</h2>
                      <p>It may have expired, been saved or been discarded.</p>
                      <Link href={withRecoveryYear("/dashboard/upload")}>Choose another file</Link>
                    </section>
                  )}
                {requestedDraft &&
                  data.drafts.some((d) => d.id === requestedDraft) &&
                  preview?.draftId !== requestedDraft &&
                  (failedDraft === requestedDraft ? (
                    <section className="panel">
                      <h2>Preview could not be opened</h2>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setFailedDraft(null);
                          setError("");
                          setPreviewAttempt((n) => n + 1);
                        }}
                      >
                        Try opening preview again
                      </Button>
                    </section>
                  ) : (
                    <Notice>Opening saved preview…</Notice>
                  ))}
                {!data.accounts.length ? (
                  <section className="panel">
                    <h2>Add an account first.</h2>
                    <p>
                      Each uploaded file needs a broker and account so its
                      records remain identifiable.
                    </p>
                    <Link className="button primary" href={withRecoveryYear("/dashboard/accounts")}>
                      Add broker account
                    </Link>
                  </section>
                ) : (
                  !requestedDraft &&
                  !justSaved && (
                    <section className="panel">
                      <h2>Review a CSV file</h2>
                      <form
                        noValidate
                        onSubmit={upload}
                        className="form-stack"
                      >
                        <div className="form-columns">
                          <SelectField
                            id="accountId"
                            name="accountId"
                            label="Broker account"
                            error={errors.accountId}
                            value={selectedAccount?.id ?? ""}
                            onChange={(e) => chooseUploadOption("account", e.target.value)}
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
                            value={format}
                            onChange={(e) => chooseUploadOption("format", e.target.value)}
                          >
                            <option value="native">
                              Original broker export
                            </option>
                            <option value="canonical-v1">
                              CGT Tracker CSV template
                            </option>
                          </SelectField>
                        </div>
                        {selectedAccount && (
                          <p className="caption">
                            {format === "native" ? (
                              <>
                                {uploadGuidance[selectedAccount.broker]}{" "}
                                <Link
                                  className="underline underline-offset-2"
                                  href={`${brokerHelp}#${selectedAccount.broker}`}
                                >
                                  See export instructions
                                </Link>
                              </>
                            ) : (
                              <Link href={`${brokerHelp}#template`}>
                                Check the reviewed CSV template columns
                              </Link>
                            )}
                          </p>
                        )}
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
                                const selected = e.target.files?.[0] ?? null;
                                setFile(selected);
                                markPendingFile(!!selected);
                                setOrdinarySharesConfirmed(false);
                              }}
                              aria-invalid={!!errors.csv}
                              aria-describedby={`csv-help${errors.csv ? " csv-error" : ""}`}
                            />
                            <small id="csv-help">
                              One UTF-8 CSV, up to 10 MiB. Choose Review file
                              before leaving. If you use Back, Forward or reload
                              first, you may need to choose the file again.
                            </small>
                            {errors.csv && (
                              <small id="csv-error" className="field-error">
                                {errors.csv}
                              </small>
                            )}
                          </div>
                          {file && (
                            <p className="caption">
                              Selected: {file.name} ·{" "}
                              {Math.ceil(file.size / 1024)} KiB
                            </p>
                          )}
                          {!file && window.history.state?.cgtPendingFile && (
                            <Notice>Choose your CSV again to continue. Your earlier selection was not uploaded.</Notice>
                          )}
                        </div>
                        {format === "native" && (
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
                              For a native broker export, I have checked that
                              every traded instrument is an ordinary share, not
                              a fund, ETF, bond or derivative. Leave unchecked
                              if unsure; the file will stay in review.
                            </span>
                          </label>
                        )}
                        <div>
                          <Button type="submit" busy={busy}>
                            {busy ? "Reviewing…" : "Review file"}
                          </Button>
                        </div>
                      </form>
                    </section>
                  )
                )}
                {preview && requestedDraft === preview.draftId && (
                  <ImportReviewPanel
                    key={preview.draftId}
                    preview={preview}
                    onDirty={setDetailsDirty}
                    onDetails={async (record, details) => {
                      if (busyRef.current)
                        throw new Error("Another action is in progress.");
                      busyRef.current = true;
                      setBusy(true);
                      try {
                        const result = await workspaceApi<Preview>({
                          action: "supply-import-details",
                          draftId: preview.draftId,
                          record,
                          details,
                          reviewVersion: preview.reviewVersion ?? 0,
                        });
                        setPreview(result);
                      } finally {
                        busyRef.current = false;
                        setBusy(false);
                      }
                    }}
                    accountLabel={accountName(preview.accountId)}
                    fileLabel={
                      (previewFile?.id === preview.draftId
                        ? previewFile.name + " · "
                        : "") + `Preview ${preview.draftId.slice(0, 8)}`
                    }
                    expiry={
                      data.drafts.find((d) => d.id === requestedDraft)
                        ?.expires_at
                    }
                    broker={
                      data.accounts.find((a) => a.id === preview.accountId)
                        ?.broker ?? ""
                    }
                    busy={busy}
                    onPage={(page, onLoaded) =>
                      void perform(async () => {
                        setPreview(
                          await workspaceApi<Preview>({
                            action: "review-import",
                            draftId: preview.draftId,
                            page,
                          }),
                        );
                        onLoaded?.();
                      })
                    }
                    onDiscard={() =>
                      void perform(async () => {
                        await workspaceApi({
                          action: "discard-draft",
                          draftId: preview.draftId,
                        });
                        window.history.replaceState(
                          null,
                          "",
                          withRecoveryYear("/dashboard/upload?account=" +
                            encodeURIComponent(preview.accountId)),
                        );
                        setPreview(null);
                        setPreviewFile(null);
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
                          reviewVersion: preview.reviewVersion ?? 0,
                        });
                        if (!("importId" in result)) {
                          setPreview({ ...result, draftId: preview.draftId });
                          setMessage(
                            "The review changed or needs attention. Check the latest records before confirming again.",
                          );
                          return;
                        }
                        window.history.replaceState(
                          null,
                          "",
                          withRecoveryYear("/dashboard/upload?saved=" +
                            encodeURIComponent(result.importId)),
                        );
                        setPreview(null);
                        setPreviewFile(null);
                        await reload(result.importId);
                        setMessage(
                          result.outcome === "already_committed"
                            ? "This import was already saved. No duplicate transactions were added."
                            : "",
                        );
                      })
                    }
                  />
                )}
                {!requestedDraft && !justSaved && data.drafts.length > 0 && (
                  <section className="panel">
                    <h2>Saved previews</h2>
                    <ul className="record-list">
                      {data.drafts.map((d) => (
                        <li key={d.id}>
                          <div>
                            <strong>{accountName(d.account_id)}</strong>
                            <p>
                              Preview {d.id.slice(0, 8)} · Expires{" "}
                              {auditDate(d.expires_at)} (London)
                            </p>
                          </div>
                          <a
                            className="button secondary"
                            href={
                              withRecoveryYear("/dashboard/upload?draft=" +
                              encodeURIComponent(d.id))
                            }
                          >
                            Open preview
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </section>
            )}
            {view === "calculations" && (
              <section>
                <div className="calculation-layout">
                  <div className="calculation-year">
                    <SelectField
                      id="taxYear"
                      name="taxYear"
                      label="Tax year"
                      value={taxYear}
                      disabled={busy}
                      onChange={(e) => {
                        setCalculationDraft(null);
                        setErrors({});
                        setError("");
                        setMessage("");
                        window.history.replaceState(
                          null,
                          "",
                          "/dashboard/calculations?year=" +
                            encodeURIComponent(e.target.value),
                        );
                      }}
                    >
                      {Object.keys(TAX_YEARS)
                        .reverse()
                        .map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                    </SelectField>
                  </div>
                  {currentCalculation && (
                    <CalculationResult
                      runId={currentCalculation.id}
                      location={disposalLocation}
                      result={currentCalculation.result}
                      coverage={currentCalculation.coverage_confirmed}
                      confirmedAccounts={savedAccounts.map(accountName)}
                      settingsEdited={settingsEdited}
                    />
                  )}
                  {disposalLocation && !currentCalculation && (
                    <Notice>The saved calculation for this receipt is no longer available. Recalculate this year to see the current disposals.</Notice>
                  )}
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
                      className="form-stack"
                    >
                      {previousInputs && (
                        <section aria-label="Previous calculation settings" className="space-y-2 rounded-lg border p-4">
                          <h3>Previous calculation settings</h3>
                          <p>History through <strong>{displayDate(previousInputs.historyThrough)}</strong>.</p>
                          {previousInputs.confirmedAccountIds.length ? (
                            <>
                              <p>Previously confirmed accounts</p>
                              <ul className="grid list-disc gap-x-8 gap-y-1 pl-5 sm:grid-cols-2">
                                {previousInputs.confirmedAccountIds.map((id) => (
                                  <li key={id}>{data.accounts.find((account) => account.id === id)?.label ?? "Account no longer available"}</li>
                                ))}
                              </ul>
                            </>
                          ) : <p>No account confirmations were recorded.</p>}
                          <p>Review the changed history and confirm coverage again below.</p>
                          <Button
                            variant="secondary"
                            disabled={busy || historyThrough === previousInputs.historyThrough}
                            onClick={() => {
                              editCalculation(previousInputs.historyThrough, []);
                              setErrors({});
                              document.getElementById("historyThrough")?.focus();
                            }}
                          >Use previous date</Button>
                        </section>
                      )}
                      <div className="calculation-cutoff">
                        <Field
                          id="historyThrough"
                          name="historyThrough"
                          label="History complete through"
                          disabled={busy}
                          value={historyThrough}
                          onChange={(event) => editCalculation(event.target.value, [])}
                          placeholder="2026-05-05"
                          hint={`Use YYYY-MM-DD. For ${taxYear}, matching can need history through ${plusDays(TAX_YEARS[taxYear].end, 30)}. Confirm only dates covered by your records.`}
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
                                disabled={busy}
                                checked={confirmedAccountIds.includes(a.id)}
                                onChange={(event) => editCalculation(historyThrough, event.target.checked
                                  ? [...confirmedAccountIds, a.id]
                                  : confirmedAccountIds.filter((id) => id !== a.id))}
                              />
                              <span>{a.label}</span>
                            </label>
                          ))
                        ) : (
                          <Link href="/dashboard/accounts">
                            Add your first broker account
                          </Link>
                        )}
                      </fieldset>
                      <p className="caption">
                        Confirm each account up to the date above. Changing that date clears the checkboxes.
                      </p>
                      {settingsEdited && currentCalculation && (
                        <Notice tone="warning">
                          Settings changed. Recalculate to update the saved result and reports for {taxYear}.
                        </Notice>
                      )}
                      <div>
                        <Button
                          type="submit"
                          busy={busy}
                          disabled={!data.accounts.length}
                        >
                          {busy ? "Calculating…" : currentCalculation ? "Recalculate" : "Calculate gains"}
                        </Button>
                      </div>
                    </form>
                  </section>
                </div>
              </section>
            )}
            {view === "history" && (
              <section>
                <section className="panel">
                  {!history?.total ? (
                    <div className="empty">
                      <h2>No saved imports yet.</h2>
                      <p>
                        Review a file, then save its validated transactions to
                        begin your history.
                      </p>
                      <Link className="button primary" href="/dashboard/upload">
                        Review a file
                      </Link>
                    </div>
                  ) : (
                    <>
                      <h2>Saved imports ({history.total.toLocaleString("en-GB")})</h2>
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
                              <ImportReceiptIdentity item={item} />
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
                            <ImportHistoryDetail importId={item.id}>
                              <p>Import reference {item.id}</p>
                              <p>
                                Source account: {accountName(item.account_id)}.
                                Saved {auditDate(item.created_at)} (London).
                              </p>
                              <p>
                                {item.status === "committed"
                                  ? "These included transactions are used in your calculations."
                                  : "These transactions are excluded from future calculations."}
                              </p>
                              {item.status === "committed" && (
                                <Button
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={(event) => {
                                    event.currentTarget.focus({ preventScroll: true });
                                    setReverse(item);
                                    setErrors({});
                                  }}
                                >
                                  Reverse import
                                </Button>
                              )}
                            </ImportHistoryDetail>
                          </li>
                        ))}
                      </ul>
                      {history.total > history.pageSize && <div className="pagination">
                        <Button
                          variant="secondary"
                          disabled={busy || history.page === 1}
                          onClick={() => openHistoryPage(history.page - 1)}
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
                          onClick={() => openHistoryPage(history.page + 1)}
                        >
                          Next
                        </Button>
                      </div>}
                    </>
                  )}
                </section>
              </section>
            )}
          </>
        )}
      </main>
      <dialog
        ref={reverseDialog}
        aria-labelledby="reverse-title"
        aria-describedby={reverse ? "reverse-identity reverse-consequence" : undefined}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setReverse(null);
        }}
      >
        <h2 id="reverse-title">Reverse this import?</h2>
        {reverse && (
          <>
            <div id="reverse-identity"><ImportReceiptIdentity item={reverse} /></div>
            <p id="reverse-consequence">
              Future calculations for {accountName(reverse.account_id)} will exclude{" "}
              {reverse.accepted_count} {reverse.accepted_count === 1 ? "transaction" : "transactions"}.
              Current results will be invalidated. The original records stay in the history.
            </p>
          </>
        )}
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
      <LeaveDialog guard={navigation} title="Leave this workspace?" confirm="Leave workspace">
        Unsaved form entries and local file selections will be lost. Saved previews remain
        available. A request already sent may still finish.
      </LeaveDialog>
    </div>
  );
}
