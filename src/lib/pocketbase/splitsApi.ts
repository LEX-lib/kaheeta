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

/** Add a member by users record id (used by the "frequent members" shortcuts). */
export function addMemberAsUser(groupId: string, userId: string): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}/members`, {
    method: "POST",
    body: { user: userId },
  });
}

/** A people shortcut resolved server-side from the caller's owned groups. */
export interface SuggestedMember {
  user: string; // users record id
  name: string;
  email: string;
  avatar: string;
  shared_groups: number; // how many of the caller's groups this person is in
}

/**
 * People the caller has shared groups with, most frequent first, excluding the
 * caller and anyone already in `groupId`. Owner-only; names are resolved
 * server-side because the users view rule is self-only.
 */
export function getSuggestedMembers(groupId: string): Promise<{ contacts: SuggestedMember[] }> {
  return pb.send(`/api/kaheeta/groups/${groupId}/suggested-members`, { method: "GET" });
}

/** A group member with their resolved display fields (from the superuser route). */
export interface GroupMemberInfo {
  id: string; // membership record id
  user: string; // users record id
  name: string;
  email: string;
  avatar: string;
}

/**
 * List a group's members with names/emails resolved server-side. Needed because
 * the users collection view rule is self-only, so the client can't expand other
 * members' names directly.
 */
export function getGroupMembers(groupId: string): Promise<{ members: GroupMemberInfo[] }> {
  return pb.send(`/api/kaheeta/groups/${groupId}/members`, { method: "GET" });
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
 *
 * When a receipt file is supplied the request is sent as multipart (the JSON
 * payload plus the file); otherwise the plain JSON body is used, so the hook
 * keeps accepting both shapes.
 */
export function createSplitExpense(
  payload: CreateSplitExpensePayload,
  opts: SplitExpenseFileOptions = {},
): Promise<CreateSplitExpenseResult> {
  return pb.send<CreateSplitExpenseResult>("/api/kaheeta/split-expenses", {
    method: "POST",
    body: buildExpenseBody(payload, opts),
  });
}

/**
 * Edit a split expense atomically: update its fields and REPLACE its shares.
 * The `group` in the payload is ignored server-side (an expense can't move
 * groups). Any member of the expense's group is permitted (group-less rows:
 * only the adder).
 */
export function updateSplitExpense(
  expenseId: string,
  payload: CreateSplitExpensePayload,
  opts: SplitExpenseFileOptions = {},
): Promise<CreateSplitExpenseResult> {
  return pb.send<CreateSplitExpenseResult>(`/api/kaheeta/split-expenses/${expenseId}`, {
    method: "PATCH",
    body: buildExpenseBody(payload, opts),
  });
}

/** Optional receipt handling for split-expense writes. */
export interface SplitExpenseFileOptions {
  /** A new receipt to upload (replaces any existing one). */
  receipt?: File | null;
  /** Clear the stored receipt (ignored when `receipt` is also set). */
  removeReceipt?: boolean;
}

function buildExpenseBody(
  payload: CreateSplitExpensePayload,
  opts: SplitExpenseFileOptions,
): (CreateSplitExpensePayload & { remove_receipt?: boolean }) | FormData {
  if (opts.receipt) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    formData.append("receipt", opts.receipt);
    return formData;
  }
  if (opts.removeReceipt) {
    return { ...payload, remove_receipt: true };
  }
  return payload;
}

/**
 * Soft-delete a split expense (or settlement) by id. The hook stamps
 * `deleted_at` so balance recomputes exclude it. Any member of the expense's
 * group is permitted (group-less rows: only the adder).
 */
export function deleteSplitExpense(expenseId: string): Promise<void> {
  return pb.send(`/api/kaheeta/split-expenses/${expenseId}`, { method: "DELETE" });
}
