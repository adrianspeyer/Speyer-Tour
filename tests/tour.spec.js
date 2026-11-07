import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page).push(error.message));
  await page.route('https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.5.2/dist/*', async route => {
    const file = path.basename(new URL(route.request().url()).pathname);
    const mime = file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript';
    await route.fulfill({ body: await readFile(`.cache/sui-3.5.2/${file}`), contentType: mime });
  });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

for (const production of [false, true]) {
  test.describe(production ? 'production' : 'source', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/tests/fixture.html${production ? '?dist' : ''}`);
      await page.waitForFunction(() => window.ready);
    });
    test('pending hooks cannot repaint after navigation, reset or destroy', async ({ page }) => {
      await page.evaluate(() => {
        window.tour = new SpeyerTour({ tourId: 'race', steps: [
          { title: 'Old', onBeforeShow: () => new Promise(resolve => window.release = resolve) },
          { title: 'New' },
        ] });
        tour.start(true);
        tour.next();
        release();
      });
      await expect(page.locator('#speyer-tour-title')).toHaveText('New');
      await page.evaluate(() => { tour.back(); tour.destroy(); release(); });
      await expect(page.locator('.speyer-tour-tooltip')).toHaveCount(0);
      await page.evaluate(() => { tour.start(true); window.oldRelease = release; tour.reset(); oldRelease(false); release(); });
      await expect(page.locator('#speyer-tour-title')).toHaveText('Old');
      expect(await page.evaluate(() => tour.currentStepIndex)).toBe(0);
    });
    test('failed hooks recover and back skips unavailable steps in reverse', async ({ page }) => {
      await page.evaluate(() => {
        window.tour = new SpeyerTour({ tourId: 'skip', steps: [
          { title: 'First' }, { title: 'Rejected', onBeforeShow: async () => { throw Error('test failure'); } },
          { title: 'Hidden', target: '#hidden' }, { title: 'Invalid', target: '[' }, { title: 'Last' },
        ] });
        tour.start(true); tour.next();
      });
      await expect(page.locator('#speyer-tour-title')).toHaveText('Last');
      await page.locator('#speyer-tour-back').click();
      await expect(page.locator('#speyer-tour-title')).toHaveText('First');
    });
    test('storage failures never prevent start, reset or close', async ({ page }) => {
      await page.evaluate(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw Error('Blocked'); } });
        window.tour = new SpeyerTour({ tourId: 'blocked', steps: [{ title: 'Storage' }] });
        tour.start(); tour.reset();
      });
      await expect(page.locator('#speyer-tour-title')).toHaveText('Storage');
      await page.keyboard.press('Escape');
      await expect(page.locator('.speyer-tour-overlay')).toHaveCount(0);
      expect(await page.evaluate(() => tour.isActive)).toBe(false);
    });
    test('target and tooltip share keyboard scope; host inert state and focus survive teardown', async ({ page }) => {
      await page.locator('#launch').focus();
      await page.evaluate(() => {
        window.tour = new SpeyerTour({ tourId: 'keyboard', steps: [{ title: 'Target', target: '#target' }] });
        tour.start(true);
      });
      await expect(page.locator('#speyer-tour-next')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#target')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#speyer-tour-skip')).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#target')).toBeFocused();
      await page.evaluate(() => document.getElementById('outside').focus());
      await expect(page.locator('#outside')).not.toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#launch')).toBeFocused();
      await expect(page.locator('#outside')).not.toHaveAttribute('inert');
      await expect(page.locator('#owned-inert')).toHaveAttribute('inert');
    });
    test('nested scroll and resizing keep ring and tooltip aligned', async ({ page }) => {
      await page.evaluate(() => {
        window.tour = new SpeyerTour({ tourId: 'position', tooltipWidth: 420, steps: [{ title: 'Target', target: '#target' }] });
        tour.start(true);
      });
      await expect(page.locator('#speyer-tour-next')).toBeFocused();
      await page.evaluate(() => { document.getElementById('scroll').scrollTop += 20; });
      await expect.poll(() => page.evaluate(() => Math.abs(
        document.querySelector('.speyer-tour-ring').getBoundingClientRect().top -
        document.getElementById('target').getBoundingClientRect().top + 8
      ))).toBeLessThan(1);
      await page.setViewportSize({ width: 390, height: 700 });
      await expect.poll(() => page.locator('.speyer-tour-tooltip').evaluate(el => el.getBoundingClientRect().width)).toBe(358);
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect.poll(() => page.locator('.speyer-tour-tooltip').evaluate(el => el.getBoundingClientRect().width)).toBe(420);
    });
    test('long floating content stays scrollable inside the viewport', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 480 });
      await page.evaluate(() => {
        window.tour = new SpeyerTour({ tourId: 'long', steps: [{ title: 'Long content', content: 'Details. '.repeat(300) }] });
        tour.start(true);
      });
      await expect(page.locator('#speyer-tour-next')).toBeFocused();
      const rect = await page.locator('.speyer-tour-tooltip').boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(15);
      expect(rect.y + rect.height).toBeLessThanOrEqual(465);
      await expect(page.locator('#speyer-tour-next')).toBeInViewport();
      await page.locator('#speyer-tour-next').click();
      await expect(page.locator('.speyer-tour-tooltip')).toHaveCount(0);
    });
    test('accessibility standalone themes and reduced motion', async ({ page }, testInfo) => {
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce', contrast: 'more' });
        await page.evaluate(() => {
          window.tour = new SpeyerTour({ tourId: 'standalone', labels: { stepOf: 'Étape {current} sur {total}' },
            steps: [{ title: 'Bienvenue', target: '#target' }, { title: 'Terminé', contentHTML: '<strong>Merci</strong>' }] });
          tour.start(true);
        });
        await expect(page.getByRole('dialog')).toHaveAccessibleName('Étape 1 sur 2 Bienvenue');
        await expect(page.locator('#speyer-tour-next')).toBeFocused();
        expect(await page.locator('.speyer-tour-ring').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
        for (let i = 0; i < 2; i++) {
          const result = await page.evaluate(async () => {
            const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
            return { violations: r.violations, incomplete: r.incomplete.map(x => x.id) };
          });
          expect(result.violations).toEqual([]);
          if (result.incomplete.length) testInfo.annotations.push({ type: 'manual-review', description: result.incomplete.join(', ') });
          await page.locator('#speyer-tour-next').click();
        }
      }
    });
    test('completion, callback order, persistence and inactive navigation remain compatible', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const calls = [];
        const tour = new SpeyerTour({ tourId: 'compatible', steps: [{ title: 'Text', content: '<img src=x onerror=alert(1)>' }],
          onStart: () => calls.push('start'), onStep: () => calls.push('step'), onComplete: () => calls.push('complete') });
        tour.next(); tour.back(); tour.start();
        const plain = document.getElementById('speyer-tour-desc').textContent;
        tour.goToStep(NaN); tour.goToStep(0.5); tour.next(); tour.next(); tour.start();
        return { calls, plain, active: tour.isActive, saved: localStorage.getItem('speyer_tour_compatible') };
      });
      expect(result).toEqual({ calls: ['start', 'step', 'step', 'complete'], plain: '<img src=x onerror=alert(1)>', active: false, saved: 'completed' });
    });
  });
}

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`accessibility demo and every tour step ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/index.html');
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    let steps = 0;
    while (await page.locator('.speyer-tour-tooltip').count()) {
      await expect(page.locator('#speyer-tour-next')).toBeFocused();
      await expect(page.locator('.sui-toast')).toHaveCount(0);
      if (steps === 1) await page.screenshot({ path: testInfo.outputPath('targeted-step.png') });
      const result = await page.evaluate(async () => {
        const { violations, incomplete } = await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
        });
        return { violations, incomplete: incomplete.map(i => i.id) };
      });
      expect(result.violations).toEqual([]);
      if (result.incomplete.length) testInfo.annotations.push({ type: 'manual-review', description: result.incomplete.join(', ') });
      await page.locator('#speyer-tour-next').click();
      steps++;
      expect(steps).toBeLessThanOrEqual(10);
    }
    expect(steps).toBe(width < 769 ? 7 : 10);
    await page.locator('#tab-sui').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-standalone')).toBeFocused();
    await expect(page.locator('#panel-standalone')).toBeVisible();
    await page.keyboard.press('End');
    await expect(page.locator('#tab-i18n')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#tab-sui')).toBeFocused();
    for (const tab of ['sui', 'standalone', 'callbacks', 'i18n']) {
      await page.locator(`#tab-${tab}`).click();
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      })).violations);
      expect(violations).toEqual([]);
    }
  });
}

test('SUI 3.5.2 token allowlist matches the pinned release', async () => {
  const css = await readFile('.cache/sui-3.5.2/sui-tokens.min.css', 'utf8');
  const tokens = [...new Set([...css.matchAll(/(--sui-[a-z0-9-]+)\s*:/g)].map(m => m[1]))].sort();
  const allow = (await readFile('scripts/sui-tokens.allowlist', 'utf8')).trim().split('\n').sort();
  expect(tokens).toEqual(allow);
});
