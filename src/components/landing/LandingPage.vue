<script setup lang="ts">
// delveen landing page — public route "/". Login entry points route into the Kaheeta app at /wallet.
const LOGIN = { name: "login", query: { redirect: "/wallet" } } as const;
const WALLET = { name: "wallet" } as const;
</script>

<template>
  <div class="delveen" id="top">
    <!-- NAV -->
    <nav class="nav">
      <div class="container nav-inner">
        <a href="#top" class="brand-mark">delve<span class="en">en</span></a>
        <div class="nav-links">
          <a href="#approach">Approach</a>
          <a href="#work">Work</a>
          <RouterLink :to="LOGIN" class="nav-cta">Log in</RouterLink>
        </div>
      </div>
    </nav>

    <!-- HERO -->
    <header class="hero">
      <div class="container hero-inner">
        <div class="accent-rule"></div>
        <h1 class="wordmark">delve<span class="en">en</span></h1>
        <p class="eyebrow">Curious · Optimized · Crafted</p>
        <p class="hero-desc">
          A studio that <strong>digs deep</strong> — building lean, purposeful mini-apps driven by
          curiosity and refined by craft.
        </p>
        <div class="cta-row">
          <a href="#work" class="btn btn-primary">See the apps <span class="arrow">→</span></a>
          <a href="#approach" class="btn btn-ghost">How we work</a>
        </div>
      </div>
    </header>

    <!-- APPROACH / PRINCIPLES -->
    <section class="principles section-pad" id="approach">
      <div class="container">
        <p class="section-label">The approach</p>
        <h2 class="section-title">Three words we hold every build to.</h2>
        <div class="principle-grid">
          <div class="principle">
            <div class="num">01</div>
            <h3>Curious</h3>
            <p>
              Every app starts with a real itch — a question worth answering. We dig into the
              problem before we write a line.
            </p>
          </div>
          <div class="principle">
            <div class="num">02</div>
            <h3>Optimized</h3>
            <p>
              Lean by default. Fast to load, light to run, and free of the bloat that turns simple
              tools into chores.
            </p>
          </div>
          <div class="principle">
            <div class="num">03</div>
            <h3>Crafted</h3>
            <p>
              Details are the product. Considered typography, motion, and flow — polished until it
              feels effortless.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- WORK / APPS -->
    <section class="work section-pad" id="work">
      <div class="container">
        <p class="section-label">What we build</p>
        <h2 class="section-title">Small apps, sharply made.</h2>
        <p class="section-intro">
          Focused tools that do one thing exceptionally well — installable, offline-ready, and built
          to live on your home screen.
        </p>

        <div class="app-grid">
          <article class="app-card featured">
            <span class="app-badge">● Live</span>
            <div class="app-icon">🪪</div>
            <h3>Kaheeta</h3>
            <p>
              Your personal vault for vaccination records, membership cards, and everyday expenses —
              barcodes, receipts, and reports, all in your pocket.
            </p>
            <div class="app-tags">
              <span class="tag">PWA</span>
              <span class="tag">Vaccinations</span>
              <span class="tag">Memberships</span>
              <span class="tag">Expenses</span>
            </div>
            <RouterLink :to="WALLET" class="app-link"
              >Launch Kaheeta <span class="arrow">→</span></RouterLink
            >
          </article>

          <article class="app-card soon-card">
            <span class="app-badge soon">In the works</span>
            <div class="app-icon">✦</div>
            <h3>Next up</h3>
            <p>The next mini-app is already brewing. Same principles, new itch worth scratching.</p>
            <a href="#contact" class="app-link">Get notified <span class="arrow">→</span></a>
          </article>
        </div>
      </div>
    </section>

    <!-- LOGIN CTA -->
    <section class="cta-strip" id="contact">
      <div class="container cta-box">
        <p class="section-label" style="text-align: center">Already using Kaheeta?</p>
        <h2>Pick up where you left off.</h2>
        <p>
          Log in to open your vault — cards, records, and expenses, right where you left them.
        </p>
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
        <div class="footer-brand">delve<span class="en">en</span></div>
        <div class="footer-links">
          <a href="#approach">Approach</a>
          <a href="#work">Work</a>
          <RouterLink :to="LOGIN">Log in</RouterLink>
          <a href="mailto:hello@delveen.dev">Contact</a>
        </div>
        <div class="footer-meta">© 2026 delveen · Curious · Optimized · Crafted</div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.delveen {
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

.delveen *,
.delveen *::before,
.delveen *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:global(html) {
  scroll-behavior: smooth;
}

.delveen a {
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
  font-weight: 800;
  font-size: 1.35rem;
  letter-spacing: -0.02em;
  color: var(--white);
}
.brand-mark .en {
  color: var(--amber);
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--muted);
}
.nav-links a {
  transition: color 0.18s ease;
}
.nav-links a:hover {
  color: var(--white);
}
.nav-cta {
  padding: 0.5rem 1.1rem;
  border: 1px solid rgba(232, 152, 32, 0.4);
  border-radius: 999px;
  color: var(--amber-soft) !important;
  transition: all 0.18s ease;
}
.nav-cta:hover {
  background: var(--amber);
  border-color: var(--amber);
  color: var(--navy) !important;
}
@media (max-width: 640px) {
  .nav-links a:not(.nav-cta) {
    display: none;
  }
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
  margin-bottom: 2.25rem;
}
.wordmark {
  font-weight: 900;
  font-size: clamp(3.75rem, 13vw, 7.5rem);
  line-height: 0.92;
  letter-spacing: -0.04em;
  color: var(--white);
  margin-bottom: 1.75rem;
}
.wordmark .en {
  color: var(--amber);
}
.eyebrow {
  font-size: clamp(0.8rem, 1.6vw, 0.95rem);
  font-weight: 600;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 1.75rem;
}
.hero-desc {
  font-size: clamp(1.1rem, 2.2vw, 1.45rem);
  line-height: 1.5;
  color: var(--text);
  max-width: 36ch;
  margin-bottom: 2.5rem;
  font-weight: 400;
}
.hero-desc strong {
  color: var(--white);
  font-weight: 600;
}
.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
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
  line-height: 1.1;
  max-width: 18ch;
}
.section-intro {
  margin-top: 1.1rem;
  color: var(--muted);
  font-size: 1.08rem;
  max-width: 52ch;
}

