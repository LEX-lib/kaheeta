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
