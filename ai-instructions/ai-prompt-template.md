# Speyer Tour v3.0.0 — AI Prompt Template (ChatGPT / Gemini)

Use this when asking an AI to add a product tour to your app.

---

**Prompt:**

I want to add an onboarding tour to my web app using Speyer Tour v3.0.0. Here are the files: [paste or attach your HTML/JS].

Speyer Tour is a zero-dependency, WCAG 2.2 AA accessible tour overlay library.

Please:

1. Evaluate my app first: Is SUI loaded? Is it an SPA? Are target elements always visible? Is it multi-lingual?

2. Add the tour CSS to `<head>` after any SUI token files:
   `<link rel="stylesheet" href="./src/speyer-tour.css">`

3. Add a `<script type="module">` at the bottom of `<body>`:
   ```js
   import { SpeyerTour } from './src/speyer-tour.js';
   ```
   (Or use `window.SpeyerTour` if you prefer no import statement.)

4. Create a tour with 4–6 steps. Use `target: null` for the first (welcome) and last (wrap-up) steps. Target always-visible elements with CSS selectors for the middle steps.

5. If my app is an SPA, use lazy steps (`steps: () => [...]`) and recommend `destroy()` on route change.

6. Only add multi-lingual labels if my app actually serves content in multiple languages. English-only apps don't need `i18n: true` or translated labels. `i18n` is a metadata flag for AI tooling — it's not read at runtime.

7. If I use SUI Icons, add button icons:
   ```js
   icons: { next: '<svg class="icon icon-sm"><use href="#nav-arrow-right"/></svg>' }
   ```

8. Add a replay button with: `document.getElementById('btn')?.addEventListener('click', () => tour.reset());`

Key rules:
- `title` and `content` are `textContent` only — never HTML (XSS protection)
- `tourId` must be unique, convention: `'app-feature-v1'`
- `allowClose: true` is recommended for most tours
- `tour.close()` writes to localStorage; `tour.destroy()` does not
- `tour.goToStep(index)` for jumping between sections
- Per-step hooks: `onBeforeShow` (async, return false to skip) and `onAfterShow`
- `onTargetMissing` callback for handling missing targets gracefully
- ResizeObserver tracks highlighted targets that change dimensions
