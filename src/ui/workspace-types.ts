import type { Calculation } from "../domain/cgt/types";
import type { ImportRecord, ImportReview } from "../domain/imports/review";
import type { ImportTradeDetail } from "../domain/imports/trade-detail";
export interface BrokerAccount {
  id: string;
  broker: string;
  label: string;
  account_type: "GIA";
}
export interface SavedImport {
  id: string;
  account_id: string;
  status: "committed" | "reversed";
  record_count: number;
  accepted_count: number;
  excluded_count: number;
  duplicate_count: number;
  created_at: string;
  reversal_reason?: string;
}
export interface HistoryImport extends SavedImport {
  firstTrade: Pick<ImportTradeDetail, "date" | "side" | "quantity" | "securityId"> | null;
}
export type SavedReceipt = Pick<SavedImport, "id" | "account_id" | "accepted_count"> & {
  disposalYears: { year: string; count: number }[];
};
export interface Overview {
  portfolio: { id: string; name: string; revision: number };
  accounts: BrokerAccount[];
  imports: SavedImport[];
  savedReceipt?: SavedReceipt | null;
  importCount?: number;
  drafts: { id: string; account_id: string; expires_at: string }[];
  staleReportYears?: string[];
  previousCalculationInputs?: { taxYear: string; historyThrough: string; confirmedAccountIds: string[] }[];
  calculations: {
    id: string;
    tax_year: string;
    created_at?: string;
    result: Calculation;
    evidenceIssue?: import("../domain/reports/eligibility").ReportIssue | null;
    coverage_confirmed: boolean;
    coverage_accounts?: string[];
  }[];
}
export interface Preview {
  draftId: string;
  accountId: string;
  revision: number;
  reviewVersion?: number;
  affectedReportYears?: string[];
  review: Omit<ImportReview, "records"> & {
    records: (ImportRecord & { tradeDetail?: ImportTradeDetail })[];
    page: number;
    pageSize: number;
    issueCount: number;
    sourceBlockerCount: number;
    nextUnresolved: {
      record: number;
      page: number;
      canSupplyDetails: boolean;
      reason: string;
    } | null;
  };
}
