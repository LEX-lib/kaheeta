# Shared Splits — E2E Test Plan (two accounts)

Manual verification for the shared expense-splitting feature (groups, members,
expenses, equal split, computed balances). This covers what the automated
Playwright suite **cannot**: the live PocketBase **hook routes** and the
**party-scoped read rules** are the feature's security boundary, and the e2e
suite mocks PocketBase entirely (`e2e/helpers/*`), so it never exercises them.

Completing **Section B** with correct balances is the **Phase 3 exit gate**.

> **Why two real accounts:** every write goes through a superuser `pb_hooks`
> route that validates membership/ownership; visibility is enforced by per-row
> List/View rules — not app code. Only a second, *unrelated* account proves the
> isolation holds.

Legend: ☐ to do · ✅ pass · ❌ fail (note the ID + actual result)

---

## Prerequisites

| # | Requirement |
|---|-------------|
| P-1 | The split hook is deployed: `pocketbase/pb_hooks/kaheeta_splits.pb.js` is in the running server's `pb_hooks/`, including the **`POST /api/kaheeta/split-expenses`** route (Phase 3). Quick check: an unauthenticated `POST /api/kaheeta/split-expenses` returns **401**, not 404. |
| P-2 | Collections exist with party-scoped read rules + admin-only write rules: `kaheeta_groups`, `kaheeta_group_members`, `kaheeta_split_expenses`, `kaheeta_split_shares`. |
| P-3 | Index `kaheeta_split_expenses (group, deleted_at)` and `kaheeta_split_shares (expense, user)` present (perf, not correctness). |
| P-4 | **Three** test accounts that can log in to the app: **A**, **B**, **C** (A & B alone suffice for the 2-way cases; C is needed for the 3-way exit gate). Use two browsers / a normal + incognito window / two devices so the two sessions are truly independent. |
| P-5 | App running against that backend: `npm run dev` (points at `VITE_API_BASE_URL`) or a deployed build. |

Frontend entry: log in → **My Wallet** → **Groups** tab (`mdi:account-group`).

---

## A. Group lifecycle & membership

Run as **A** unless noted.

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-G-1 | Groups tab with no groups | Empty state: "No groups yet. Create one or join with a code." | ☐ |
| SPL-G-2 | **New group** → name "Trip", currency `USD` → Create | Group card appears; subtitle shows `USD · Owner` | ☐ |
| SPL-G-3 | Open the group → **Copy** the join code | Toast "Join code copied."; code is a 15-char string | ☐ |
| SPL-G-4 | As **B** (separate session): Groups → **Join group** → paste A's code → Join | Toast `Joined "Trip"`; the group appears in B's list (no "Owner" tag) | ☐ |
| SPL-G-5 | A opens the group → Members | Both A and B listed; A tagged `· owner` | ☐ |
| SPL-G-6 | B opens the group → Members | Same two members visible to B | ☐ |
| SPL-G-7 | A (owner) → **Add by email** → C's email → Add | Toast "Member added."; C appears in the member list | ☐ |
| SPL-G-8 | A → Add by email → a non-existent email | Toast "Could not add member — they may not have a Kaheeta account." | ☐ |
| SPL-G-9 | B (non-owner) opens detail | No "Add by email" field; shows **Leave group**, not Delete | ☐ |

---

## B. Equal-split expense + balances — **EXIT GATE**

