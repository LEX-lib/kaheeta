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
| P-6 | `kaheeta_split_expenses` has the optional metadata fields: **`payment_mode`** (Select, optional) and **`receipt`** (File, max 1, 10 MB, JPEG/PNG/WebP/PDF, **protected**). `notes` already exists. |
| P-7 | The hook is redeployed with `GET /api/kaheeta/groups/{id}/suggested-members` and member-by-user-id support. Quick check: an unauthenticated request returns **401**, not 404. |

Frontend entry: log in → **My Wallet** → **Groups** tab (`mdi:account-group`).
The tab is a two-pane surface: group rail on the left, the selected group
(header, net position, actions, month-grouped feed with an **All expenses** toggle, Members modal)
on the right. Mobile drills down into the detail with a **Back to groups** button.

---

## A. Group lifecycle & membership

Run as **A** unless noted.

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-G-1 | Groups tab with no groups | Empty state: "No groups yet. Create one or join with a code." | ☐ |
| SPL-G-2 | **New group** → name "Trip", currency `USD` → Create | Group card appears; subtitle shows `USD · Owner` | ☐ |
| SPL-G-3 | Open the group → **Copy** the join code | Toast "Join code copied."; code is a 15-char string | ☐ |
| SPL-G-4 | As **B** (separate session): Groups → **Join group** → paste A's code → Join | Toast `Joined "Trip"`; the group appears in B's list (no "Owner" tag) | ☐ |
| SPL-G-5 | A opens the group → **Add members** | Members modal lists both A and B; A tagged `Owner` | ☐ |
| SPL-G-6 | B opens the group | The same members are visible in the header avatar stack (the Add members button is owner-only) | ☐ |
| SPL-G-7 | A (owner) → **Add by email** → C's email → Add | Toast "Member added."; C appears in the member list | ☐ |
| SPL-G-8 | A → Add by email → a non-existent email | Toast "Could not add member — they may not have a Kaheeta account." | ☐ |
| SPL-G-9 | B (non-owner) opens detail → **Members** | Member list and join code are visible; no Frequent chips or “Add by email”; the group menu shows **Leave group**, not Delete | ☐ |

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
| SPL-S-7 | D (non-member): `PATCH`/`DELETE /api/kaheeta/split-expenses/{Hotel}` | **403** "Only members of this group can edit/delete its expenses." | ☐ |
| SPL-S-8 | B (member, non-owner): `PATCH`/`DELETE` Hotel (added by A) | **200** — any group member may modify a group expense | ☐ |

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
| SPL-U-1 | Open the Groups tab on **desktop** (wide viewport) | Two panes: a group rail on the left and the selected group's detail on the right — **no** Dialog | ☐ |
| SPL-U-2 | Open the same on **mobile** (narrow / device) | Drill-down: the rail, then the inline detail with a **Back to groups** button — **no** Drawer | ☐ |
| SPL-U-3 | Add-expense form on mobile | Inputs are ≥16px (no iOS zoom); date picker + checkboxes usable; respects bottom safe-area | ☐ |
| SPL-U-4 | After leaving/deleting a group | The rail refreshes (group gone); mobile returns to the rail; desktop selects the next group | ☐ |

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
| SPL-H-1 | With "B owes you $X": A taps the toolbar **Settle up** | Dialog lists the balance; pick it → "B is paying you", amount prefilled to $X | ☐ |
| SPL-H-2 | Record settlement | Toast "Settlement recorded."; the B-owes-you balance row **disappears** (nets to 0) | ☐ |
| SPL-H-3 | B's view after SPL-H-2 | B's "You owe A" balance is also cleared | ☐ |
| SPL-H-4 | The feed | A `Settlement · settlement` row appears with the amount | ☐ |
| SPL-H-5 | **Partial** settle: settle less than the full balance | Balance reduces by the settled amount (doesn't disappear) | ☐ |
| SPL-H-6 | Try to settle **more** than owed | The amount field **auto-clamps** to the owed amount (can't exceed it); the submit-time "more than owed" toast is an unreachable backstop | ☐ |

## I. Delete expense (soft delete)

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-D-1 | Open a row’s ⋮ menu → **Delete** → confirm | Confirmation names who added it; toast "Expense deleted."; row leaves the feed; balances recompute | ☐ |
| SPL-D-2 | As a **member who is neither adder nor the owner**: delete an expense added by someone else | Allowed (membership-scoped) and balances recompute | ☐ |
| SPL-D-3 | As a **non-member** (D): `DELETE /api/kaheeta/split-expenses/{id}` via curl | **403** "Only members of this group can delete its expenses." | ☐ |
| SPL-D-4 | After delete, inspect the row | `deleted_at` is set (soft delete); the row still exists but is excluded from reads/balances | ☐ |
| SPL-D-5 | Delete a **settlement** | The cancelled balance reappears (settlement removed from recompute) | ☐ |

---

# Phase 5 — simplify debts, edit & multi-currency

> **Prereq P-7:** the **updated** hook is deployed — `PATCH /api/kaheeta/split-expenses/{id}`
> returns **401** (not 404) unauthenticated, and `PATCH /api/kaheeta/groups/{id}`
> accepts a `simplify_debts` boolean.

## J. Simplify debts (display-only)

Set up a chain so the current user is an intermediary or nets out — e.g. Bob owes
You 50, You owe Carol 50 (you net zero).

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-J-1 | Open the group as **owner** | A "Simplify" toggle shows in line with the net balance (`You lent / You owe`) on the right, off by default | ☐ |
| SPL-J-2 | Raw view (toggle off) | You see both raw rows: "Bob owes you …" and "You owe Carol …" | ☐ |
| SPL-J-3 | Flip **Simplify** on | Balances collapse — you net to zero → "You're all settled up."; the Bob→Carol transfer no longer routes through you | ☐ |
| SPL-J-4 | Reopen the group later | Toggle state persisted (the group's `simplify_debts` flag) | ☐ |
| SPL-J-5 | As a **non-owner** member | No toggle and no “Simplify” label; if simplify is on, a **simplified** Tag shows and balances are simplified | ☐ |
| SPL-J-6 | Totals unchanged | Each person's net owed/owing is identical to the raw view — only the number of transfers drops | ☐ |

## K. Edit expense

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-K-1 | Open a row’s ⋮ menu → **Edit expense** | The selector matches the stored split method (Equally / Exact / Percent / Shares) with reconstructed per-person inputs; amount/date/payer match | ☐ |
| SPL-K-2 | Change the amount/shares and **Save changes** | Feed + balances update; shares still sum to the amount | ☐ |
| SPL-K-3 | Rename and save | The new name shows in the feed | ☐ |
| SPL-K-4 | As any **member** (non-owner, not the adder) | Edit and Delete are available; `PATCH /api/kaheeta/split-expenses/{id}` → **200**. A **non-member** gets **403** | ☐ |
| SPL-K-5 | Edit with shares NOT summing to the amount (via curl) | **400** "Shares must sum to the expense amount."; row unchanged | ☐ |
| SPL-K-6 | Settlement row’s ⋮ menu → **Edit settlement** | Settlement mode: amount, currency, date, payer (debtor), one recipient, notes/payment mode/receipt editable; `split_type` stays `settlement` | ☐ |
| SPL-K-7 | Stored **Exact** split 60/30/10 → first open | Inputs show 60.00 / 30.00 / 10.00 (not an equal split); no close/reopen needed | ☐ |
| SPL-K-8 | Stored **Percent** 50/25/25 and **Shares** 2/1/1 | Editor opens in Percent with 50/25/25 and in Shares with 2/1/1 | ☐ |
| SPL-K-9 | Notes-only edit of a stored split | The saved shares are byte-for-byte unchanged (no cent drift) | ☐ |
| SPL-K-10 | Add an expense with only yourself in **Split between** | Row shows an **Only you** Tag; expand shows your single share | ☐ |
| SPL-K-11 | Rows for a shared expense | Summary shows who paid; a non-participant multi-person row shows **not included**; expanding lists every member's share (including yours) | ☐ |
| SPL-K-12 | An expense whose only participant is another member | Hidden from the feed by default; a **not included** line never appears on these rows | ☐ |
| SPL-K-13 | Flip **All expenses** on | Someone-else-only expenses appear with their **Only <name>** Tag; flip it off to hide them again | ☐ |

## L. Multi-currency

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-L-1 | Add expenses in two currencies in one group (e.g. a PHP and a USD expense) | Balances list each currency as a **separate** row; never summed | ☐ |
| SPL-L-2 | With Simplify on | Simplification runs **per currency** independently | ☐ |

---

# Phase 6 — per-expense currency & group export

## M. Per-expense currency picker

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-M6-1 | Add expense → the **Currency** field | Defaults to the group's currency; editable Select with common codes + free text | ☐ |
| SPL-M6-2 | Pick/type a different currency (e.g. EUR) and save | Expense stored with that currency; amount prefix + preview show it | ☐ |
| SPL-M6-3 | Add a second expense in another currency | Balances list **each currency on its own row**, never summed (closes L) | ☐ |
| SPL-M6-4 | With Simplify on across two currencies | Simplification runs **per currency** | ☐ |
| SPL-M6-5 | Edit an expense | Currency prefills from the stored value | ☐ |

## N. Group export (CSV on every viewport)

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-N-1 | Open a group | An **Export CSV** button (file icon) is in the header on desktop **and** mobile | ☐ |
| SPL-N-2 | Click **Export CSV** | Downloads `kaheeta-<group>-shares-<date>.csv`, one row per (expense × member share) with group, date, description, split type, currency, expense amount, payer, member, member share, is_payer, my_share, notes; settlements included | ☐ |
| SPL-N-3 | Open **Group actions** on desktop | **Download JSON** (backup: group meta, members, balances, expenses+shares) is available; it is absent on mobile | ☐ |

---

## O. Expense metadata & frequent members

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SPL-O-1 | Add an expense with a **payment mode** and **notes** | The row shows the payment-mode Tag; expanding it shows the notes; the group JSON export includes `payment_mode` + `notes` | ☐ |
| SPL-O-2 | Attach a **receipt** (photo + PDF) and save, then reopen the expense | The row’s ⋮ menu offers **View receipt**; another **group member** opens the preview successfully; a non-member gets no file access | ☐ |
| SPL-O-3 | Edit the expense: replace the receipt; then use **Remove current receipt** and save | New file replaces the old; removal clears the field and View receipt disappears from the row menu | ☐ |
| SPL-O-4 | As the owner, open a group you own after previously adding people to another group | A **Frequent** chip row lists those people (most shared groups first) and omits current members + yourself | ☐ |
| SPL-O-5 | Tap a Frequent chip | Member is added immediately (no email typed) and disappears from the suggestions | ☐ |
| SPL-O-6 | Non-owner requests `GET /api/kaheeta/groups/{id}/suggested-members` | **403** — only the owner can add/look up suggestions | ☐ |

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

**Phase 5** is done when:

- [ ] **Section J passes** — Simplify collapses transfers (intermediaries drop
      out), persists per group, and preserves each person's net total.
- [ ] **Section K passes** — adder/owner can edit (atomic share replace, sum
      re-validated); others get 403; settlements aren't editable.
- [ ] **Section L passes** — currencies stay separate; simplify runs per currency.

**Phase 6** is done when:

- [ ] **Section M passes** — per-expense currency picker (default group currency,
      editable); mixed currencies render as separate balance rows.
- [ ] **Section N passes** — desktop export downloads the group JSON; hidden on mobile.

File any ❌ with its ID and the actual vs expected result.
