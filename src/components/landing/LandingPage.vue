<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const LOGIN = { name: "login", query: { redirect: "/wallet" } } as const;
const WALLET = { name: "wallet" } as const;

// The hero / CTA-strip primary buttons adapt to auth state: signed-in visitors
// jump straight to their wallet, everyone else is sent to log in.
const ctaTo = computed(() => (auth.isLoggedIn ? WALLET : LOGIN));
const ctaLabel = computed(() => (auth.isLoggedIn ? "Go to wallet" : "Log in"));

const features = [
  {
    icon: "mdi:card-account-details-outline",
    title: "IDs",
    desc: "Keep your identification cards within reach, always in your pocket.",
  },
  {
    icon: "mdi:card-multiple-outline",
    title: "Membership Cards",
    desc: "Loyalty cards, gym memberships, library cards — all in one place.",
  },
  {
    icon: "mdi:needle",
    title: "Vaccination Records",
    desc: "Store vaccination history with dates, brand, and dose details.",
  },
  {
    icon: "mdi:cart-outline",
    title: "Shopping Lists",
    desc: "Build and check off lists while you shop, then archive them.",
  },
  {
    icon: "mdi:receipt-text-outline",
    title: "Receipts",
    desc: "Photograph and file receipts, linked to your expense records.",
  },
  {
    icon: "mdi:credit-card-outline",
    title: "Cards",
    desc: "Track debit and credit cards with balance and spend awareness.",
  },
] as const;

// Floating scroll-to-top: shown only once the user has scrolled past the
// features heading ("Everything you carry,"). A scroll listener recomputes the
// heading's position — robust to fast/flick scrolls (an IntersectionObserver
// with threshold 0 can miss a jump that skips straight past the element).
const featuresTitle = ref<HTMLElement | null>(null);
const showScrollTop = ref(false);
let ticking = false;

function updateScrollTop(): void {
  ticking = false;
  const el = featuresTitle.value;
  if (el) {
    // Visible once the heading has scrolled above the viewport top.
    showScrollTop.value = el.getBoundingClientRect().top < 0;
  }
}

function onScroll(): void {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateScrollTop);
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  updateScrollTop();
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <div class="kaheeta-page" id="top">
    <!-- HERO -->
    <header class="hero">
      <div class="container hero-inner">
        <div class="accent-rule"></div>
        <p class="eyebrow">Digital Wallet · Filipino-inspired · Beta</p>
        <h1 class="hero-title">
          Your wallet,<br /><span class="em">digitized.</span>
        </h1>
        <p class="hero-desc">
          Kaheeta is the digital version of the everyday Filipino wallet —
          carrying your IDs, membership cards, vaccination records, receipts,
          and more, always at your fingertips.
        </p>
        <div class="cta-row">
          <Button as="router-link" :to="ctaTo" unstyled class="btn btn-primary"
            >{{ ctaLabel }} <span class="arrow">→</span></Button
          >
          <span class="beta-note">Sign-up is invite-only (beta)</span>
        </div>
      </div>
    </header>

    <!-- FEATURES -->
    <section class="features section-pad" id="features">
      <div class="container">
        <p class="section-label">What's in your wallet</p>
        <h2 class="section-title" ref="featuresTitle">
          Everything you carry,<br />always with you.
        </h2>
        <div class="feature-grid">
          <div v-for="f in features" :key="f.title" class="feature-card">
            <div class="feature-icon">
              <iconify-icon
                :icon="f.icon"
                width="24"
                height="24"
                aria-hidden="true"
              ></iconify-icon>
            </div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA STRIP -->
    <section class="cta-strip">
      <div class="container cta-box">
        <p class="section-label" style="text-align: center">
          Already have access?
        </p>
        <h2>Pick up where you left off.</h2>
        <p>
          Log in to open your wallet — cards, records, and expenses, right where
          you left them.
        </p>
        <div class="cta-row" style="justify-content: center">
          <Button as="router-link" :to="ctaTo" unstyled class="btn btn-primary"
            >{{ ctaLabel }} <span class="arrow">→</span></Button
          >
          <a href="mailto:hello@delveen.dev" class="btn btn-ghost"
            >Get in touch</a
          >
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer>
      <div class="container footer-inner">
        <div class="footer-brand">
          <img src="/kaheeta-logo.svg" alt="" width="22" height="22" />
          <span>Kaheeta</span>
        </div>
        <div class="footer-meta">
          A
          <a href="https://delveen.dev" class="delveen-link">delveen</a> product
          · © 2026
        </div>
      </div>
    </footer>

    <!-- Floating scroll-to-top — appears once past the features heading -->
    <button
      type="button"
      class="scroll-top"
      :class="{ 'is-visible': showScrollTop }"
      aria-label="Scroll to top"
      @click="scrollToTop"
    >
      <iconify-icon
        icon="mdi:arrow-up"
        width="22"
        height="22"
        aria-hidden="true"
      ></iconify-icon>
    </button>
  </div>