Group "Trip" with members **A, B, C** (from Section A). Currency `USD`.

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-E-1 | As **A**: open Trip → **Add expense** | Form opens; "Paid by" defaults to **A**; all three members checked under "Split between" | ☐ |
| SPL-E-2 | Description "Hotel", Amount `300`, leave all 3 checked | Live preview shows **$100.00** next to each of A, B, C; footer "$300.00 split 3 ways" | ☐ |
| SPL-E-3 | Add expense | Toast "Expense added."; "Hotel" appears in the feed: `$300.00 · paid by A` (today's date) | ☐ |
| SPL-E-4 | A's **Balances** section | Two rows: **B owes you $100.00** and **C owes you $100.00** (green) | ☐ |
| SPL-E-5 | As **B**: open Trip | Balances: **You owe A $100.00** (amber); feed shows the same "Hotel" $300.00 | ☐ |
| SPL-E-6 | As **C**: open Trip | Balances: **You owe A $100.00** (amber) | ☐ |
| SPL-E-7 | As **B**: Add expense "Taxi", Amount `30`, paid by **B**, all 3 checked → Add | B now has two rows: **You owe A $90.00** ($100 Hotel − $10 A's Taxi share) and **C owes you $10.00** (C's Taxi share) | ☐ |
| SPL-E-8 | Re-check **A's** balances after SPL-E-7 | **B owes you $90.00**, **C owes you $100.00** | ☐ |

> Pass = SPL-E-4/5/6 show the correct, per-person, currency-labelled balances,
> and SPL-E-7/8 show cross-payer netting. That is the Phase 3 exit gate.

---

## C. Split-math & balance edge cases

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-M-1 | New expense, Amount `100`, split 3 ways | Preview: first-listed member **$33.34**, other two **$33.33** (remainder cent to the leftmost); footer "$100.00 split 3 ways". Parts sum to exactly $100.00 | ☐ |
| SPL-M-2 | Uncheck two participants (split 1 way), payer = the sole participant | That person's preview shows the full amount; after saving, **no balance** is created (you don't owe yourself) | ☐ |
| SPL-M-3 | Add an expense in a **different currency** group (e.g. make a 2nd group with `EUR`) | EUR balances render with the EUR symbol and are listed **separately** — never summed with USD | ☐ |
| SPL-M-4 | Settle a debt manually for now: payer = the debtor, single participant = the creditor, amount = the owed sum | The matching balance row drops to settled (disappears) | ☐ |
| SPL-M-5 | Amount `0` or empty → Add | Blocked with "Enter an amount greater than zero." (no row created) | ☐ |
| SPL-M-6 | Uncheck **all** participants → Add | Blocked with "Select at least one participant." | ☐ |

> SPL-M-4 is a manual stand-in; a dedicated **Settle up** flow lands in Phase 4.

---

## D. Isolation & access control (the security boundary)

Run as **D** — a fourth account that is **not** a member of any test group.

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-S-1 | D opens the Groups tab | D sees **none** of A's/B's groups — only D's own (empty) | ☐ |
| SPL-S-2 | D tries to read another group's rows directly: `GET /api/collections/kaheeta_groups/records` (with D's token) | Returns only D's groups (party-scoped list rule); "Trip" is absent | ☐ |
| SPL-S-3 | D: `GET /api/collections/kaheeta_split_expenses/records` | "Hotel"/"Taxi" are **not** returned | ☐ |
| SPL-S-4 | D: `POST /api/kaheeta/split-expenses` with `group` = Trip's id (D's token) | **403** "You are not a member of this group." (membership check) | ☐ |
| SPL-S-5 | B (member, non-owner): `PATCH`/`DELETE /api/kaheeta/groups/{Trip}` | **403** "Only the group owner can …" | ☐ |
| SPL-S-6 | Anyone: direct `POST /api/collections/kaheeta_split_expenses/records` (bypassing the hook) | **400/403** — collection create rule is admin-only; clients can't write rows directly | ☐ |

---

## E. Atomicity & data integrity

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-I-1 | Create a normal expense (Section B), then inspect rows: one `kaheeta_split_expenses` + N `kaheeta_split_shares` whose `amount`s **sum to** the expense `amount` (all integer cents) | Shares present and summing exactly; no orphan expense | ☐ |
| SPL-I-2 | `POST /api/kaheeta/split-expenses` with `shares` summing to ≠ `amount` (e.g. via curl) | **400** "Shares must sum to the expense amount."; **no** rows created | ☐ |
| SPL-I-3 | `POST` with `paid_by` = a user **not** in the group | **400** "The payer is not a member of this group." | ☐ |
| SPL-I-4 | Confirm money is stored as **integer minor units** (300.00 → `amount: 30000`) | `kaheeta_split_expenses.amount` is `30000`, not `300` | ☐ |

---

