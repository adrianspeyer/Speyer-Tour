# Speyer Tour

![Version](https://img.shields.io/badge/version-3.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)
![Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen?style=flat-square)
![WCAG](https://img.shields.io/badge/WCAG-2.2_AA-success?style=flat-square)
![SUI Compatible](https://img.shields.io/badge/Speyer_UI-3.3.1-blueviolet?style=flat-square)

Zero-dependency, WCAG 2.2 AA accessible product tours for PWAs and web apps. Works standalone or as the native onboarding layer of the [Speyer UI](https://github.com/adrianspeyer/speyer-ui) design system.

**[Live Demo](https://adrianspeyer.github.io/speyer-tour/)** · [GitHub](https://github.com/adrianspeyer/speyer-tour)

---

## Quick Start

### With Speyer UI (Recommended)

Load SUI tokens before `speyer-tour.css`. The tour inherits your full design system — dark mode, high contrast, reduced motion — automatically.

```html
<!-- 1. SUI tokens first -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.3.1/dist/sui-tokens.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.3.1/dist/sui-components.min.css">

<!-- 2. Speyer Tour after SUI tokens -->
<link rel="stylesheet" href="./src/speyer-tour.css">
```

```js
import { SpeyerTour } from './src/speyer-tour.js';

const tour = new SpeyerTour({
  tourId: 'welcome-tour',
  steps: [
    { target: null,         title: 'Welcome!',   content: 'Let\'s take a quick look around.' },
    { target: '#sidebar',   title: 'Navigation', content: 'All sections are here.',    placement: 'right' },
    { target: '#dashboard', title: 'Dashboard',  content: 'Your data lives here.',     placement: 'bottom' },
    { target: null,         title: 'All done!',  content: 'You\'re ready to go.' },
  ],
});

tour.start(); // Runs once per user (localStorage), then never again
```

### Standalone (Zero Dependencies)

Works with Bootstrap, Tailwind, your own CSS, or a blank page. The CSS ships its own light/dark/motion defaults.

```html
<link rel="stylesheet" href="./src/speyer-tour.css">
```

```js
import { SpeyerTour } from './src/speyer-tour.js';

const tour = new SpeyerTour({
  tourId:       'onboarding',
  padding:      10,      // px between element and ring (default: 8)
  tooltipWidth: 340,     // tooltip width in px (default: 320)
  allowClose:   true,    // click dark overlay to close (default: false)
  steps: [
    { target: '#logo',    title: 'Welcome!', content: 'Your app starts here.',   placement: 'bottom' },
    { target: '#actions', title: 'Actions',  content: 'Common tasks are here.',  placement: 'right' },
  ],
});

tour.start();
```

---

## How It Compares

| | Speyer Tour | Driver.js | Shepherd.js | Intro.js |
|---|---|---|---|---|
| Licence | MIT | MIT | MIT | GPL ⚠️ |
| Dependencies | Zero | Zero | Floating UI | None |
| SUI native integration | ✅ | — | — | — |
| Four-panel blocking overlay | ✅ | ✅ | ❌ (box-shadow) | ❌ |
| Ring pulse on target | ✅ | — | — | — |
| Arrow tracks target centre | ✅ | ✅ | Via Floating UI | — |
| Auto-flip placement | ✅ | ✅ | Via Floating UI | — |
| Dark mode automatic | ✅ | Manual | Manual | No |
| WCAG 2.2 AA focus trap | ✅ | Partial | ✅ | Partial |
| Focus restore on close | ✅ | — | — | — |
| XSS-safe content injection | ✅ | — | — | — |
| Floating (no-target) steps | ✅ | — | ✅ | — |
| Smart mobile positioning | ✅ | — | — | — |
| Multi-lingual labels | ✅ | — | ✅ | ✅ |
| Per-step lifecycle hooks | ✅ | — | ✅ | — |
| Lazy step evaluation | ✅ | — | — | — |
| destroy() for SPAs | ✅ | — | ✅ | — |
| Target resize observation | ✅ | — | — | — |
| AI-ready instructions | ✅ | — | — | — |

**A note on Intro.js:** Its GPL licence means commercial use requires purchasing a separate licence. Many teams discover this after shipping.

---

## Demo

The `index.html` demo renders a **CRM dashboard** (Nimbus CRM) built with Speyer UI 3.3.1 and SUI Icons. It exercises every Speyer Tour feature across 10 steps: floating intro/outro slides, all four placement directions, the pulsing highlight ring, auto-flip, lifecycle callbacks logged to an on-page event log, and a Replay button for repeated testing.

The demo also includes light interactivity — sidebar navigation switches pages, quick-action buttons fire toast notifications, and the dark-mode toggle syncs with the theme — to show how Speyer Tour overlays on a working interface without interfering with it.

**Speyer Tour itself has zero dependencies.** The demo uses SUI for its own layout; see the "Integration Examples" section inside the demo for standalone, callback, and multi-lingual code snippets.

---

## File Structure

```
speyer-tour/
├── src/
│   ├── speyer-tour.js      Core library (~7 KB unminified)
│   └── speyer-tour.css     Styles with standalone defaults + SUI integration
├── index.html              Full-featured CRM demo (SUI 3.3.1 + SUI Icons)
├── ai-instructions/
│   ├── instructions.md     Claude Code system prompt
│   ├── .cursorrules        Cursor IDE rules
│   ├── ai-prompt-template.md  ChatGPT / Gemini prompt
│   └── llms.txt            LLM crawler context
└── README.md
```

---

## Step Configuration

| Property | Type | Required | Description |
|---|---|---|---|
| `target` | `string\|null` | No | CSS selector. `null` = floating centred step (no element highlighted). Useful for intro and outro slides. |
| `title` | `string` | Yes | Step heading. Injected via `textContent` — no HTML, XSS-safe. |
| `content` | `string` | Yes | Step body. Also `textContent`. |
| `placement` | `string` | No | `'bottom'` (default) · `'top'` · `'left'` · `'right'`. Auto-flips if tooltip would overflow. On mobile, smart positioning places the tooltip opposite the target's viewport half. |
| `onBeforeShow` | `function` | No | `({ step, stepIndex, tourId })` — Called before the step renders. Async-safe. Return `false` to skip the step. Use this to navigate SPAs, open menus, or prepare the DOM. |
| `onAfterShow` | `function` | No | `({ step, stepIndex, tourId })` — Called after the step is positioned and visible. Use for analytics or triggering animations. |

---

## Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `tourId` | `string` | Required | Unique ID used as localStorage key: `speyer_tour_<tourId>` |
| `steps` | `Array\|Function` | Required | Step objects array, or a function returning one (lazy — evaluated at `start()` time). |
| `allowClose` | `boolean` | `false` | Click the dark overlay to close the tour |
| `padding` | `number` | `8` | Px gap between target element and highlight ring |
| `tooltipWidth` | `number` | `320` | Tooltip width in px (auto on mobile < 640px) |
| `i18n` | `boolean` | `false` | Metadata flag for AI tooling. Not read at runtime. When `true`, AI prompts suggest translated labels. |
| `labels` | `object` | See below | UI label overrides for multi-lingual support |
| `icons` | `object` | — | Optional icon HTML for buttons: `{ next, back, skip }`. Prepended before the text label. Not bundled — host app provides. |
| `onStart` | `function` | — | `({ tourId })` |
| `onStep` | `function` | — | `({ tourId, stepIndex, step })` |
| `onComplete` | `function` | — | `({ tourId })` |
| `onSkip` | `function` | — | `({ tourId, stepIndex })` |
| `onTargetMissing` | `function` | console.warn + skip | `({ step, stepIndex, tourId })` — Called when a step's target selector isn't found in the DOM. Default behaviour skips the step with a console warning. |

---

## Multi-lingual Labels

Pass a `labels` object to localise button text and the step counter. Partial overrides are supported — only set the keys you need.

```js
const tour = new SpeyerTour({
  tourId: 'bienvenue',
  labels: {
    skip:   'Passer',
    back:   'Retour',
    next:   'Suivant',
    finish: 'Terminer',
    stepOf: '{current} sur {total}',
  },
  steps: [...],
});
```

### Default Labels

| Key | Default | Description |
|---|---|---|
| `skip` | `'Skip tour'` | Skip/close button |
| `back` | `'Back'` | Previous step button |
| `next` | `'Next'` | Next step button |
| `finish` | `'Finish'` | Last step button (replaces "Next") |
| `stepOf` | `'{current} / {total}'` | Step counter. `{current}` and `{total}` are replaced at render time. |

Access defaults programmatically via `SpeyerTour.DEFAULT_LABELS`.

---

## API Reference

```js
tour.start()         // Start (checks localStorage; no-op if already completed)
tour.start(true)     // Force-start regardless of localStorage
tour.reset()         // Clear completion flag and restart (silent — no callbacks)
tour.next()          // Advance one step (or complete on last step)
tour.back()          // Go back one step
tour.goToStep(3)     // Jump to step index 3 (clamped to valid range)
tour.close()         // Close now, records as skipped, fires onSkip
tour.destroy()       // Clean teardown — removes DOM + listeners, does NOT write localStorage
tour.isActive        // boolean — whether a tour is currently running

SpeyerTour.VERSION         // '3.0.0'
SpeyerTour.DEFAULT_LABELS  // { skip, back, next, finish, stepOf }
```

**`close()` vs `destroy()`:** `close()` marks the tour as completed in localStorage and fires `onSkip`. `destroy()` removes everything cleanly without side effects — use for SPA route changes, component unmounts, or when you need a fresh slate without triggering callbacks or writing state.

**Global access:** The module assigns `globalThis.SpeyerTour` on load, so `<script type="module">` consumers can use `window.SpeyerTour` without an import statement. ESM `import { SpeyerTour }` works as normal.

---

## Lifecycle Callbacks

### Global callbacks (constructor)

```js
const tour = new SpeyerTour({
  tourId: 'onboarding',
  steps: [...],

  onStart:    ({ tourId }) =>
    analytics.track('tour_start', { tourId }),

  onStep:     ({ tourId, stepIndex, step }) =>
    analytics.track('tour_step', { stepIndex, title: step.title }),

  onComplete: ({ tourId }) =>
    analytics.track('tour_complete', { tourId }),

  onSkip:     ({ tourId, stepIndex }) =>
    analytics.track('tour_skip', { at: stepIndex }),

  onTargetMissing: ({ step, stepIndex }) =>
    console.warn(`Tour step ${stepIndex}: target "${step.target}" not found`),
});
```

Note: `reset()` uses an internal silent close and does **not** fire `onSkip` or `onComplete`. `destroy()` fires no callbacks at all.

### Per-step hooks

```js
{
  target: '#pipeline-board',
  title: 'Your Pipeline',
  content: 'Drag deals between stages to update their status.',
  placement: 'bottom',

  // Navigate to the right view before this step renders
  onBeforeShow: async ({ stepIndex }) => {
    document.querySelector('[data-view="pipeline"]')?.click();
    await new Promise(r => setTimeout(r, 300)); // wait for view transition
    // Return false to skip this step if the view didn't load
    return !!document.querySelector('#pipeline-board');
  },

  // Fire analytics after the step is visible
  onAfterShow: ({ step }) => {
    analytics.track('tour_step_visible', { title: step.title });
  }
}
```

---

## Overlay Behaviour

Speyer Tour uses a **four-panel blocking overlay** rather than the `box-shadow` trick used by most libraries.

**Why it matters:** The box-shadow technique creates the visual illusion of a darkened background, but the dark area is actually a shadow on a single element — click events pass straight through. The four-panel approach renders four real divs covering the area around the target element. Those divs have `pointer-events: all`, so clicks in the dark area are genuinely blocked (or close the tour, if `allowClose: true`). The target element itself remains fully accessible and interactable.

For **floating steps** (no target), a single full-screen overlay covers the entire viewport with `pointer-events: all`.

---

## Tooltip Placement & Auto-Flip

Set `placement` per step. If the tooltip would overflow the viewport in the requested direction, it automatically flips to the opposite side. Falls back to clamping on both axes if both sides are tight.

On **mobile viewports** (< 640px), the tooltip always stacks to bottom-centre regardless of placement, and the directional arrow is hidden.

The **arrow** dynamically tracks the centre of the target element — not a hardcoded offset — so it points accurately even when the tooltip is clamped to a viewport edge.

---

## Accessibility

| Feature | Detail |
|---|---|
| Dialog role | `role="dialog" aria-modal="true"` |
| Labels | `aria-labelledby` + `aria-describedby` per step |
| SR step counter | `aria-label="Tour step 2 of 5: …"` on the dialog |
| Focus trap | Tab / Shift-Tab cycle within dialog; disabled elements excluded |
| Focus restore | Pre-tour `activeElement` restored on every exit path |
| Keyboard | Escape closes at any time |
| XSS safety | `step.title`, `step.content`, and button labels set via `textContent` only |
| Reduced motion | Animations and transitions suppressed (durations → 0ms) |
| Dark mode | Automatic via `prefers-color-scheme` or `data-theme="dark"` |
| High contrast | Border widths and focus ring increase via `prefers-contrast: more` |
| Target size | Buttons ≥ 36px height (WCAG 2.5.8 minimum) |

---

## Theming

### With SUI

Load SUI tokens before `speyer-tour.css`. Done. Every colour, spacing, shadow, z-index, radius, and motion token resolves from SUI automatically.

### Without SUI

Override Speyer Tour's own variables anywhere after the stylesheet:

```css
:root {
  --speyer-tour-btn-primary-bg:    #7c3aed;
  --speyer-tour-btn-primary-hover: #6d28d9;
  --speyer-tour-radius-lg:         20px;
  --speyer-tour-overlay:           rgba(0, 0, 0, 0.7);
}
```

Full variable list is in `src/speyer-tour.css` under `/* Standalone Defaults */`.

---

## AI Integration

The `ai-instructions/` folder lets AI coding tools implement Speyer Tour without manual setup.

| Tool | File |
|---|---|
| Claude Code | `ai-instructions/instructions.md` |
| Cursor | `ai-instructions/.cursorrules` |
| ChatGPT / Gemini | `ai-instructions/ai-prompt-template.md` |
| LLM crawlers | `ai-instructions/llms.txt` |

---

## When to Use Something Else

Speyer Tour is a code-first library for developers who want full control. If your needs are different, these are solid alternatives:

- **No-code tour builder** (PMs publish tours without deploys) → [Appcues](https://www.appcues.com/) or [Product Fruits](https://www.productfruits.com/)
- **Drop-off analytics and A/B testing** → [Pendo](https://www.pendo.io/)
- **React-only with maximum community examples** → [react-joyride](https://github.com/gilbarbara/react-joyride)
- **Maximum feature density in vanilla JS** (beacons, side-panels, theming API) → [Driver.js](https://driverjs.com/)

---

## Changelog

### v3.0.0 — 2026-02-24

**New features:**

- **`destroy()` method** — clean teardown that removes DOM elements and event listeners without writing to localStorage or firing callbacks. Use for SPA route changes.
- **Per-step lifecycle hooks** — `onBeforeShow` (async-safe, return `false` to skip) and `onAfterShow` on each step object. Navigate SPAs, open menus, or fire analytics per-step.
- **`onTargetMissing` callback** — constructor option called when a step's target selector isn't found. Default: console.warn + skip. Override to navigate first, retry, or show a fallback.
- **`goToStep(index)`** — jump directly to any step by index, clamped to valid range. Useful for tours with "jump to section" navigation.
- **Lazy steps** — pass a function instead of an array: `steps: () => buildSteps()`. Evaluated at `start()` time for dynamic apps.
- **Smart mobile positioning** — tooltip positions at top when target is in the lower viewport half, and at bottom when target is in the upper half. Ensures the highlighted element is always visible.
- **IntersectionObserver scroll confirmation** — replaces the fragile `setTimeout(300)` with IO-based confirmation that the target is visible before positioning. 500ms fallback for edge cases.
- **Target resize observation** — ResizeObserver tracks the highlighted element. If it changes dimensions (sidebar collapse, accordion open), the ring and panels reposition automatically.
- **`i18n` config flag** — metadata boolean (default: `false`) signalling multi-lingual intent. Not read at runtime — used by AI tooling to decide whether to suggest translated labels.
- **`icons` config** — optional icon HTML for next/back/skip buttons, prepended before the text label. Not bundled — host app provides.
- **`SpeyerTour.VERSION`** — static property exposing the library version string.
- **Global exposure** — assigns `globalThis.SpeyerTour` on load for `<script type="module">` consumers who prefer `window.SpeyerTour` over import.

**Breaking changes:**

- `_renderStep()` is now `async` (for `onBeforeShow` support). No public API change — internal only.
- `destroy()` and `close()` have different localStorage semantics. `close()` writes; `destroy()` does not.
- Step-skipping (via `onBeforeShow` returning `false` or missing targets) now uses a safe internal advance that prevents overshooting past the final step.

---

### v2.0.0 — 2026-02-24

**Breaking: SUI 3.x era**

- **SUI 3.3.0 integration.** Demo and recommended CDN links updated from SUI 2.5.1 to 3.3.0. All 36 SUI tokens used by Speyer Tour are verified present in v3.3.0.
- **Multi-lingual labels.** New `labels` config object lets developers localise all button text (`skip`, `back`, `next`, `finish`) and the step counter (`stepOf` with `{current}` / `{total}` placeholders). Default labels remain English. Button labels now set via `textContent` for XSS safety (were previously inline in `innerHTML`).
- **SUI Icons in demo.** The demo replaces Lucide with SUI Icons (538 purpose-built SVGs). Speyer Tour itself remains icon-agnostic — no icons are bundled.
- **New demo tab: Multi-lingual.** Integration examples now include a fourth tab showing French label configuration.
- **Static `DEFAULT_LABELS`.** Access default English labels via `SpeyerTour.DEFAULT_LABELS`.
- **Removed `tour-config.json`.** The demo's steps are inline; the separate JSON config was unused dead weight.

### v1.1.0 — 2026-02-19

**Major improvements**

- **Four-panel blocking overlay.** Replaced the `box-shadow` trick with four real positioned divs. The dark areas now genuinely block pointer events. For floating steps, a single full-screen div is used instead.
- **Highlight ring with pulse.** A `speyer-tour-ring` element with a glowing border and subtle `box-shadow` pulse animation wraps the target element. Draws attention without covering content.
- **Dynamic tooltip arrow.** The `::before` pseudo-element arrow now tracks the target's centre using a CSS custom property (`--speyer-arrow-h`/`--speyer-arrow-v`) set by JS. Previously it was hardcoded to `left: 20px` regardless of alignment.
- **Auto-flip placement.** If the tooltip overflows the viewport in the requested direction, it flips to the opposite side. If both sides are tight, it clamps.
- **Mobile auto-stack.** On viewports < 640px, tooltip snaps to bottom-centre and the arrow is hidden. JS no longer sets an inline pixel width on mobile (the CSS `left:16px / right:16px` rule takes over properly).
- **Debounced resize.** `window.resize` handler now uses `requestAnimationFrame` instead of firing on every event.
- **`allowClose` option.** Set to `true` to let users click the dark overlay to close the tour (default: `false`).
- **`padding` option.** Configure the gap between target element and highlight ring in px (default: `8`).
- **`tooltipWidth` option.** Configure tooltip width in px (default: `320`).
- **Full-featured desktop demo.** Rebuilt with a real sidebar layout, sticky topbar, stats grid, activity feed, and two-column content — exercises every placement direction on a realistic dashboard.

**Bug fixes**

- Mobile inline width override: `style.width` is now cleared on mobile so CSS `width: auto` takes effect.
- Floating step centring `transform` is no longer clobbered by `prefers-reduced-motion` block.
- `_positionTimer` cleared before each `_renderStep` call to prevent stale positioning on fast navigation.
- `clearTimeout` and `cancelAnimationFrame` both called in `_finish()`.
- Disabled element filtering in focus trap.

### v1.0.0 — 2026-02-19

First production release.

- Step progress indicator (dots + "X / N" counter)
- Floating steps (`target: null`) for intro/outro slides
- Lifecycle callbacks: `onStart`, `onStep`, `onComplete`, `onSkip`
- Focus restoration to pre-tour `activeElement`
- XSS-safe content injection via `textContent`
- Standalone CSS defaults (full light/dark/contrast/motion support without SUI)
- SUI 2.5.1 native token integration

---

## Licence

[MIT](./LICENSE) — free for personal and commercial use.

Created by [Adrian Speyer](https://github.com/adrianspeyer).