</template>

<style scoped>
/* ─── Light-mode defaults ─────────────────────────────────────────────────── */
.kaheeta-page {
  /* Invariant brand tokens */
  --amber: #e89820;
  --amber-light: #f5b450;
  --amber-soft: #fdf3dc;
  --navy: #002244; /* always used for contrast on amber backgrounds */

  /* Themeable tokens — sourced from the shared palette (base.css) so light
     and dark both flow from one place. */
  --pg-bg: var(--color-surface-page);
  --pg-surface: var(--color-surface-card);
  --pg-surface-2: var(--color-surface-card-2);
  --pg-heading: var(--color-typo-heading);
  --pg-text: var(--color-typo-body);
  --pg-muted: var(--color-typo-muted);
  --pg-line: var(--color-surface-divider);

  /* Component-specific tokens — light defaults */
  --nav-bg: rgba(248, 250, 252, 0.88);
  --hero-base: #ffffff;
  --hero-overlay: rgba(0, 34, 68, 0.03);
  --dot-color: rgba(0, 0, 0, 0.025);
  --card-end: rgba(240, 244, 248, 0.5);
  --ghost-border: rgba(0, 34, 68, 0.2);
  --ghost-hover-bg: rgba(0, 34, 68, 0.04);
  --ghost-hover-border: rgba(0, 34, 68, 0.35);
  --icon-hover-bg: rgba(0, 34, 68, 0.05);
  --nav-cta-color: var(--amber);

  --maxw: 1120px;
  --font:
    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;

  font-family: var(--font);
  color: var(--pg-text);
  background: var(--pg-bg);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

/* ─── Dark-mode overrides ─────────────────────────────────────────────────────
   Core surface/typography tokens flip automatically via the shared --color-*
   palette; only the landing-specific aesthetic tokens are overridden here. */
:global(.my-app-dark .kaheeta-page) {
  --nav-bg: rgba(0, 19, 39, 0.72);
  --hero-base: #002244;
  --hero-overlay: rgba(13, 51, 96, 0.9);
  --dot-color: rgba(255, 255, 255, 0.035);
  --card-end: rgba(10, 44, 82, 0.4);
  --ghost-border: rgba(255, 255, 255, 0.18);
  --ghost-hover-bg: rgba(255, 255, 255, 0.04);
  --ghost-hover-border: rgba(255, 255, 255, 0.45);
  --icon-hover-bg: rgba(255, 255, 255, 0.06);
  --nav-cta-color: var(--amber-soft);
}

/* ─── Base reset ──────────────────────────────────────────────────────────── */
.kaheeta-page *,
.kaheeta-page *::before,
.kaheeta-page *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:global(html) {
  scroll-behavior: smooth;
}

.kaheeta-page a {
  color: inherit;
  text-decoration: none;
}

.container {
  width: 100%;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 clamp(1.25rem, 4vw, 2.5rem);
}

/* Hero */
.hero {
  position: relative;
  background:
    radial-gradient(
      900px 500px at 12% -10%,
      rgba(232, 152, 32, 0.14),
      transparent 60%
    ),
    radial-gradient(
      800px 600px at 100% 110%,
      var(--hero-overlay),
      transparent 55%
    ),
    var(--hero-base);
  overflow: hidden;
  transition: background 0.3s ease;
}
.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--dot-color) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: linear-gradient(to bottom, black, transparent 75%);
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 75%);
  pointer-events: none;
}
.hero-inner {
  position: relative;
  z-index: 1;
  /* Vertical longhands only — a `padding: V 0 V` shorthand here would clobber
   * .container's horizontal padding (same specificity, later rule), leaving the
   * hero content edge-to-edge on mobile (< the 760px max-width, where the
   * centering whitespace that hides it on desktop disappears). */
  padding-top: clamp(2rem, 5vw, 4rem);
  padding-bottom: clamp(2.5rem, 6vw, 5rem);
  max-width: 760px;
}
.accent-rule {
  width: 64px;
  height: 5px;
  border-radius: 999px;
  background: var(--amber);
  margin-bottom: 2rem;
}
.eyebrow {
  font-size: clamp(0.78rem, 1.6vw, 0.92rem);
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--pg-muted);
  margin-bottom: 1.5rem;
}
.hero-title {
  font-weight: 900;
  font-size: clamp(3.25rem, 11vw, 6.5rem);
  line-height: 0.94;
  letter-spacing: -0.04em;
  color: var(--pg-heading);
  margin-bottom: 1.75rem;
}
.hero-title .em {
  color: var(--amber);
}
.hero-desc {
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  line-height: 1.55;
  color: var(--pg-text);
  max-width: 42ch;
  margin-bottom: 2.5rem;
  font-weight: 400;
}
.cta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.6rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  text-decoration: none;
}
.btn-primary {
  background: var(--amber);
  color: var(--navy);
  box-shadow: 0 8px 24px -8px rgba(232, 152, 32, 0.6);
}
.btn-primary:hover {
  background: var(--amber-light);
  transform: translateY(-2px);
}
.btn-ghost {
  border-color: var(--ghost-border);
  color: var(--pg-heading);
}
.btn-ghost:hover {
  border-color: var(--ghost-hover-border);
  background: var(--ghost-hover-bg);
}
.btn .arrow {
  transition: transform 0.2s ease;
}
.btn:hover .arrow {
  transform: translateX(3px);
}
.beta-note {
  font-size: 0.88rem;
  color: var(--pg-muted);
  padding: 0.45rem 1rem;
  border: 1px solid var(--pg-line);
  border-radius: 999px;
  white-space: nowrap;
}

