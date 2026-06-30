import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";
import { mockSplitsApi } from "./helpers/splits";

/**
 * Client-side validation of the Add-expense form (ManageSplitExpense.vue). These
 * guards run in the browser BEFORE any network call, so they can't be exercised
 * by hitting the hook — only by driving the real form. The split-expenses
 * endpoint is mocked; each invalid case must show an error toast and fire NO
 * POST, while a valid equal split must POST shares that sum to the amount.
 */
test.describe("Split expense — form validation", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Open Trip → Add expense, and return the dialog's form + submit locators.
  async function openAddExpense(page: import("@playwright/test").Page) {
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    // GroupDetail's "Add expense" button (opens the form dialog).
    await page.getByRole("button", { name: "Add expense" }).click();

    const form = page.locator("#manage-split-expense-form");
    await expect(form).toBeVisible();
    await page.getByPlaceholder("e.g. Dinner").fill("Dinner");
    const submit = page.locator('button[form="manage-split-expense-form"]');
    return { form, submit };
  }

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
  });

  test("exact split that doesn't sum to the total is blocked (no POST)", async ({ page }) => {
    const { posted } = await mockSplitsApi(page);
    const { form, submit } = await openAddExpense(page);

    // Amount = 100.00 (single spinbutton while still on Equal).
    await form.getByRole("spinbutton").fill("100");
    // Switch to Exact → per-participant inputs appear.
    await page.getByText("Exact", { exact: true }).click();

    // spinbuttons now: [0]=amount, [1..3]=You/Bob/Carol. Make them sum to 90.
    const nums = form.getByRole("spinbutton");
    await nums.nth(1).fill("50");
    await nums.nth(2).fill("30");
    await nums.nth(3).fill("10");

    await submit.click();

    await expect(page.getByText(/must add up to/i)).toBeVisible();
    expect(posted).toHaveLength(0);
  });

  test("percentage split not totalling 100% is blocked (no POST)", async ({ page }) => {
    const { posted } = await mockSplitsApi(page);
    const { form, submit } = await openAddExpense(page);

    await form.getByRole("spinbutton").fill("100");
    await page.getByText("Percent", { exact: true }).click();

    // Seeded to 34/33/33 (=100). Bump the first to 50 → total 116%.
    await form.getByRole("spinbutton").nth(1).fill("50");

    await submit.click();

    await expect(page.getByText(/must add up to 100%/i)).toBeVisible();
    expect(posted).toHaveLength(0);
  });

  test("the per-expense currency picker is sent in the POST", async ({ page }) => {
    const { posted } = await mockSplitsApi(page);
    const { form, submit } = await openAddExpense(page);

    await form.getByRole("spinbutton").fill("50");
    // Editable currency Select: type a code other than the group default (PHP).
    await page.getByPlaceholder("e.g. USD").fill("EUR");

    await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url().includes("/api/kaheeta/split-expenses"),
      ),
      submit.click(),
    ]);

    expect(posted).toHaveLength(1);
    expect(posted[0]!.currency).toBe("EUR");
  });

  test("a valid equal split POSTs shares that sum to the amount", async ({ page }) => {
    const { posted } = await mockSplitsApi(page);
    const { form, submit } = await openAddExpense(page);

    // 90.00 split equally 3 ways → 30.00 each (9000 cents total).
    await form.getByRole("spinbutton").fill("90");

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url().includes("/api/kaheeta/split-expenses"),
      ),
      submit.click(),
    ]);

    const body = JSON.parse(req.postData() ?? "{}");
    expect(body.amount).toBe(9000);
    expect(body.split_type).toBe("equal");
    const shareSum = (body.shares as Array<{ amount: number }>).reduce((a, s) => a + s.amount, 0);
    expect(shareSum).toBe(9000);
    expect(body.shares).toHaveLength(3);
    expect(posted).toHaveLength(1);
  });
});
