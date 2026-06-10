# PLAN — Color Branding Alignment

**Goal:** Make every surface consume one canonical palette (`devdoc/branding-palette.md`), with a single navy-based dark theme and no hardcoded brand hexes.

**Decisions (locked):**
- Dark theme = **navy-based** (derived from Deep Navy `#002244`). This becomes canonical and is documented in the palette.
- Scope = **Core** — tokens + dark-mode unification + de-hardcode brand hexes + doc update. Charts and barcode literals left as-is.

**Audit verdict:** Light mode already fully aligned (base.css `@theme` + PrimeVue preset). All divergence is in dark mode (three parallel improvised palettes) and scattered hardcoded brand hexes.

**Canonical dark tokens (navy-based):**

| Token | Dark value |
|---|---|
| `--color-surface-page` | `#001327` |
| `--color-surface-card` | `#0A2C52` |
| `--color-surface-card-2` (new) | `#0E3360` |
| `--color-surface-divider` | `rgba(255,255,255,0.08)` |
| `--color-typo-heading` | `#FFFFFF` |
| `--color-typo-body` | `#D7E2F0` |
| `--color-typo-muted` | `#8095AF` |
| `--color-brand-accent-hover` (new, both modes) | `#F5B450` |
| Dark Ink `#1A1A2E` | stays code/terminal-only (now genuinely unused as a surface) |

---

## Phase 1 — Canonical tokens (source of truth)

- [ ] **1.1** `devdoc/branding-palette.md`: add a **Dark Mode** section (table + role notes) with the navy-based tokens above; document `--color-brand-accent-hover #F5B450` (amber hover tint) and the dark inversion strategy (surfaces = navy, primary CTAs/accents = amber). Add a dark `:root`/`.my-app-dark` CSS custom-properties block mirroring the light one.
- [ ] **1.2** `src/assets/base.css`: update the `.my-app-dark` overrides to the canonical navy values; add `--color-surface-card-2`; add `--color-brand-accent-hover` in `@theme` (light) and dark. Keep light `@theme` untouched (already aligned).

## Phase 2 — Unify dark surfaces (kill the parallel palettes)

- [ ] **2.1** `src/components/landing/LandingPage.vue`: rewire its local `--pg-*` dark-override block to **consume** the shared `--color-*` tokens instead of redefining navy literals (`#001327`, `#0a2c52`, `#0e3360`, `#0d3360`). Light defaults stay. One source of truth for dark navy.
- [ ] **2.2** `src/components/Login.vue`: replace dark literal `#001327` with `var(--color-surface-page)`; express the `.login-bg` brand-tinted gradients via the accent/primary tokens (`color-mix`) rather than raw `rgba(232,152,32,…)` / `rgba(0,34,68,…)`.
- [ ] **2.3** `src/assets/wallecx-overrides.css`: replace the off-palette dark `#1a1f2e` (card bg + tab toolbar) with `var(--color-surface-card)`.

## Phase 3 — Tokenize hardcoded brand hexes

- [ ] **3.1** `src/components/wallecx/KaheetaNavBar.vue`: `.nav-login-btn` → `var(--color-brand-accent)` / `var(--color-brand-primary)` / `var(--color-brand-accent-hover)`. Fix the profile **avatar** dark-mode contrast (currently `--p-primary-500` navy on a now-navy card → low contrast; switch to amber/accent in dark).
- [ ] **3.2** `src/components/wallecx/PwaInstallBanner.vue`: replace `#002244` / `#e89820` brand literals with `var(--color-brand-primary)` / `var(--color-brand-accent)`. Leave functional `#ffffff` as-is.
- [ ] **3.3** `src/components/wallecx/MembershipCard.vue` + `MembershipDetail.vue`: replace brand-hex JS/template fallbacks (`#002244`, heading `#000000`→`var(--color-typo-heading)`) with tokens. Keep `card_color` user data and barcode `#000/#fff` untouched (functional).

## Phase 4 — Verify

- [ ] **4.1** `npm run type-check` green.
- [ ] **4.2** `npm run lint` clean.
- [ ] **4.3** Visual check **light + dark** on `/`, `/login`, `/wallet`: navbar, cards, login backdrop, profile avatar/menu, landing hero/features, CTA buttons. Confirm dark navbar is navy (not ink), avatar legible, no off-brand colors.
- [ ] **4.4** 60-10-30 sanity: navy dominant, amber on CTAs/accents only, off-white/navy surfaces for backgrounds.

---

### Notable side effect
Switching dark surfaces from neutral-ink (`#1a1a2e`) to navy (`#0A2C52`/`#001327`) **visibly changes the whole wallet's dark theme** from neutral to navy. This is the intended outcome of "navy-based, applied everywhere."