/* Section base */
.section-pad {
  padding: clamp(4.5rem, 10vw, 7.5rem) 0;
}
.section-label {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--amber);
  margin-bottom: 1rem;
}
.section-title {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--pg-heading);
  line-height: 1.15;
}

/* Features */
.features {
  background: var(--pg-bg);
  border-top: 1px solid var(--pg-line);
  border-bottom: 1px solid var(--pg-line);
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-top: 3rem;
}
.feature-card {
  padding: 1.75rem;
  border-radius: 18px;
  background: linear-gradient(180deg, var(--pg-surface), var(--card-end));
  border: 1px solid var(--pg-line);
  transition:
    transform 0.22s ease,
    border-color 0.22s ease;
}
.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(232, 152, 32, 0.4);
}
.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(232, 152, 32, 0.12);
  border: 1px solid rgba(232, 152, 32, 0.25);
  color: var(--amber);
  margin-bottom: 1.1rem;
}
.feature-card h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--pg-heading);
  margin-bottom: 0.45rem;
  letter-spacing: -0.01em;
}
.feature-card p {
  color: var(--pg-muted);
  font-size: 0.95rem;
  line-height: 1.55;
}
@media (max-width: 860px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 520px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}

/* CTA strip */
.cta-strip {
  background: var(--pg-surface);
  border-top: 1px solid var(--pg-line);
}
.cta-box {
  text-align: center;
  /* Vertical longhands only — see .hero-inner; this is also `.container .cta-box`
   * so a `padding: V 0` shorthand would zero the container's horizontal padding. */
  padding-top: clamp(3.5rem, 8vw, 6rem);
  padding-bottom: clamp(3.5rem, 8vw, 6rem);
}
.cta-box h2 {
  font-size: clamp(1.9rem, 4.5vw, 3rem);
  font-weight: 800;
  color: var(--pg-heading);
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
}
.cta-box p {
  color: var(--pg-muted);
  font-size: 1.1rem;
  max-width: 46ch;
  margin: 0 auto 2.25rem;
}

/* Footer */
footer {
  background: var(--pg-bg);
  border-top: 1px solid var(--pg-line);
  padding: clamp(2.75rem, 5vw, 4rem) 0;
}
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  font-size: 1rem;
  color: var(--pg-heading);
}
.footer-meta {
  color: var(--pg-muted);
  font-size: 0.88rem;
}
.delveen-link {
  color: var(--amber);
  text-decoration: none;
}
.delveen-link:hover {
  text-decoration: underline;
}

/* Floating scroll-to-top — fixed lower-right, fades in once past the features
 * heading (toggled by .is-visible from showScrollTop). Uses the brand amber /
 * navy constants (stable in both themes) so it reads on the light page and the
 * navy hero alike. */
.scroll-top {
  position: fixed;
  right: clamp(1rem, 3vw, 1.75rem);
  bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(1rem, 3vw, 1.75rem));
  z-index: 50;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: var(--amber);
  color: var(--navy);
  box-shadow: 0 6px 20px -6px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition:
    opacity 0.25s ease,
    transform 0.25s ease,
    visibility 0.25s,
    background 0.18s ease;
}
.scroll-top.is-visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.scroll-top:hover {
  background: var(--amber-hover, #f5b450);
}
</style>
