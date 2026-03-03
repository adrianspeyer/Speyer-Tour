# Speyer Tour v3.0.1 — System Prompt for Claude Code

If the user requests an onboarding tour, product walkthrough, or tutorial overlay, implement it using SpeyerTour.

## Pre-Integration Evaluation

Before writing any tour code, evaluate the target app:

1. **Is SUI loaded?** Check for `sui-tokens` or `--sui-*` custom properties in the HTML. If yes → load Tour CSS after SUI tokens. If no → load Tour CSS standalone (it has built-in fallback tokens).

2. **What loading pattern?** Use `import { SpeyerTour } from './speyer-tour.js'` for local ESM, or the CDN path for remote loading. For `<script type="module">` without imports, `window.SpeyerTour` is available automatically via globalThis exposure.

3. **What elements are always visible?** Prefer targeting elements that exist in the DOM at all times. Don't target elements inside modals, dropdowns, or route-specific views unless you wire an `onBeforeShow` hook that navigates there first.

4. **Is the app multi-lingual?** Check for `lang` attribute, i18n libraries, language switchers, or content in multiple languages. If the app is English-only, do NOT offer a multi-lingual tour — it adds complexity with no benefit. Only suggest the `labels` config if the app genuinely serves multiple languages.

5. **Is the app an SPA?** If yes → recommend `destroy()` on route change or component unmount. Consider lazy `steps: () => [...]` so steps are evaluated against current DOM state.

6. **Do key elements have IDs?** If not, add them before writing tour steps. CSS selectors must be stable.

## Prerequisites

Speyer Tour has **zero dependencies**. Load only what you need:

```html
<!-- Option A: With SUI (recommended — dark mode, tokens, etc. are automatic) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.3.1/dist/sui-tokens.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.3.1/dist/sui-components.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-tour@3.0.1/dist/speyer-tour.min.css">

<!-- Option B: Standalone, no SUI, no other dependencies -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-tour@3.0.1/dist/speyer-tour.min.css">
```

If using SUI, the tour CSS must load AFTER the SUI token files so SUI tokens take precedence.

## Implementation Instructions

1. **Run the pre-integration evaluation above.** Understand the app before touching code.

2. **Build the steps array.** Each step is an object:
   - `target` (string | null): CSS selector. `null` for a floating centred step. Good for intros and outros.
   - `title` (string): Step heading. Set via `textContent` — no HTML markup.
   - `content` (string): Step body. Also `textContent` — no HTML.
   - `placement` ('bottom' | 'top' | 'left' | 'right'): Default 'bottom'. Auto-flips.
   - `onBeforeShow` (function, optional): `({ step, stepIndex, tourId })` — Async-safe. Return `false` to skip. Use to navigate SPAs or open menus before the step.
   - `onAfterShow` (function, optional): `({ step, stepIndex, tourId })` — Fires after positioning.

3. **For dynamic apps**, use lazy steps:
   ```js
   steps: () => {
     const steps = [
       { target: null, title: 'Welcome!', content: 'Quick overview.' },
     ];
     if (document.querySelector('#pipeline')) {
       steps.push({ target: '#pipeline', title: 'Pipeline', content: 'Your deals.', placement: 'bottom' });
     }
     return steps;
   }
   ```

4. **Wire lifecycle callbacks** if the user wants analytics or side effects:
   - `onStart({ tourId })` — fires when tour begins
   - `onStep({ tourId, stepIndex, step })` — fires on each step render
   - `onComplete({ tourId })` — fires when user finishes all steps
   - `onSkip({ tourId, stepIndex })` — fires when user skips or presses Escape
   - `onTargetMissing({ step, stepIndex, tourId })` — fires when a target isn't found. Default: console.warn + skip.

5. **Multi-lingual support.** Only if the app serves multiple languages (see evaluation step 4):
   ```js
   i18n: true,   // metadata flag — tells AI tooling to suggest translations
   labels: {
     skip:   'Passer',
     back:   'Retour',
     next:   'Suivant',
     finish: 'Terminer',
     stepOf: '{current} sur {total}',
   }
   ```
   Partial overrides are supported — only set what you need.
   `i18n` defaults to `false`. It is **metadata only** — not read at runtime.
   An English-only site should not set it to `true`.

6. **Optional button icons.** Host app provides icon HTML (not bundled):
   ```js
   icons: {
     next: '<svg class="icon icon-sm"><use href="#nav-arrow-right"/></svg>',
     back: '<svg class="icon icon-sm"><use href="#nav-arrow-left"/></svg>',
   }
   ```
   Icons are prepended before the text label. Trusted HTML from config.

7. **Initialise and call start().**

```js
import { SpeyerTour } from 'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-tour@3.0.1/dist/speyer-tour.min.js';

const tour = new SpeyerTour({
  tourId: 'unique-tour-id',
  steps: [
    { target: null,        title: 'Welcome!',      content: 'Let\'s take a quick look.' },
    { target: '#sidebar',  title: 'Navigation',    content: 'All sections are here.',    placement: 'right' },
    { target: '#actions',  title: 'Quick Actions', content: 'Common tasks live here.',   placement: 'bottom' },
    { target: null,        title: 'You\'re set!',  content: 'That\'s the full tour.' },
  ],
  allowClose: true,
});

// Auto-start on first visit (respects localStorage)
tour.start();
```

## API Quick Reference

```
tour.start()         Start (checks localStorage; no-op if completed)
tour.start(true)     Force-start regardless of localStorage
tour.reset()         Clear flag and restart (silent — no callbacks)
tour.next()          Advance one step (or complete on last)
tour.back()          Go back one step
tour.goToStep(3)     Jump to step index 3 (clamped to valid range)
tour.close()         Close, mark completed, fire onSkip
tour.destroy()       Remove DOM + listeners, no localStorage write, no callbacks
tour.isActive        boolean

SpeyerTour.VERSION         '3.0.1'
SpeyerTour.DEFAULT_LABELS  { skip, back, next, finish, stepOf }
window.SpeyerTour          Available via globalThis (no import needed in <script type="module">)
```

## Rules

- `title` and `content` are always `textContent` — never use `innerHTML`. This is a security requirement.
- First step should be `target: null` (floating welcome). Last step should also be floating (wrap-up).
- Keep each step to 1–2 sentences. Short > wordy.
- `tourId` must be unique per tour. Convention: `'app-name-feature-v1'`.
- The replay button pattern: `document.getElementById('replayBtn')?.addEventListener('click', () => tour.reset());`
- For SPAs: call `tour.destroy()` on route change to prevent orphaned overlays.
- Mobile: below 640px, tooltip automatically uses smart positioning — no extra config needed.
- Target elements that resize (sidebars, accordions) are tracked by ResizeObserver — ring and panels update automatically.
