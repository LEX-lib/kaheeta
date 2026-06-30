import type { Page } from "@playwright/test";

type Rec = Record<string, unknown>;

/**
 * Mock the split-feature backend so the Groups tab renders one group with three
 * members (the e2e user + two others) and an empty ledger, and capture any
 * POSTs to the split-expenses hook. Register AFTER stubPocketBase so these
 * more-specific routes win.
 *
 * Returns `{ posted }` — an array the POST route pushes each create body into,
 * so a test can assert a write did (or did NOT) happen.
 */
export async function mockSplitsApi(page: Page): Promise<{ posted: Rec[] }> {
  const posted: Rec[] = [];

  const group: Rec = {
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
  };

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

  const listBody = (items: Rec[]): string =>
    JSON.stringify({ page: 1, perPage: 200, totalItems: items.length, totalPages: 1, items });

  // List reads for the four split collections.
  const lists: Record<string, Rec[]> = {
    kaheeta_groups: [group],
    kaheeta_group_members: members,
    kaheeta_split_expenses: [],
    kaheeta_split_shares: [],
  };
  for (const name of Object.keys(lists)) {
    await page.route(new RegExp(`/api/collections/${name}/records(\\?|$)`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: listBody(lists[name]!),
      }),
    );
  }

  // The split-expenses hook (create). Record the body; echo a created row back.
  await page.route("**/api/kaheeta/split-expenses", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Rec;
    posted.push(body);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "e_new", name: body.name, amount: body.amount }),
    });
  });

  return { posted };
}
