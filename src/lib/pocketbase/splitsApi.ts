import { pb } from "./index";
import type {
  CreateSplitExpensePayload,
  CreateSplitExpenseResult,
} from "@/types/wallecx/splits/types";

/**
 * Client wrappers for the kaheeta split-feature hook routes (pb_hooks/kaheeta_splits.pb.js).
 *
 * All split writes go through these superuser routes rather than direct collection
 * writes — the kaheeta_* collections have admin-only create/update/delete rules. Reads
 * still go through the collections directly (party-scoped List/View rules + perfInstrument).
 *
 * `pb.send` attaches the auth token and JSON-encodes plain-object bodies automatically.
 */

export interface CreateGroupResult {
  id: string;
  name: string;
  public_id: string;
  default_currency: string;
}

export function createGroup(input: { name: string; defaultCurrency: string }): Promise<CreateGroupResult> {
  return pb.send<CreateGroupResult>("/api/kaheeta/groups", {
    method: "POST",
    body: { name: input.name, default_currency: input.defaultCurrency },
  });
}

export function joinGroup(publicId: string): Promise<{ id: string; name: string }> {
  return pb.send<{ id: string; name: string }>("/api/kaheeta/groups/join", {
    method: "POST",
    body: { public_id: publicId },
  });
}

export function addMemberByEmail(groupId: string, email: string): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}/members`, {
    method: "POST",
    body: { email },
  });
}

export function leaveGroup(groupId: string): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}/leave`, { method: "DELETE" });
}

export function archiveGroup(groupId: string, archived: boolean): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}`, {
    method: "PATCH",
    body: { archived },
  });
}

/** Toggle a group's display-only debt-simplification flag (owner only). */
export function setGroupSimplify(groupId: string, simplifyDebts: boolean): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}`, {
    method: "PATCH",
    body: { simplify_debts: simplifyDebts },
  });
}

export function deleteGroup(groupId: string): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}`, { method: "DELETE" });
}

/**
 * Create a split expense plus its participant shares atomically. The shares
 * must sum to `payload.amount` (integer minor units) — the hook re-validates
 * this server-side and rejects a mismatch. The caller and the payer must both
 * be members of the group.
 */
export function createSplitExpense(
  payload: CreateSplitExpensePayload,
): Promise<CreateSplitExpenseResult> {
  return pb.send<CreateSplitExpenseResult>("/api/kaheeta/split-expenses", {
    method: "POST",
    body: payload,
  });
}

/**
 * Edit a split expense atomically: update its fields and REPLACE its shares.
 * The `group` in the payload is ignored server-side (an expense can't move
 * groups). Only the expense's `added_by` or the group owner is permitted.
 */
export function updateSplitExpense(
  expenseId: string,
  payload: CreateSplitExpensePayload,
): Promise<CreateSplitExpenseResult> {
  return pb.send<CreateSplitExpenseResult>(`/api/kaheeta/split-expenses/${expenseId}`, {
    method: "PATCH",
    body: payload,
  });
}

/**
 * Soft-delete a split expense (or settlement) by id. The hook stamps
 * `deleted_at` so balance recomputes exclude it. Only the expense's `added_by`
 * or the group owner is permitted.
 */
export function deleteSplitExpense(expenseId: string): Promise<void> {
  return pb.send(`/api/kaheeta/split-expenses/${expenseId}`, { method: "DELETE" });
}