## F. Mobile / desktop parity

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-U-1 | Open a group detail on **desktop** (wide viewport) | Renders as a centered **Dialog** | ☐ |
| SPL-U-2 | Open the same on **mobile** (narrow / device) | Renders as a bottom **Drawer** with a drag handle; balances, feed, members, and **Add expense** all reachable | ☐ |
| SPL-U-3 | Add-expense form on mobile | Inputs are ≥16px (no iOS zoom); date picker + checkboxes usable; respects bottom safe-area | ☐ |
| SPL-U-4 | After leaving/deleting a group | Detail closes and the group list refreshes (the group is gone) | ☐ |

---

# Phase 4 — settle up, split types & delete

> **Prereq P-6:** the **updated** hook is deployed — `DELETE /api/kaheeta/split-expenses/{id}`
> returns **401** (not 404) unauthenticated, and the create hook now also validates
> that every **share user** is a group member.

## G. Split types (run as a member of "Trip"; A, B, C)

Each row: add an expense with the given method, then check the shares persisted and the balances.

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-T-1 | **Exact**: amount `100`, A `50`, B `30`, C `20` | Footer shows `$100.00 of $100.00 · $0.00 left`; saves; shares = 5000/3000/2000 | ☐ |
| SPL-T-2 | Exact where parts ≠ total (e.g. 50/30/10) | Blocked: "Amounts must add up to $100.00." (footer shows the gap in red) | ☐ |
| SPL-T-3 | **Percent**: amount `100`, A `50%`, B `25%`, C `25%` | Live preview 50/25/25; saves; shares = 5000/2500/2500 | ☐ |
| SPL-T-4 | Percent not summing to 100 | Footer "Total …% (must be 100%)" red; submit blocked | ☐ |
| SPL-T-5 | **Shares**: amount `100`, A `2`, B `1`, C `1` | Preview $50.00 / $25.00 / $25.00 (remainder by largest fraction); saves; sums to $100.00 | ☐ |
| SPL-T-6 | Any split type, inspect rows | `split_type` stored matches the method; shares sum exactly to `amount` (integer cents) | ☐ |

## H. Settle up

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-H-1 | With "B owes you $X": A opens the balance row → **Settle** | Dialog: "B is paying you", amount prefilled to $X | ☐ |
| SPL-H-2 | Record settlement | Toast "Settlement recorded."; the B-owes-you balance row **disappears** (nets to 0) | ☐ |
| SPL-H-3 | B's view after SPL-H-2 | B's "You owe A" balance is also cleared | ☐ |
| SPL-H-4 | The feed | A `Settlement · settlement` row appears with the amount | ☐ |
| SPL-H-5 | **Partial** settle: settle less than the full balance | Balance reduces by the settled amount (doesn't disappear) | ☐ |
| SPL-H-6 | Try to settle **more** than owed | The amount field **auto-clamps** to the owed amount (can't exceed it); the submit-time "more than owed" toast is an unreachable backstop | ☐ |

## I. Delete expense (soft delete)

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-D-1 | As the **adder**: trash icon on your expense → confirm | Toast "Expense deleted."; row leaves the feed; balances recompute | ☐ |
| SPL-D-2 | As the **group owner**: delete an expense added by someone else | Allowed (owner override) | ☐ |
| SPL-D-3 | As a **member who is neither adder nor owner** | No trash icon shown; and `DELETE /api/kaheeta/split-expenses/{id}` via curl → **403** | ☐ |
| SPL-D-4 | After delete, inspect the row | `deleted_at` is set (soft delete); the row still exists but is excluded from reads/balances | ☐ |
| SPL-D-5 | Delete a **settlement** | The cancelled balance reappears (settlement removed from recompute) | ☐ |

---

## Exit-gate summary

**Phase 3** is done when Sections **A, B, D, E** pass (see those sections).

**Phase 4** is done when:

- [ ] **Section G passes** — exact / percentage / shares each persist shares that
      sum exactly to the amount, with mismatches blocked before submit.
- [ ] **Section H passes** — a full settlement cancels a balance from both sides;
      a partial settlement reduces it; over-settling is blocked.
- [ ] **Section I passes** — the adder or owner can soft-delete; others get 403;
      `deleted_at` is stamped and the row drops out of balances.

File any ❌ with its ID and the actual vs expected result.
