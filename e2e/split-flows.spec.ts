import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";
import { mockSplitsApi } from "./helpers/splits";

/**
 * Expand a row (inline breakdown) and trigger its stable Edit/Delete button.
 * The popup action menu is exercised by the viewport/parity suite instead —
 * clicking a teleported overlay is prone to animation detaches.
 */
async function rowAction(
  page: import("@playwright/test").Page,
  scope: import("@playwright/test").Locator,
  action: "edit" | "delete",
): Promise<void> {
  await scope.locator(".sx-main").click();
  const label = action === "edit" ? "Edit" : "Delete";
  await scope.getByRole("button", { name: label, exact: true }).click();
}

/**
 * End-to-end flows that span a write + a re-read against the stateful split
 * mock: a settlement cancelling a balance (Section H) and an owner deleting a
 * group (Section F / SPL-U-4). These exercise the recompute / list-refresh that
 * a single request probe can't.
 */
test.describe("Split flows", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
  });

  test("settling a balance cancels it (Section H)", async ({ page }) => {
    // Bob paid 100.00 split equally with You → You owe Bob 50.00.
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "d1",
          group: "g1",
          paid_by: "u_bob",
          added_by: "u_bob",
          name: "Dinner",
          amount: 10000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-01",
        },
      ],
      shares: [
        { id: "sh_a", expense: "d1", user: "e2e_user", amount: 5000 },
        { id: "sh_b", expense: "d1", user: "u_bob", amount: 5000 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    // Outstanding balance shown.
    const net = page.locator(".gd-net");
    await expect(net.getByText("You owe Bob")).toBeVisible();

    // Open the settle dialog from that balance row.
    await page.getByRole("button", { name: "Settle", exact: true }).click();
    await expect(page.getByText(/You are paying/)).toBeVisible();

    // Record the (full, prefilled) settlement.
    await page.locator('button[form="settle-up-form"]').click();

    // Balance nets to zero → row gone, settled-up message shown.
    await expect(net.getByText("You owe Bob")).toBeHidden();
    await expect(net.getByText(/all settled up/i)).toBeVisible();
  });

  test("editing an expense updates the feed (Section K)", async ({ page }) => {
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "d1",
          group: "g1",
          paid_by: "u_bob",
          added_by: "e2e_user",
          name: "Dinner",
          amount: 10000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-01",
        },
      ],
      shares: [
        { id: "sh_a", expense: "d1", user: "e2e_user", amount: 5000 },
        { id: "sh_b", expense: "d1", user: "u_bob", amount: 5000 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    await expect(page.getByText("Dinner", { exact: true })).toBeVisible();

    // Open edit, rename, save (shares prefill in Exact mode and already sum).
    await rowAction(page, page, "edit");
    await expect(page.getByText("Edit expense")).toBeVisible();
    await page.getByPlaceholder("e.g. Dinner").fill("Dinner v2");
    await page.locator('button[form="manage-split-expense-form"]').click();

    await expect(page.getByText("Dinner v2", { exact: true })).toBeVisible();
    await expect(page.getByText("Dinner", { exact: true })).toHaveCount(0);
  });

  test("toggling Simplify collapses the balances (Section J)", async ({ page }) => {
    // Bob owes You 50 (you paid for Bob); You owe Carol 50 (Carol paid for you).
    // Raw: You see 2 rows. Simplified: you net zero → Bob owes Carol, you drop out.
    await mockSplitsApi(page, {
      expenses: [
        { id: "e1", group: "g1", paid_by: "e2e_user", added_by: "e2e_user", name: "Lunch", amount: 5000, currency: "PHP", split_type: "equal", expense_date: "2026-06-01" },
        { id: "e2", group: "g1", paid_by: "u_carol", added_by: "u_carol", name: "Cab", amount: 5000, currency: "PHP", split_type: "equal", expense_date: "2026-06-02" },
      ],
      shares: [
        { id: "s1", expense: "e1", user: "u_bob", amount: 5000 },
        { id: "s2", expense: "e2", user: "e2e_user", amount: 5000 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    // Raw view: a balance involving the current user is shown.
    const net = page.locator(".gd-net");
    await expect(net.getByText("Bob owes you")).toBeVisible();

    // Owner flips Simplify → current user nets to zero, balances collapse.
    await page.getByRole("switch").click();
    await expect(net.getByText(/all settled up/i)).toBeVisible();
    await expect(net.getByText("Bob owes you")).toBeHidden();
  });

  test("Simplify toggle persists across close + reopen (SPL-J-4)", async ({ page }) => {
    await mockSplitsApi(page); // e2e_user owns "Trip"

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    const sw = page.getByRole("switch");
    await expect(sw).not.toBeChecked();

    // Wait for the persist PATCH to settle — the simplify-changed emit (which
    // updates the cached group) only fires after it resolves.
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "PATCH" && r.url().includes("/api/kaheeta/groups/"),
      ),
      sw.click(),
    ]);
    await expect(sw).toBeChecked();

    // Reload the page and reopen the same group.
    await page.reload();
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    // Toggle reflects the persisted state, not the stale default.
    await expect(page.getByRole("switch")).toBeChecked();
  });

  test("member names render via the members hook (not the 'Member' placeholder)", async ({ page }) => {
    await mockSplitsApi(page);

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    await expect(page.getByText("Members", { exact: true })).toBeVisible();
    // Members live in the collapsible panel.
    await page.getByRole("button", { name: "Add members" }).click();

    await expect(page.getByText("Bob", { exact: true })).toBeVisible();
    await expect(page.getByText("Carol", { exact: true })).toBeVisible();
    // The fallback label must NOT appear when names resolve.
    await expect(page.getByText("Member", { exact: true })).toHaveCount(0);
  });

  test("notes and payment mode round-trip into the feed", async ({ page }) => {
    const { posted } = await mockSplitsApi(page);

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    await page.getByRole("button", { name: "Add expense" }).click();

    const form = page.locator("#manage-split-expense-form");
    await expect(form).toBeVisible();
    await page.getByPlaceholder("e.g. Dinner").fill("Team lunch");
    await form.getByRole("spinbutton").fill("60");

    await page.getByText("Select a payment mode").click();
    await page.getByRole("option", { name: "Cash" }).click();
    await page.locator("textarea").fill("Split with Bob and Carol");

    await page.locator('button[form="manage-split-expense-form"]').click();
    await expect(page.locator("#manage-split-expense-form")).toBeHidden();

    // The optimistic re-read reflects the stored metadata.
    await expect(page.getByText("Team lunch", { exact: true })).toBeVisible();
    await expect(page.getByText("Cash", { exact: true })).toBeVisible();
    // Notes live in the row's inline breakdown.
    await page.getByText("Team lunch", { exact: true }).click();
    await expect(page.getByText("Split with Bob and Carol")).toBeVisible();
    expect(posted).toHaveLength(1);
    expect(posted[0]!.payment_mode).toBe("cash");
    expect(posted[0]!.notes).toBe("Split with Bob and Carol");
  });

  test("frequent-member chip adds a member without an email (SPL-U-5)", async ({ page }) => {
    await mockSplitsApi(page);

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    await page.getByRole("button", { name: "Add members" }).click();
    await expect(page.getByText("Frequent", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dave" }).click();

    // Dave joins the member list; the suggestion chip disappears.
    await expect(page.getByText("Dave", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dave" })).toHaveCount(0);
  });

  test("owner deleting a group closes detail and clears the list (SPL-U-4)", async ({ page }) => {
    await mockSplitsApi(page); // e2e_user owns "Trip"; empty ledger

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    // Owner sees Delete group in the header menu; click it and confirm.
    await page.getByRole("button", { name: "Group actions" }).click();
    await page.getByRole("menuitem", { name: "Delete group" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // Detail closes, list refreshes to the empty state, the card is gone.
    await expect(page.getByText(/No groups yet/)).toBeVisible();
    await expect(page.getByText("Trip", { exact: true })).toHaveCount(0);
  });

  test("edit prefills an unequal exact split with its stored amounts (SPL-K-7)", async ({ page }) => {
    // Regression: a split-type watcher re-seeded exact inputs with an equal
    // split on the first open, so 60/30/10 showed as 33.34/33.33/33.33.
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "d1",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Uneven",
          amount: 10000,
          currency: "PHP",
          split_type: "exact",
          expense_date: "2026-06-01",
        },
      ],
      shares: [
        { id: "sh_a", expense: "d1", user: "e2e_user", amount: 6000 },
        { id: "sh_b", expense: "d1", user: "u_bob", amount: 3000 },
        { id: "sh_c", expense: "d1", user: "u_carol", amount: 1000 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    await rowAction(page, page, "edit");

    const form = page.locator("#manage-split-expense-form");
    await expect(form).toBeVisible();
    await expect(form.getByRole("button", { name: "Exact" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const nums = form.getByRole("spinbutton");
    await expect(nums.nth(1)).toHaveValue("60.00");
    await expect(nums.nth(2)).toHaveValue("30.00");
    await expect(nums.nth(3)).toHaveValue("10.00");
  });

  test("edit reflects stored equal / percent / shares methods (SPL-K-8)", async ({ page }) => {
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "e_eq",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Evenly",
          amount: 10000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-01",
        },
        {
          id: "e_pct",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Perc",
          amount: 10000,
          currency: "PHP",
          split_type: "percentage",
          expense_date: "2026-06-02",
        },
        {
          id: "e_shr",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Weighted",
          amount: 10000,
          currency: "PHP",
          split_type: "share",
          expense_date: "2026-06-03",
        },
      ],
      shares: [
        { id: "s1", expense: "e_eq", user: "e2e_user", amount: 3334 },
        { id: "s2", expense: "e_eq", user: "u_bob", amount: 3333 },
        { id: "s3", expense: "e_eq", user: "u_carol", amount: 3333 },
        { id: "s4", expense: "e_pct", user: "e2e_user", amount: 5000 },
        { id: "s5", expense: "e_pct", user: "u_bob", amount: 2500 },
        { id: "s6", expense: "e_pct", user: "u_carol", amount: 2500 },
        { id: "s7", expense: "e_shr", user: "e2e_user", amount: 5000 },
        { id: "s8", expense: "e_shr", user: "u_bob", amount: 2500 },
        { id: "s9", expense: "e_shr", user: "u_carol", amount: 2500 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    const form = page.locator("#manage-split-expense-form");
    const row = (name: string) => page.locator(".sx-wrap", { hasText: name });

    // Equal: the selector follows the stored method (no per-person inputs).
    await rowAction(page, row("Evenly"), "edit");
    await expect(form.getByRole("button", { name: "Equally" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Cancel" }).click();

    // Percent: 50/25/25 reconstructed from the stored cents.
    await rowAction(page, row("Perc"), "edit");
    await expect(form.getByRole("button", { name: "Percent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(form.getByRole("spinbutton").nth(1)).toHaveValue("50%");
    await expect(form.getByRole("spinbutton").nth(2)).toHaveValue("25%");
    await expect(form.getByRole("spinbutton").nth(3)).toHaveValue("25%");
    await page.getByRole("button", { name: "Cancel" }).click();

    // Shares: 2/1/1 recovered from the stored cents.
    await rowAction(page, row("Weighted"), "edit");
    await expect(form.getByRole("button", { name: "Shares" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(form.getByRole("spinbutton").nth(1)).toHaveValue("2");
    await expect(form.getByRole("spinbutton").nth(2)).toHaveValue("1");
    await expect(form.getByRole("spinbutton").nth(3)).toHaveValue("1");
  });

  test("notes-only edit preserves the stored shares exactly (SPL-K-9)", async ({ page }) => {
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "d1",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Weighted",
          amount: 10000,
          currency: "PHP",
          split_type: "share",
          expense_date: "2026-06-01",
        },
      ],
      shares: [
        { id: "sh_a", expense: "d1", user: "e2e_user", amount: 5000 },
        { id: "sh_b", expense: "d1", user: "u_bob", amount: 2500 },
        { id: "sh_c", expense: "d1", user: "u_carol", amount: 2500 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    await rowAction(page, page, "edit");
    await page.locator("textarea").fill("Receipt attached later");

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "PATCH" && r.url().includes("/api/kaheeta/split-expenses/"),
      ),
      page.locator('button[form="manage-split-expense-form"]').click(),
    ]);
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body.split_type).toBe("share");
    expect(body.shares).toEqual([
      { user: "e2e_user", amount: 5000 },
      { user: "u_bob", amount: 2500 },
      { user: "u_carol", amount: 2500 },
    ]);
  });

  test("a non-owner member sees edit/delete on someone else's expense (SPL-K-10)", async ({ page }) => {
    await mockSplitsApi(page, {
      owner: "u_bob",
      expenses: [
        {
          id: "d1",
          group: "g1",
          paid_by: "u_bob",
          added_by: "u_bob",
          name: "Bob's dinner",
          amount: 10000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-01",
        },
      ],
      shares: [
        { id: "sh_a", expense: "d1", user: "e2e_user", amount: 5000 },
        { id: "sh_b", expense: "d1", user: "u_bob", amount: 5000 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    // e2e_user is a member, not the adder or the owner: both actions show.
    await page.locator(".sx-main").click();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();

    // And an edit actually persists through the member-scoped hook.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByPlaceholder("e.g. Dinner").fill("Bob's lunch");
    await page.locator('button[form="manage-split-expense-form"]').click();
    await expect(page.getByText("Bob's lunch", { exact: true })).toBeVisible();
  });

  test("a settlement is editable through settlement mode (SPL-K-11)", async ({ page }) => {
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "st1",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Settlement",
          amount: 5000,
          currency: "PHP",
          split_type: "settlement",
          expense_date: "2026-06-01",
        },
      ],
      shares: [{ id: "sh_a", expense: "st1", user: "u_bob", amount: 5000 }],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    await rowAction(page, page, "edit");
    await expect(page.getByText("Edit settlement")).toBeVisible();

    const form = page.locator("#manage-split-expense-form");
    await form.getByRole("spinbutton").first().fill("70");

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "PATCH" && r.url().includes("/api/kaheeta/split-expenses/"),
      ),
      page.locator('button[form="manage-split-expense-form"]').click(),
    ]);
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body.split_type).toBe("settlement");
    expect(body.amount).toBe(7000);
    expect(body.shares).toEqual([{ user: "u_bob", amount: 7000 }]);
  });

  test("rows show my share, 'not included', and the Only you tag (SPL-K-12)", async ({ page }) => {
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "e_solo",
          group: "g1",
          paid_by: "e2e_user",
          added_by: "e2e_user",
          name: "Solo coffee",
          amount: 4000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-01",
        },
        {
          id: "e_shared",
          group: "g1",
          paid_by: "u_bob",
          added_by: "u_bob",
          name: "Shared lunch",
          amount: 10000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-02",
        },
        {
          id: "e_others",
          group: "g1",
          paid_by: "u_bob",
          added_by: "u_bob",
          name: "Others only",
          amount: 6000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-03",
        },
      ],
      shares: [
        { id: "s1", expense: "e_solo", user: "e2e_user", amount: 4000 },
        { id: "s2", expense: "e_shared", user: "e2e_user", amount: 5000 },
        { id: "s3", expense: "e_shared", user: "u_bob", amount: 5000 },
        { id: "s4", expense: "e_others", user: "u_bob", amount: 3000 },
        { id: "s5", expense: "e_others", user: "u_carol", amount: 3000 },
      ],
    });

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    const row = (name: string) => page.locator(".sx-wrap", { hasText: name });
    await expect(row("Solo coffee").getByText("Only you", { exact: true })).toBeVisible();
    await expect(row("Shared lunch").getByText(/your share/)).toBeVisible();
    await expect(row("Others only").getByText(/not included/)).toBeVisible();

    // Expanding shows the per-member breakdown.
    await row("Shared lunch").locator(".sx-main").click();
    await expect(
      row("Shared lunch").locator(".sx-breakdown-name").filter({ hasText: "Bob" }),
    ).toBeVisible();
    await expect(
      row("Shared lunch").locator(".sx-breakdown-name").filter({ hasText: "You" }),
    ).toBeVisible();
  });
});
