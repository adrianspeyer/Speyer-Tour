/**
 * Speyer Tour v3.0.0
 * Accessible, zero-dependency tutorial overlays for PWAs and Web Apps.
 * https://github.com/adrianspeyer/speyer-tour
 * MIT License — Made in Canada with love 🇨🇦
 *
 * Works with any CSS framework or none.
 * Load Speyer UI (SUI) tokens before speyer-tour.css for native design-system integration.
 *
 * What's new in v3.0.0:
 *  - ESM export with global fallback (window.SpeyerTour) for <script type="module">
 *  - destroy() method — clean teardown without writing localStorage
 *  - Per-step onBeforeShow / onAfterShow hooks
 *  - onTargetMissing callback — control what happens when a target isn't found
 *  - Smart mobile positioning — tooltip at top when target is in lower viewport half
 *  - Lazy steps — pass a function that returns steps, evaluated at start() time
 *  - IntersectionObserver scroll confirmation — replaces fragile setTimeout(300)
 *  - i18n config flag (defaults false) — metadata for AI tooling, not read at runtime
 */
export class SpeyerTour {

  /**
   * Default button / chrome labels.
   * Override via config.labels for i18n support.
   * @type {object}
   */
  static DEFAULT_LABELS = {
    skip:   'Skip tour',
    back:   'Back',
    next:   'Next',
    finish: 'Finish',
    stepOf: '{current} / {total}',
  };

  /** Library version. */
  static VERSION = '3.0.0';

