import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";
import { mockSplitsApi } from "./helpers/splits";

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
    await expect(page.getByText("You owe Bob")).toBeVisible();

    // Open the settle dialog from that balance row.
    await page.getByRole("button", { name: "Settle" }).click();
    await expect(page.getByText(/You are paying/)).toBeVisible();

    // Record the (full, prefilled) settlement.
    await page.locator('button[form="settle-up-form"]').click();

    // Balance nets to zero → row gone, settled-up message shown.
    await expect(page.getByText("You owe Bob")).toBeHidden();
    await expect(page.getByText(/All settled up/)).toBeVisible();
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
    await page.getByRole("button", { name: "Edit expense" }).click();
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
    await expect(page.getByText("Bob owes you")).toBeVisible();

    // Owner flips Simplify → current user nets to zero, balances collapse.
    await page.getByRole("switch").click();
    await expect(page.getByText(/All settled up/)).toBeVisible();
    await expect(page.getByText("Bob owes you")).toBeHidden();
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

    // Close the detail, then reopen the same group.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("switch")).toHaveCount(0);
    await page.getByText("Trip", { exact: true }).first().click();

    // Toggle reflects the persisted state, not the stale default.
    await expect(page.getByRole("switch")).toBeChecked();
  });

  test("owner deleting a group closes detail and clears the list (SPL-U-4)", async ({ page }) => {
    await mockSplitsApi(page); // e2e_user owns "Trip"; empty ledger

    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();

    // Owner sees Delete group; click it and confirm.
    await page.getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // Detail closes, list refreshes to the empty state, the card is gone.
    await expect(page.getByText(/No groups yet/)).toBeVisible();
    await expect(page.getByText("Trip", { exact: true })).toHaveCount(0);
  });
});