/* Principles */
.principles {
  background: var(--navy-deep);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.principle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 3rem;
}
.principle {
  padding: 2rem 1.75rem;
  border-radius: 18px;
  background: linear-gradient(180deg, var(--navy-surface), rgba(10, 44, 82, 0.4));
  border: 1px solid var(--line);
  transition:
    transform 0.22s ease,
    border-color 0.22s ease;
}
.principle:hover {
  transform: translateY(-4px);
  border-color: rgba(232, 152, 32, 0.4);
}
.principle .num {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--amber);
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
}
.principle h3 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 0.6rem;
  letter-spacing: -0.01em;
}
.principle p {
  color: var(--muted);
  font-size: 0.98rem;
}
@media (max-width: 800px) {
  .principle-grid {
    grid-template-columns: 1fr;
  }
}

/* Work / apps */
.work {
  background: radial-gradient(700px 400px at 90% 0%, rgba(232, 152, 32, 0.08), transparent 60%),
    var(--navy);
}
.app-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1.5rem;
  margin-top: 3rem;
}
.app-card {
  position: relative;
  border-radius: 22px;
  border: 1px solid var(--line);
  background: linear-gradient(155deg, var(--navy-surface-2), var(--navy-surface) 55%);
  padding: 2.25rem;
  overflow: hidden;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease;
  display: flex;
  flex-direction: column;
}
.app-card:hover {
  transform: translateY(-5px);
  border-color: rgba(232, 152, 32, 0.45);
}
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  padding: 0.32rem 0.8rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(232, 152, 32, 0.14);
  color: var(--amber-light);
  border: 1px solid rgba(232, 152, 32, 0.3);
  margin-bottom: 1.4rem;
}
.app-badge.soon {
  background: rgba(255, 255, 255, 0.05);
  color: var(--muted);
  border-color: var(--line);
}
.app-icon {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 1.6rem;
  background: rgba(232, 152, 32, 0.12);
  border: 1px solid rgba(232, 152, 32, 0.25);
  margin-bottom: 1.4rem;
}
.app-card h3 {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--white);
  letter-spacing: -0.02em;
  margin-bottom: 0.6rem;
}
.app-card p {
  color: var(--muted);
  font-size: 1rem;
  margin-bottom: 1.6rem;
  max-width: 42ch;
}
.app-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: auto;
  margin-bottom: 1.5rem;
}
.tag {
  font-size: 0.8rem;
  color: var(--text);
  padding: 0.3rem 0.7rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
}
.app-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 600;
  color: var(--amber);
  font-size: 0.98rem;
}
.app-link .arrow {
  transition: transform 0.2s ease;
}
.app-card:hover .app-link .arrow {
  transform: translateX(4px);
}
.app-card.soon-card {
  background: linear-gradient(155deg, rgba(14, 51, 96, 0.5), rgba(10, 44, 82, 0.3));
}
.app-card.soon-card h3 {
  color: var(--text);
}
@media (max-width: 800px) {
  .app-grid {
    grid-template-columns: 1fr;
  }
}

/* CTA strip */
.cta-strip {
  background: var(--navy-deep);
  border-top: 1px solid var(--line);
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
  font-size: 1.15rem;
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
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--white);
}
.footer-brand .en {
  color: var(--amber);
}
.footer-meta {
  color: var(--muted);
  font-size: 0.9rem;
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