  /**
   * @param {object} config
   * @param {string}          config.tourId            Unique ID, used as localStorage key.
   * @param {Array|Function}  config.steps             Step array, or function returning one (lazy).
   * @param {boolean}         [config.allowClose]      Click overlay to close. Default: false.
   * @param {number}          [config.padding]         Px gap between element and ring. Default: 8.
   * @param {number}          [config.tooltipWidth]    Tooltip width in px. Default: 320.
   * @param {boolean}         [config.i18n]            Multi-lingual metadata flag. Default: false.
   *                                                    Not read by the library at runtime — signals to
   *                                                    AI tooling and integrators that this tour instance
   *                                                    expects translated labels. When true, AI prompts
   *                                                    will suggest a labels object.
   * @param {object}          [config.labels]          UI label overrides for i18n.
   * @param {string}          [config.labels.skip]     "Skip tour" button. Default: 'Skip tour'.
   * @param {string}          [config.labels.back]     "Back" button. Default: 'Back'.
   * @param {string}          [config.labels.next]     "Next" button. Default: 'Next'.
   * @param {string}          [config.labels.finish]   Last-step button. Default: 'Finish'.
   * @param {string}          [config.labels.stepOf]   Step counter template. Default: '{current} / {total}'.
   * @param {object}          [config.icons]           Optional icon HTML for buttons (not bundled).
   * @param {string}          [config.icons.next]      HTML string for next button icon.
   * @param {string}          [config.icons.back]      HTML string for back button icon.
   * @param {string}          [config.icons.skip]      HTML string for skip button icon.
   * @param {function}        [config.onStart]         Called when tour begins.
   * @param {function}        [config.onStep]          Called on each step render.
   * @param {function}        [config.onComplete]      Called when user finishes all steps.
   * @param {function}        [config.onSkip]          Called when user skips or presses Escape.
   * @param {function}        [config.onTargetMissing] Called when a step target isn't found.
   *                                                    Receives { step, stepIndex, tourId }.
   *                                                    Default: console.warn + skip to next step.
   *
   * Step object:
   * @param {string|null} step.target        CSS selector. null = floating centred step.
   * @param {string}      step.title         Heading text (textContent, XSS-safe).
   * @param {string}      step.content       Body text (textContent, XSS-safe).
   * @param {string}      [step.placement]   'bottom'|'top'|'left'|'right'. Default: 'bottom'.
   * @param {function}    [step.onBeforeShow] Async-safe. Called before step renders.
   *                                          Receives { step, stepIndex, tourId }.
   *                                          Return false to skip the step.
   * @param {function}    [step.onAfterShow]  Called after step is positioned and visible.
   *                                          Receives { step, stepIndex, tourId }.
   */
  constructor(config) {
    this.tourId = config.tourId;
    this._stepsSource = config.steps; // raw — may be function or array
    this.steps  = null;                // resolved at start()

    this._cfg = {
      allowClose:   config.allowClose   ?? false,
      padding:      config.padding      ?? 8,
      tooltipWidth: config.tooltipWidth ?? 320,
      i18n:         config.i18n         ?? false, // metadata only — not read at runtime
    };

    // Merge user labels over defaults — partial overrides supported
    this._labels = Object.assign(
      {},
      SpeyerTour.DEFAULT_LABELS,
      config.labels ?? {}
    );

    // Optional icon HTML for buttons (not bundled — host app provides these)
    this._icons = config.icons ?? {};

    this._cb = {
      onStart:         typeof config.onStart         === 'function' ? config.onStart         : null,
      onStep:          typeof config.onStep          === 'function' ? config.onStep          : null,
      onComplete:      typeof config.onComplete      === 'function' ? config.onComplete      : null,
      onSkip:          typeof config.onSkip          === 'function' ? config.onSkip          : null,
      onTargetMissing: typeof config.onTargetMissing === 'function' ? config.onTargetMissing : null,
    };

    this.currentStepIndex = 0;
    this._el              = {};
    this.isActive         = false;
    this._previousFocus   = null;
    this._positionTimer   = null;
    this._resizeRaf       = null;
    this._ioObserver      = null;
    this._resizeObserver  = null;
    this._currentTarget   = null;

    this._onKeydown     = this._onKeydown.bind(this);
    this._onResizeRaw   = this._onResizeRaw.bind(this);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /** Start the tour. Respects localStorage unless force=true. */
  start(force = false) {
    if (this.isActive) return;
    if (!force && localStorage.getItem(`speyer_tour_${this.tourId}`)) return;

    // Resolve lazy steps
    this.steps = typeof this._stepsSource === 'function'
      ? this._stepsSource()
      : this._stepsSource;

    if (!Array.isArray(this.steps) || this.steps.length === 0) {
      console.warn('SpeyerTour: No steps provided. Tour not started.');
      return;
    }

    this._previousFocus   = document.activeElement;
    this.isActive         = true;
    this.currentStepIndex = 0;

    this._createElements();
    this._renderStep();

    window.addEventListener('resize', this._onResizeRaw);
    document.addEventListener('keydown', this._onKeydown);

    if (this._cb.onStart) this._cb.onStart({ tourId: this.tourId });
  }

  /** Clear localStorage and restart. Does not fire onSkip/onComplete. */
  reset() {
    if (this.isActive) this._finish('silent');
    localStorage.removeItem(`speyer_tour_${this.tourId}`);
    this.start(true);
  }

  next() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this._renderStep();
    } else {
      this._finish('complete');
    }
  }

  back() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this._renderStep();
    }
  }

  /**
   * Jump directly to a specific step by index.
   * Clamps to valid range. Useful for tours > 6 steps with
   * "jump to section" navigation.
   * @param {number} index Zero-based step index.
   */
  goToStep(index) {
    if (!this.isActive || !this.steps) return;
    const clamped = Math.max(0, Math.min(index, this.steps.length - 1));
    this.currentStepIndex = clamped;
    this._renderStep();
  }

  /** Close the tour and mark as completed in localStorage. */
  close() {
    if (!this.isActive) return;
    this._finish('skip');
  }

  /**
   * Destroy the tour instance. Removes all DOM elements and listeners
   * WITHOUT writing completion state to localStorage. Use for SPA route
   * changes or when the tour host component unmounts.
   */
  destroy() {
    if (!this.isActive) return;
    this._finish('destroy');
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Private: DOM creation
  // ─────────────────────────────────────────────────────────────────────────

  _createElements() {
    const make = (cls, attrs = {}) => {
      const el = document.createElement('div');
      el.className = cls;
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };

    // Four blocking panels (replace box-shadow hack)
    this._el.panelTop    = make('speyer-tour-panel speyer-tour-panel-top');
    this._el.panelRight  = make('speyer-tour-panel speyer-tour-panel-right');
    this._el.panelBottom = make('speyer-tour-panel speyer-tour-panel-bottom');
    this._el.panelLeft   = make('speyer-tour-panel speyer-tour-panel-left');

    // Single full-screen overlay for floating steps
    this._el.overlay = make('speyer-tour-overlay');

    // Ring glow around the highlighted element
    this._el.ring = make('speyer-tour-ring', { 'aria-hidden': 'true' });

    // Tooltip dialog
    this._el.tooltip = make('speyer-tour-tooltip', {
      role: 'dialog',
      'aria-modal': 'true',
    });

    // Wire overlay click-to-close
    const handleOverlayClick = () => { if (this._cfg.allowClose) this.close(); };
    this._el.panelTop.addEventListener('click',    handleOverlayClick);
    this._el.panelRight.addEventListener('click',  handleOverlayClick);
    this._el.panelBottom.addEventListener('click', handleOverlayClick);
    this._el.panelLeft.addEventListener('click',   handleOverlayClick);
    this._el.overlay.addEventListener('click',     handleOverlayClick);

    const frag = document.createDocumentFragment();
    frag.append(
      this._el.overlay,
      this._el.panelTop, this._el.panelRight,
      this._el.panelBottom, this._el.panelLeft,
      this._el.ring,
      this._el.tooltip
    );
    document.body.appendChild(frag);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Private: Rendering
  // ─────────────────────────────────────────────────────────────────────────

  async _renderStep() {
    if (this._positionTimer) {
      clearTimeout(this._positionTimer);
      this._positionTimer = null;
    }
    if (this._ioObserver) {
      this._ioObserver.disconnect();
      this._ioObserver = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._currentTarget = null;

    const step    = this.steps[this.currentStepIndex];
    const total   = this.steps.length;
    const current = this.currentStepIndex + 1;
    const isLast  = this.currentStepIndex === total - 1;
    const isFirst = this.currentStepIndex === 0;

    // ── Per-step onBeforeShow hook ──────────────────────────────────────
    if (typeof step.onBeforeShow === 'function') {
      const result = await step.onBeforeShow({
        step, stepIndex: this.currentStepIndex, tourId: this.tourId
      });
      // Return false to skip this step (safe — won't overshoot past last step)
      if (result === false) {
        this._skipStep();
        return;
      }
    }

    const isFloating = !step.target;
    const targetEl   = isFloating ? null : document.querySelector(step.target);

    // ── Missing target handling ─────────────────────────────────────────
    if (!isFloating && !targetEl) {
      if (this._cb.onTargetMissing) {
        this._cb.onTargetMissing({
          step, stepIndex: this.currentStepIndex, tourId: this.tourId
        });
      } else {
        console.warn(`SpeyerTour: Target "${step.target}" not found. Skipping step.`);
      }
      this._skipStep();
      return;
    }

    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Toggle modes
    this._el.tooltip.classList.toggle('is-floating', isFloating);
    this._el.ring.classList.toggle('is-hidden', isFloating);
    this._el.overlay.classList.toggle('is-active', isFloating);
    [this._el.panelTop, this._el.panelRight, this._el.panelBottom, this._el.panelLeft]
      .forEach(p => p.classList.toggle('is-hidden', isFloating));

    // Progress dots — indices are integers, safe for innerHTML
    const dotsHTML = Array.from({ length: total }, (_, i) => {
      const cls = i < this.currentStepIndex ? 'is-done'
                : i === this.currentStepIndex ? 'is-active' : '';
      return `<span class="speyer-tour-dot ${cls}" aria-hidden="true"></span>`;
    }).join('');

    // Step counter label — uses configurable stepOf template
    const stepLabel = this._labels.stepOf
      .replace('{current}', current)
      .replace('{total}', total);

    // Button labels from config
    const skipLabel   = this._labels.skip;
    const backLabel   = this._labels.back;
    const nextLabel   = isLast ? this._labels.finish : this._labels.next;

    // Build structural shell — NO user content here (XSS safe)
    // dotsHTML is safe (indices are integers). All user-configurable strings
    // (title, content, button labels, step counter) are set via textContent below.
    this._el.tooltip.innerHTML = `
      <div class="speyer-tour-progress" aria-hidden="true">
        ${dotsHTML}
        <span class="speyer-tour-step-label" id="speyer-tour-counter"></span>
      </div>
      <h3 id="speyer-tour-title" class="speyer-tour-title"></h3>
      <p  id="speyer-tour-desc"  class="speyer-tour-content"></p>
      <hr class="speyer-tour-divider" aria-hidden="true">
      <div class="speyer-tour-controls">
        <button class="speyer-tour-btn" id="speyer-tour-skip"></button>
        <div class="speyer-tour-controls-right">
          ${!isFirst ? '<button class="speyer-tour-btn" id="speyer-tour-back"></button>' : ''}
          <button class="speyer-tour-btn speyer-tour-btn-primary" id="speyer-tour-next"></button>
        </div>
      </div>
    `;

    // User content and button labels via textContent only (XSS-safe)
    document.getElementById('speyer-tour-title').textContent   = step.title   ?? '';
    document.getElementById('speyer-tour-desc').textContent    = step.content ?? '';
    document.getElementById('speyer-tour-counter').textContent = stepLabel;

    // Button labels — with optional icon HTML (trusted, from constructor config)
    this._setButtonContent('speyer-tour-skip', skipLabel, this._icons.skip);
    this._setButtonContent('speyer-tour-next', nextLabel, this._icons.next);
    if (!isFirst) this._setButtonContent('speyer-tour-back', backLabel, this._icons.back);

    // Tooltip width — cleared on mobile so CSS left:16px/right:16px takes over
    const isMobileRender = window.innerWidth < 640;
    this._el.tooltip.style.width = isMobileRender ? '' : `${this._cfg.tooltipWidth}px`;

    // Accessibility
    this._el.tooltip.setAttribute('aria-labelledby',  'speyer-tour-title');
    this._el.tooltip.setAttribute('aria-describedby', 'speyer-tour-desc');
    this._el.tooltip.setAttribute('aria-label',
      `Tour step ${current} of ${total}: ${step.title ?? ''}`
    );

    // Buttons
    document.getElementById('speyer-tour-skip').onclick = () => this.close();
    document.getElementById('speyer-tour-next').onclick = () => this.next();
    if (!isFirst) document.getElementById('speyer-tour-back').onclick = () => this.back();

    // ── Position after scroll confirmation ──────────────────────────────
    if (targetEl && 'IntersectionObserver' in window) {
      this._waitForVisible(targetEl, () => {
        this._positionElements();
        document.getElementById('speyer-tour-next')?.focus();
        this._fireAfterShow(step);
      });
    } else {
      // Floating steps or IO not supported — use timeout fallback
      this._positionTimer = setTimeout(() => {
        this._positionTimer = null;
        this._positionElements();
        document.getElementById('speyer-tour-next')?.focus();
        this._fireAfterShow(step);
      }, isFloating ? 50 : 400);
    }

    // ── Target resize observation ─────────────────────────────────────
    // If the highlighted element changes size (sidebar collapse, accordion),
    // reposition ring + panels to match.
    if (targetEl && 'ResizeObserver' in window) {
      this._currentTarget = targetEl;
      this._resizeObserver = new ResizeObserver(() => {
        if (this.isActive) this._positionElements();
      });
      this._resizeObserver.observe(targetEl);
    }

    if (this._cb.onStep) {
      this._cb.onStep({ tourId: this.tourId, stepIndex: this.currentStepIndex, step });
    }
  }

  /**
   * Wait for a target element to be visible in the viewport using
   * IntersectionObserver. Falls back to a timeout if the observer
   * doesn't fire within 500ms (e.g. fixed elements, edge cases).
   */
  _waitForVisible(targetEl, callback) {
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      if (this._ioObserver) { this._ioObserver.disconnect(); this._ioObserver = null; }
      if (this._positionTimer) { clearTimeout(this._positionTimer); this._positionTimer = null; }
      callback();
    };

    this._ioObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) done();
    }, { threshold: 0.5 });
    this._ioObserver.observe(targetEl);

    // Safety fallback — 500ms max wait
    this._positionTimer = setTimeout(done, 500);
  }

  /** Fire per-step onAfterShow hook. */
  _fireAfterShow(step) {
    if (typeof step.onAfterShow === 'function') {
      step.onAfterShow({
        step, stepIndex: this.currentStepIndex, tourId: this.tourId
      });
    }
  }

  /**
   * Skip the current step safely. Advances to the next step if one exists,
   * or finishes the tour if already on the last step. Prevents the overshoot
   * bug where onBeforeShow returning false on the penultimate step would
   * call next() → _finish('complete') and skip the final floating step.
   */
  _skipStep() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this._renderStep();
    } else {
      // Genuinely no more steps — finish the tour
      this._finish('complete');
    }
  }

  /**
   * Set button content with optional icon HTML + text label.
   * Icon HTML is trusted (comes from constructor config, not user input).
   * Label text is always safe (textNode, not innerHTML).
   * @param {string} id       Button element ID.
   * @param {string} label    Text label.
   * @param {string} [iconHTML] Optional icon HTML string.
   */
  _setButtonContent(id, label, iconHTML) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (iconHTML) {
      btn.innerHTML = ''; // clear
      const iconSpan = document.createElement('span');
      iconSpan.className = 'speyer-tour-btn-icon';
      iconSpan.innerHTML = iconHTML; // trusted — from config, not user input
      btn.appendChild(iconSpan);
      btn.appendChild(document.createTextNode(' ' + label));
    } else {
      btn.textContent = label;
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Private: Positioning
  // ─────────────────────────────────────────────────────────────────────────

  _positionElements() {
    if (!this.isActive) return;

    const step       = this.steps[this.currentStepIndex];
    const isFloating = !step.target;
    const pad        = this._cfg.padding;
    const margin     = 16;
    const vw         = window.innerWidth;
    const vh         = window.innerHeight;
    const isMobile   = vw < 640;

    if (isFloating) {
      // Floating: CSS handles centring; nothing to position here
      return;
    }

    const targetEl = document.querySelector(step.target);
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();

    // ── Four blocking panels ───────────────────────────────────────────────
    // Top: viewport top → element top
    this._el.panelTop.style.cssText =
      `top:0; left:0; width:${vw}px; height:${Math.max(0, rect.top - pad)}px`;

    // Bottom: element bottom → viewport bottom
    this._el.panelBottom.style.cssText =
      `top:${rect.bottom + pad}px; left:0; width:${vw}px; height:${Math.max(0, vh - rect.bottom - pad)}px`;

    // Left: alongside element, left of it
    this._el.panelLeft.style.cssText =
      `top:${rect.top - pad}px; left:0; width:${Math.max(0, rect.left - pad)}px; height:${rect.height + pad * 2}px`;

    // Right: alongside element, right of it
    this._el.panelRight.style.cssText =
      `top:${rect.top - pad}px; left:${rect.right + pad}px; width:${Math.max(0, vw - rect.right - pad)}px; height:${rect.height + pad * 2}px`;

    // ── Ring ──────────────────────────────────────────────────────────────
    this._el.ring.style.cssText =
      `top:${rect.top - pad}px; left:${rect.left - pad}px; width:${rect.width + pad * 2}px; height:${rect.height + pad * 2}px`;

    // ── Tooltip placement ─────────────────────────────────────────────────
    const ttRect    = this._el.tooltip.getBoundingClientRect();
    const ttW       = ttRect.width  || this._cfg.tooltipWidth;
    const ttH       = ttRect.height || 200; // estimated if not yet rendered
    const arrowSize = 10;
    const placement = step.placement || 'bottom';

    const FLIP = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' };

    const calcPos = (p) => {
      switch (p) {
        case 'bottom': return { top: rect.bottom + pad + arrowSize, left: rect.left + rect.width / 2 - ttW / 2 };
        case 'top':    return { top: rect.top - ttH - pad - arrowSize, left: rect.left + rect.width / 2 - ttW / 2 };
        case 'right':  return { top: rect.top + rect.height / 2 - ttH / 2, left: rect.right + pad + arrowSize };
        case 'left':   return { top: rect.top + rect.height / 2 - ttH / 2, left: rect.left - ttW - pad - arrowSize };
        default:       return { top: rect.bottom + pad + arrowSize, left: rect.left + rect.width / 2 - ttW / 2 };
      }
    };

    const fits = (pos, p) => {
      const isVert = p === 'top' || p === 'bottom';
      if (isVert)  return pos.top >= margin && pos.top + ttH <= vh - margin;
      return pos.left >= margin && pos.left + ttW <= vw - margin;
    };

    let pos = calcPos(placement);
    let actualPlacement = placement;

    // ── Smart mobile positioning ──────────────────────────────────────────
    // If target is in the lower half of the viewport, position tooltip at top.
    // If target is in the upper half, position at bottom. This ensures the
    // highlighted element is always visible alongside the tooltip.
    if (isMobile) {
      const targetMidY = rect.top + rect.height / 2;
      const inLowerHalf = targetMidY > vh / 2;
      if (inLowerHalf) {
        // Tooltip at top, target visible below
        pos = { top: margin * 2, left: margin };
      } else {
        // Tooltip at bottom, target visible above
        pos = { top: vh - ttH - margin * 3, left: margin };
      }
      actualPlacement = inLowerHalf ? 'top' : 'bottom';
    } else if (!fits(pos, placement)) {
      // Try flipped
      const flipped = FLIP[placement];
      const flippedPos = calcPos(flipped);
      if (fits(flippedPos, flipped)) {
        pos = flippedPos;
        actualPlacement = flipped;
      }
    }

    // Always clamp to viewport
    pos.left = Math.max(margin, Math.min(pos.left, vw - ttW  - margin));
    pos.top  = Math.max(margin, Math.min(pos.top,  vh - ttH  - margin));

    this._el.tooltip.style.top  = `${pos.top}px`;
    this._el.tooltip.style.left = `${pos.left}px`;
    this._el.tooltip.setAttribute('data-placement', actualPlacement);

    // Dynamic arrow offset — tracks the target's centre rather than a hardcoded px value.
    // Sets CSS custom properties read by the ::before pseudo-element in speyer-tour.css.
    const isVert = actualPlacement === 'top' || actualPlacement === 'bottom';
    if (isVert) {
      const arrowLeft = Math.max(16, Math.min(
        rect.left + rect.width / 2 - pos.left - 6, // 6 = half arrow diagonal
        ttW - 32
      ));
      this._el.tooltip.style.setProperty('--speyer-arrow-h', `${arrowLeft}px`);
      this._el.tooltip.style.removeProperty('--speyer-arrow-v');
    } else {
      const arrowTop = Math.max(16, Math.min(
        rect.top + rect.height / 2 - pos.top - 6,
        ttH - 32
      ));
      this._el.tooltip.style.setProperty('--speyer-arrow-v', `${arrowTop}px`);
      this._el.tooltip.style.removeProperty('--speyer-arrow-h');
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Private: Close / Finish / Destroy
  // ─────────────────────────────────────────────────────────────────────────

  _finish(reason) {
    if (this._positionTimer)  { clearTimeout(this._positionTimer); this._positionTimer = null; }
    if (this._resizeRaf)      { cancelAnimationFrame(this._resizeRaf); this._resizeRaf = null; }
    if (this._ioObserver)     { this._ioObserver.disconnect(); this._ioObserver = null; }
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    this._currentTarget = null;

    // Only write localStorage for intentional completion/skip, not destroy or silent
    if (reason === 'complete' || reason === 'skip') {
      localStorage.setItem(`speyer_tour_${this.tourId}`, 'completed');
    }

    // Remove all elements
    Object.values(this._el).forEach(el => el?.remove());
    this._el = {};
    this.isActive = false;

    window.removeEventListener('resize', this._onResizeRaw);
    document.removeEventListener('keydown', this._onKeydown);

    if (this._previousFocus && typeof this._previousFocus.focus === 'function') {
      this._previousFocus.focus();
    }
    this._previousFocus = null;

    if (reason === 'complete' && this._cb.onComplete) this._cb.onComplete({ tourId: this.tourId });
    if (reason === 'skip'     && this._cb.onSkip)     this._cb.onSkip({ tourId: this.tourId, stepIndex: this.currentStepIndex });
    // destroy fires no callbacks — clean teardown only
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Private: Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  _onResizeRaw() {
    // Debounce via RAF — fire at most once per animation frame
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = null;
      if (this.isActive) this._positionElements();
    });
  }

  _onKeydown(e) {
    if (!this.isActive) return;

    if (e.key === 'Escape') { this.close(); return; }

    if (e.key === 'Tab') {
      const focusable = Array.from(
        this._el.tooltip.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.disabled);

      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus();  e.preventDefault(); }
      } else {
        if (document.activeElement === last)  { first.focus(); e.preventDefault(); }
      }
    }
  }
}

// Global exposure — makes SpeyerTour available on window when loaded
// via <script type="module"> without an import statement.
// ESM import users: `import { SpeyerTour } from '...'` — this line is harmless.
if (typeof globalThis !== 'undefined') globalThis.SpeyerTour = SpeyerTour;
