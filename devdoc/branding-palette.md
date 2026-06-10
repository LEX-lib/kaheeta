# Dev Portfolio — Branding Palette

> Base color: `#024` → expanded `#002244` (Deep Navy)
> Complementary: `#E89820` (Amber Gold)

---

## Core Brand

| Swatch | Name        | Hex       | Role                                  |
| ------ | ----------- | --------- | ------------------------------------- |
| 🟦     | Deep Navy   | `#002244` | Primary brand color                   |
| 🟧     | Amber Gold  | `#E89820` | Accent / complementary                |
| 🔷     | Navy Mid    | `#0A3D6B` | Hover states, dark variant of primary |
| 🟨     | Gold Wash   | `#FDF3DC` | Light accent backgrounds, highlights  |
| 🟧     | Amber Hover | `#F5B450` | Hover/active tint for amber CTAs      |

---

## Backgrounds & Surfaces

| Swatch | Name       | Hex       | Role                              |
| ------ | ---------- | --------- | --------------------------------- |
| ⬜     | White      | `#FFFFFF` | Cards, modals, content surfaces   |
| 🔲     | Off-white  | `#F5F7FA` | Page background, section fills    |
| ⬛     | Dark Ink   | `#1A1A2E` | Code blocks, terminal windows     |
| 🔘     | Steel Gray | `#E8ECF2` | Dividers, borders, input outlines |

---

## Typography

| Swatch | Name       | Hex       | Role                             |
| ------ | ---------- | --------- | -------------------------------- |
| ⬛     | Ink Black  | `#0D1117` | Headings (H1–H3)                 |
| 🔘     | Slate      | `#3D4A5C` | Body text, paragraphs            |
| 🔘     | Cool Gray  | `#6B7280` | Captions, muted labels, metadata |
| 🟧     | Amber Gold | `#E89820` | Links, active navigation items   |

---

## Semantic / Status Colors

| Swatch | Name       | Hex       | Role                        |
| ------ | ---------- | --------- | --------------------------- |
| 🟢     | Emerald    | `#1A7C45` | Success, live/active status |
| 🟡     | Amber Gold | `#E89820` | Warning, in-progress        |
| 🔴     | Ruby       | `#C0392B` | Error, danger               |
| 🔵     | Sky Blue   | `#378ADD` | Info, informational states  |

---

## Usage Guidelines

### 60 – 10 – 30 Rule

| Proportion | Color               | Where to use                                                      |
| ---------- | ------------------- | ----------------------------------------------------------------- |
| **60%**    | `#002244` Navy      | Navbar, hero section, footer, primary buttons, section headers    |
| **10%**    | `#E89820` Amber     | CTAs, hover states, skill tags, active links, card accent borders |
| **30%**    | `#F5F7FA` Off-white | Page background, card surfaces, input fields, alternating rows    |

### Additional Notes

- Use **Dark Ink `#1A1A2E`** exclusively for code blocks and terminal-style containers — gives an authentic developer aesthetic.
- Apply **Semantic colors** only in functional contexts (badges, form validation, alerts) — never for decoration.
- Use **Gold Wash `#FDF3DC`** as a subtle background tint behind amber-accented elements (e.g. skill tags, callout boxes).
- **Steel Gray `#E8ECF2`** works for horizontal rules, card borders, and input field strokes.

---

## Dark Mode

The dark theme is **navy-based**: surfaces are derived from Deep Navy, and the
primary/accent roles invert to **Amber Gold** so CTAs and active elements pop on
the navy background. Dark Ink `#1A1A2E` remains reserved for code/terminal only.

| Swatch | Name           | Hex                     | Role (dark)                              |
| ------ | -------------- | ----------------------- | ---------------------------------------- |
| 🟦     | Navy Page      | `#001327`               | Page background                          |
| 🔷     | Navy Surface   | `#0A2C52`               | Cards, modals, navbar, content surfaces  |
| 🔷     | Navy Surface 2 | `#0E3360`               | Secondary surface / alternating rows     |
| ⬜     | Divider        | `rgba(255,255,255,.08)` | Dividers, borders, outlines              |
| ⬜     | Heading        | `#FFFFFF`               | Headings                                 |
| 🔘     | Body           | `#D7E2F0`               | Body text                                |
| 🔘     | Muted          | `#8095AF`               | Captions, muted labels                   |
| 🟧     | Amber Gold     | `#E89820`               | Primary CTAs, accents, links, active nav |
| 🟧     | Amber Hover    | `#F5B450`               | Hover/active tint                        |

> **Dark inversion strategy:** in light mode Navy is the dominant 60% (navbar,
> hero, primary buttons); in dark mode Navy moves to the _surfaces_ and Amber
> takes the interactive/primary role. This keeps contrast high without
> introducing off-brand colors.

---

## CSS Custom Properties

```css
:root {
  /* Brand */
  --color-primary: #002244;
  --color-primary-dark: #0a3d6b;
  --color-accent: #e89820;
  --color-accent-light: #fdf3dc;
  --color-accent-hover: #f5b450;

  /* Backgrounds */
  --color-bg-page: #f5f7fa;
  --color-bg-card: #ffffff;
  --color-bg-card-2: #eef1f6;
  --color-bg-code: #1a1a2e;
  --color-bg-divider: #e8ecf2;

  /* Typography */
  --color-text-heading: #0d1117;
  --color-text-body: #3d4a5c;
  --color-text-muted: #6b7280;
  --color-text-link: #e89820;

  /* Semantic */
  --color-success: #1a7c45;
  --color-warning: #e89820;
  --color-error: #c0392b;
  --color-info: #378add;
}

/* Navy-based dark theme */
.dark {
  --color-primary: #e89820; /* CTAs/accents pop on navy */
  --color-primary-dark: #c87d10;
  --color-accent: #e89820;
  --color-accent-light: #3a2d10; /* dark amber wash */
  --color-accent-hover: #f5b450;

  --color-bg-page: #001327;
  --color-bg-card: #0a2c52;
  --color-bg-card-2: #0e3360;
  --color-bg-code: #0d1117;
  --color-bg-divider: rgba(255, 255, 255, 0.08);

  --color-text-heading: #ffffff;
  --color-text-body: #d7e2f0;
  --color-text-muted: #8095af;
  --color-text-link: #e89820;
  /* Semantic colors are theme-independent. */
}
```

---

## Tailwind Config Snippet

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#002244",
          dark: "#0A3D6B",
        },
        amber: {
          DEFAULT: "#E89820",
          light: "#FDF3DC",
        },
        slate: "#3D4A5C",
        ink: "#1A1A2E",
      },
    },
  },
};
```

---

_Generated for a software developer portfolio · Base: `#002244` · Accent: `#E89820`_
