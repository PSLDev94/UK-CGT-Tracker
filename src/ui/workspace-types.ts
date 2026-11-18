import type { Calculation } from "../domain/cgt/types";
import type { ImportReview } from "../domain/imports/review";
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
export interface Overview {
  portfolio: { id: string; name: string; revision: number };
  accounts: BrokerAccount[];
  imports: SavedImport[];
  importCount?: number;
  drafts: { id: string; account_id: string; expires_at: string }[];
  calculations: {
    id: string;
    tax_year: string;
    created_at?: string;
    result: Calculation;
    coverage_confirmed: boolean;
    coverage_accounts?: string[];
  }[];
}
export interface Preview {
  draftId: string;
  accountId: string;
  revision: number;
  reviewVersion?: number;
  review: ImportReview & {
    page: number;
    pageSize: number;
    issueCount: number;
    nextUnresolved: {
      record: number;
      page: number;
      canSupplyDetails: boolean;
      reason: string;
    } | null;
  };
}
