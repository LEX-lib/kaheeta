# Kaheeta

A digital wallet app under the Delveen brand. Kaheeta is the playful Ilonggo word for "wallet" (from *kahita*), and this app is the digital version of a traditional Filipino wallet—holding IDs, membership cards, vaccination records, shopping lists, receipts, debit and credit cards, and more.

Originally developed as a feature in the Lexarium portfolio, Kaheeta is now a standalone progressive web app (PWA).

## Getting Started

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- Environment variables: set `VITE_API_BASE_URL` in `.env*` (points to PocketBase backend)
- Optional: `local.jsonc` for dev login credentials (gitignored)

### Project Setup

```sh
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Production build + PWA manifest
npm run type-check   # TypeScript check
npm run test:unit    # Run tests (watch mode)
npm run lint         # Lint and format fixes
```

## Architecture

This is **two apps in one SPA**, sharing a Vue Router instance:

- **`/`** — Delveen landing page (public marketing)
- **`/wallet`** — Kaheeta wallet app (requires authentication)
- **`/login`** — Login page

See `CLAUDE.md` for full architecture details, PocketBase data layer conventions, and styling guidelines.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Browser DevTools

- **Chrome/Edge**: [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- **Firefox**: [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
