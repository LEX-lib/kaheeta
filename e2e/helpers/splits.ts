import type { Page } from "@playwright/test";

type Rec = Record<string, unknown>;

export interface SplitSeed {
  /** Pre-existing expenses in the "Trip" group (id g1). */
  expenses?: Rec[];
  /** Shares for those expenses. */
  shares?: Rec[];
}

/**
 * Stateful mock of the split-feature backend. Renders one group "Trip" (id g1)
 * owned by the e2e user, with three members (You / Bob / Carol), plus any seeded
 * expenses + shares. The hook routes mutate the in-memory stores so the UI
 * re-reads reflect writes:
 *   - POST /api/kaheeta/split-expenses        → appends an expense + its shares
 *   - DELETE /api/kaheeta/split-expenses/{id} → soft-deletes (stamps deleted_at)
 *   - DELETE /api/kaheeta/groups/{id}         → removes the group
 * List reads honour the `deleted_at = ""` filter so soft-deleted rows drop out.
 *
 * Register AFTER stubPocketBase so these routes win. Returns `{ posted }` — the
 * bodies POSTed to the create hook — for write assertions.
 */
export async function mockSplitsApi(
  page: Page,
  seed: SplitSeed = {},
): Promise<{ posted: Rec[] }> {
  const posted: Rec[] = [];
  let seq = 0;
  const genId = (prefix: string): string => `${prefix}${(seq += 1)}`;

  const groups: Rec[] = [
    {
      id: "g1",
      collectionId: "kaheeta_groups",
      collectionName: "kaheeta_groups",
      name: "Trip",
      default_currency: "PHP",
      created_by: "e2e_user",
      simplify_debts: false,
      public_id: "TRIPCODE123456",
      archived_at: "",
      created: "2026-01-01 00:00:00.000Z",
      updated: "2026-01-01 00:00:00.000Z",
    },
  ];

  const member = (id: string, user: string, name: string): Rec => ({
    id,
    collectionId: "kaheeta_group_members",
    collectionName: "kaheeta_group_members",
    group: "g1",
    user,
    expand: { user: { id: user, name, email: `${user}@example.com` } },
    created: "2026-01-01 00:00:00.000Z",
    updated: "2026-01-01 00:00:00.000Z",
  });
  const members: Rec[] = [
    member("m1", "e2e_user", "You"),
    member("m2", "u_bob", "Bob"),
    member("m3", "u_carol", "Carol"),
  ];

  const expenses: Rec[] = (seed.expenses ?? []).map((e) => ({
    collectionId: "kaheeta_split_expenses",
    collectionName: "kaheeta_split_expenses",
    deleted_at: "",
    ...e,
  }));
  const shares: Rec[] = (seed.shares ?? []).map((s) => ({
    collectionId: "kaheeta_split_shares",
    collectionName: "kaheeta_split_shares",
    ...s,
  }));

  const listBody = (items: Rec[]): string =>
    JSON.stringify({ page: 1, perPage: 200, totalItems: items.length, totalPages: 1, items });
  const json = (route: import("@playwright/test").Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  const liveExpenses = () => expenses.filter((e) => !e.deleted_at);

  // --- Collection list reads ---
  await page.route(/\/api\/collections\/kaheeta_groups\/records(\?|$)/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: listBody(groups) }),
  );
  await page.route(/\/api\/collections\/kaheeta_group_members\/records(\?|$)/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: listBody(members) }),
  );
  await page.route(/\/api\/collections\/kaheeta_split_expenses\/records(\?|$)/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: listBody(liveExpenses()) }),
  );
  await page.route(/\/api\/collections\/kaheeta_split_shares\/records(\?|$)/, (r) => {
    const liveIds = new Set(liveExpenses().map((e) => e.id));
    const live = shares.filter((s) => liveIds.has(s.expense));
    return r.fulfill({ status: 200, contentType: "application/json", body: listBody(live) });
  });

  // --- Create hook (append expense + shares) ---
  await page.route("**/api/kaheeta/split-expenses", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = JSON.parse(route.request().postData() ?? "{}") as Rec;
    posted.push(body);
    const id = genId("e_");
    expenses.push({
      id,
      collectionId: "kaheeta_split_expenses",
      collectionName: "kaheeta_split_expenses",
      group: body.group,
      paid_by: body.paid_by,
      added_by: "e2e_user",
      name: body.name,
      amount: body.amount,
      currency: body.currency,
      split_type: body.split_type,
      expense_date: body.expense_date,
      deleted_at: "",
      created: "2026-06-30 00:00:00.000Z",
      updated: "2026-06-30 00:00:00.000Z",
    });
    for (const s of (body.shares as Array<{ user: string; amount: number }>) ?? []) {
      shares.push({
        id: genId("sh_"),
        collectionId: "kaheeta_split_shares",
        collectionName: "kaheeta_split_shares",
        expense: id,
        user: s.user,
        amount: s.amount,
      });
    }
    return json(route, 200, { id, name: body.name, amount: body.amount });
  });

  // --- Delete expense hook (soft delete) ---
  await page.route(/\/api\/kaheeta\/split-expenses\/[^/?]+/, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const ex = expenses.find((e) => e.id === id);
    if (ex) ex.deleted_at = "2026-06-30 00:00:00.000Z";
    return json(route, 200, { ok: true });
  });

  // --- Group single-id ops (delete / archive) ---
  await page.route(/\/api\/kaheeta\/groups\/[^/?]+(\?|$)/, async (route) => {
    const method = route.request().method();
    const id = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    if (method === "DELETE") {
      const idx = groups.findIndex((g) => g.id === id);
      if (idx !== -1) groups.splice(idx, 1);
      return json(route, 200, { ok: true });
    }
    if (method === "PATCH") {
      return json(route, 200, { ok: true });
    }
    return route.fallback();
  });

  return { posted };
}
