<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";

const { theme, toggle } = useTheme();
const LOGIN = { name: "login", query: { redirect: "/wallet" } } as const;

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
</script>

<template>
  <div class="kaheeta-page" id="top">
    <!-- NAV -->
    <nav class="nav">
      <div class="container nav-inner">
        <a href="#top" class="brand-mark">
          <img src="/kaheeta-logo.svg" alt="" width="28" height="28" />
          <span>Kaheeta</span>
        </a>
        <div class="nav-right">
          <button
            class="icon-btn"
            :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggle"
          >
            <iconify-icon
              :icon="theme === 'dark' ? 'mdi:weather-sunny' : 'mdi:weather-night'"
              width="20"
              height="20"
              aria-hidden="true"
            ></iconify-icon>
          </button>
          <RouterLink :to="LOGIN" class="nav-cta">Log in</RouterLink>
        </div>
      </div>
    </nav>

    <!-- HERO -->
    <header class="hero">
      <div class="container hero-inner">
        <div class="accent-rule"></div>
        <p class="eyebrow">Digital Wallet · Filipino-inspired · Beta</p>
        <h1 class="hero-title">Your wallet,<br /><span class="em">digitized.</span></h1>
        <p class="hero-desc">
          Kaheeta is the digital version of the everyday Filipino wallet — carrying your IDs,
          membership cards, vaccination records, receipts, and more, always at your fingertips.
        </p>
        <div class="cta-row">
          <RouterLink :to="LOGIN" class="btn btn-primary"
            >Log in <span class="arrow">→</span></RouterLink
          >
          <span class="beta-note">Sign-up is invite-only (beta)</span>
        </div>
      </div>
    </header>

    <!-- FEATURES -->
    <section class="features section-pad" id="features">
      <div class="container">
        <p class="section-label">What's in your wallet</p>
        <h2 class="section-title">Everything you carry,<br />always with you.</h2>
        <div class="feature-grid">
          <div v-for="f in features" :key="f.title" class="feature-card">
            <div class="feature-icon">
              <iconify-icon :icon="f.icon" width="24" height="24" aria-hidden="true"></iconify-icon>
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
        <p class="section-label" style="text-align: center">Already have access?</p>
        <h2>Pick up where you left off.</h2>
        <p>Log in to open your wallet — cards, records, and expenses, right where you left them.</p>
        <div class="cta-row" style="justify-content: center">
          <RouterLink :to="LOGIN" class="btn btn-primary"
            >Log in <span class="arrow">→</span></RouterLink
          >
          <a href="mailto:hello@delveen.dev" class="btn btn-ghost">Get in touch</a>
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
        <div class="footer-links">
          <RouterLink :to="LOGIN">Log in</RouterLink>
          <a href="mailto:hello@delveen.dev">Contact</a>
        </div>
        <div class="footer-meta">
          A <a href="https://delveen.dev" class="delveen-link">delveen</a> product · © 2026
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.kaheeta-page {
  --navy: #002244;
  --navy-deep: #001327;
  --navy-surface: #0a2c52;
  --navy-surface-2: #0e3360;
  --amber: #e89820;
  --amber-light: #f5b450;
  --amber-soft: #fdf3dc;
  --white: #ffffff;
  --text: #d7e2f0;
  --muted: #8095af;
  --line: rgba(255, 255, 255, 0.08);
  --maxw: 1120px;
  --font:
    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  font-family: var(--font);
  color: var(--text);
  background: var(--navy-deep);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

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

/* Nav */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(0, 19, 39, 0.72);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
}
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
  color: var(--white);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease;
}
.icon-btn:hover {
  color: var(--white);
  background: rgba(255, 255, 255, 0.06);
}
.nav-cta {
  padding: 0.5rem 1.1rem;
  border: 1px solid rgba(232, 152, 32, 0.4);
  border-radius: 999px;
  color: var(--amber-soft) !important;
  font-size: 0.92rem;
  font-weight: 500;
  transition: all 0.18s ease;
}
.nav-cta:hover {
  background: var(--amber);
  border-color: var(--amber);
  color: var(--navy) !important;
}

/* Hero */
.hero {
  position: relative;
  background:
    radial-gradient(900px 500px at 12% -10%, rgba(232, 152, 32, 0.16), transparent 60%),
    radial-gradient(800px 600px at 100% 110%, rgba(13, 51, 96, 0.9), transparent 55%), var(--navy);
  overflow: hidden;
}
.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: linear-gradient(to bottom, black, transparent 75%);
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 75%);
  pointer-events: none;
}
.hero-inner {
  position: relative;
  z-index: 1;
  padding: clamp(4rem, 11vw, 8.5rem) 0 clamp(4rem, 9vw, 7rem);
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
  color: var(--muted);
  margin-bottom: 1.5rem;
}
.hero-title {
  font-weight: 900;
  font-size: clamp(3.25rem, 11vw, 6.5rem);
  line-height: 0.94;
  letter-spacing: -0.04em;
  color: var(--white);
  margin-bottom: 1.75rem;
}
.hero-title .em {
  color: var(--amber);
}
.hero-desc {
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  line-height: 1.55;
  color: var(--text);
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
  border-color: rgba(255, 255, 255, 0.18);
  color: var(--white);
}
.btn-ghost:hover {
  border-color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.04);
}
.btn .arrow {
  transition: transform 0.2s ease;
}
.btn:hover .arrow {
  transform: translateX(3px);
}
.beta-note {
  font-size: 0.88rem;
  color: var(--muted);
  padding: 0.45rem 1rem;
  border: 1px solid var(--line);
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
  color: var(--white);
  line-height: 1.15;
}

/* Features */
.features {
  background: var(--navy-deep);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
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
  background: linear-gradient(180deg, var(--navy-surface), rgba(10, 44, 82, 0.4));
  border: 1px solid var(--line);
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
  color: var(--white);
  margin-bottom: 0.45rem;
  letter-spacing: -0.01em;
}
.feature-card p {
  color: var(--muted);
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
  background: var(--navy-deep);
}
.cta-box {
  text-align: center;
  padding: clamp(3.5rem, 8vw, 6rem) 0;
}
.cta-box h2 {
  font-size: clamp(1.9rem, 4.5vw, 3rem);
  font-weight: 800;
  color: var(--white);
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
}
.cta-box p {
  color: var(--muted);
  font-size: 1.1rem;
  max-width: 46ch;
  margin: 0 auto 2.25rem;
}

/* Footer */
footer {
  background: var(--navy-deep);
  border-top: 1px solid var(--line);
  padding: 2.5rem 0;
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
  color: var(--white);
}
.footer-meta {
  color: var(--muted);
  font-size: 0.88rem;
}
.delveen-link {
  color: var(--amber);
  text-decoration: none;
}
.delveen-link:hover {
  text-decoration: underline;
}
.footer-links {
  display: flex;
  gap: 1.5rem;
  font-size: 0.92rem;
  color: var(--muted);
}
.footer-links a:hover {
  color: var(--white);
}
</style>
