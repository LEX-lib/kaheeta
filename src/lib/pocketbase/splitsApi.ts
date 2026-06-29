import { pb } from "./index";

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

export function deleteGroup(groupId: string): Promise<void> {
  return pb.send(`/api/kaheeta/groups/${groupId}`, { method: "DELETE" });
}
