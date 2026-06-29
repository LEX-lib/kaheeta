import type { RecordModel } from "pocketbase";

/** A shared expense-splitting group (collection: kaheeta_groups). */
export interface Group extends RecordModel {
  id: string;
  created: string;
  updated: string;
  name: string;
  image?: string; // MaxSelect=1 returns filename or empty string
  created_by: string; // users record id of the owner
  default_currency: string;
  simplify_debts: boolean;
  public_id: string; // invite/join code
  archived_at?: string; // ISO date string; empty when active
}

/** Minimal user shape returned via `expand: 'user'` on a membership row. */
export interface MemberUser {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

/** Group membership junction row (collection: kaheeta_group_members). */
export interface GroupMember extends RecordModel {
  id: string;
  created: string;
  updated: string;
  group: string; // kaheeta_groups record id
  user: string; // users record id
  expand?: {
    user?: MemberUser;
  };
}

/** How an expense's amounts were derived (metadata for re-editing only). */
export type SplitType =
  | "equal"
  | "exact"
  | "percentage"
  | "share"
  | "adjustment"
  | "settlement";

/**
 * A shared expense or a settlement (collection: kaheeta_split_expenses).
 * `amount` is an integer in minor units (cents) — NOT decimals like
 * wallecx_expenses. See docs/features/shared-splits-plan.md (decision 4).
 */
export interface SplitExpense extends RecordModel {
  id: string;
  created: string;
  updated: string;
  group: string; // kaheeta_groups record id; empty string = friend-to-friend
  paid_by: string; // users record id of the single payer
  added_by: string; // users record id of whoever recorded it
  name: string;
  category?: string;
  amount: number; // integer minor units (cents)
  currency: string;
  split_type: SplitType;
  expense_date: string; // ISO date string
  deleted_at?: string; // ISO date string; empty when active (soft delete)
  notes?: string;
  expand?: {
    paid_by?: MemberUser;
  };
}

/**
 * One participant's owed portion of an expense (collection:
 * kaheeta_split_shares). Unique per (expense, user). `amount` is integer cents.
 */
export interface SplitShare extends RecordModel {
  id: string;
  created: string;
  updated: string;
  expense: string; // kaheeta_split_expenses record id
  user: string; // users record id
  amount: number; // integer minor units (cents)
}

/** Body for POST /api/kaheeta/split-expenses. */
export interface CreateSplitExpensePayload {
  group: string; // kaheeta_groups record id
  name: string;
  amount: number; // integer minor units (cents); must equal the sum of shares
  currency: string;
  split_type: SplitType;
  expense_date: string; // ISO date string
  paid_by: string; // users record id of the payer
  notes?: string;
  shares: Array<{ user: string; amount: number }>;
}

/** Response from POST /api/kaheeta/split-expenses. */
export interface CreateSplitExpenseResult {
  id: string;
  name: string;
  amount: number;
}

/**
 * Net balance between the current user and one other person, in one currency.
 * Positive `amount` = the other person owes the current user; negative = the
 * current user owes them. Balances are never netted across currencies.
 */
export interface BalanceSummary {
  userId: string; // the *other* person's users record id
  currency: string;
  amount: number; // integer minor units (cents); signed (see above)
}
