#!/usr/bin/env node
/**
 * Speyer Tour — Preflight Validator
 * Run via `npm run preflight` (also runs as the final step of `npm run build`).
 * Exit code 0 = all checks pass. Any failure exits 1 and blocks release.
 *
 * Checks:
 *   1.  Version consistency — package.json is the single source of truth;
 *       every file that states a version must agree (changelog history exempt).
 *   2.  Dist freshness — dist headers carry the current version.
 *   3.  SUI pin freshness — every speyer-ui@X.Y.Z reference (outside changelog
 *       history) must equal SUI_COMPAT below.
 *   4.  SUI token parity — every var(--sui-*) in speyer-tour.css must exist in
 *       scripts/sui-tokens.allowlist (generated from the verified SUI release).
 *   5.  API documentation parity — every public API symbol must be mentioned
 *       in README.md, ai-instructions/llms.txt, and ai-instructions/instructions.md.
 *   6.  Private-file reference scan — no internal file names in shipped files.
 *   7.  HTML tag balance — index.html parses with no unclosed/mismatched tags.
 *   8.  Encoding hygiene — no mojibake byte sequences in shipped text files.
 *   9.  ESM/global contract — export class + globalThis assignment present,
 *       package.json declares "type": "module", and no stale "UMD" claim.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf-8');

/** When the demo / docs move to a newer SUI, update this and re-generate
 *  scripts/sui-tokens.allowlist from that SUI release's sui-tokens.css. */
const SUI_COMPAT = '3.5.0';

let pass = 0, fail = 0;
const ok  = (msg) => { pass++; console.log(`  \u2713 ${msg}`); };
const bad = (msg) => { fail++; console.error(`  \u2717 FAIL: ${msg}`); };
const section = (t) => console.log(`\n${t}`);

/* Strip changelog history from README so historical version mentions are exempt. */
const readme = read('README.md');
const changelogStart = readme.search(/^##+\s*(Changelog|Release Notes|Version History)/mi);
const readmeCurrent = changelogStart === -1
  ? readme.split(/^### v\d+\.\d+\.\d+/m)[0]
  : readme.slice(0, changelogStart);

/* ---------------------------------------------------------------- 1. Version */
section('1. Version consistency');
const pkg = JSON.parse(read('package.json'));
const V = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(V)) bad(`package.json version "${V}" is not semver`);
else ok(`package.json version ${V}`);

const versionChecks = [
  ['speyer-tour.js',                       new RegExp(`Speyer Tour v${V.replace(/\./g,'\\.')}`)],
  ['speyer-tour.js',                       new RegExp(`static VERSION = '${V.replace(/\./g,'\\.')}'`)],
  ['speyer-tour.css',                      new RegExp(`Speyer Tour v${V.replace(/\./g,'\\.')}`)],
  ['index.html',                           new RegExp(`Speyer Tour v${V.replace(/\./g,'\\.')}`)],
  ['ai-instructions/instructions.md',      new RegExp(`v${V.replace(/\./g,'\\.')}`)],
  ['ai-instructions/llms.txt',             new RegExp(`v?${V.replace(/\./g,'\\.')}`)],
  ['ai-instructions/ai-prompt-template.md',new RegExp(`v${V.replace(/\./g,'\\.')}`)],
  ['ai-instructions/.cursorrules',         new RegExp(`v${V.replace(/\./g,'\\.')}`)],
];
for (const [f, re] of versionChecks) {
  re.test(read(f)) ? ok(`${f} states v${V}`) : bad(`${f} does not state v${V}`);
}
new RegExp(`version-${V.replace(/\./g,'\\.')}-blue`).test(readmeCurrent)
  ? ok(`README badge states v${V}`) : bad(`README badge is not v${V}`);

/* Stale own-version pins: any speyer-tour@X.Y.Z outside changelog must equal V */
for (const f of ['README.md','index.html','ai-instructions/instructions.md',
                 'ai-instructions/llms.txt','ai-instructions/ai-prompt-template.md',
                 'ai-instructions/.cursorrules']) {
  const body = f === 'README.md' ? readmeCurrent : read(f);
  const pins = [...body.matchAll(/speyer-tour@(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  const stale = pins.filter(p => p !== V);
  stale.length === 0
    ? ok(`${f}: ${pins.length} speyer-tour@ pin(s) all v${V}`)
    : bad(`${f}: stale speyer-tour@ pin(s): ${[...new Set(stale)].join(', ')}`);
}

/* ------------------------------------------------------------------ 2. Dist */
section('2. Dist freshness');
for (const f of ['dist/speyer-tour.min.js','dist/speyer-tour.min.css']) {
  if (!existsSync(path.join(ROOT, f))) { bad(`${f} missing`); continue; }
  read(f).includes(`Speyer Tour v${V}`)
    ? ok(`${f} header is v${V}`)
    : bad(`${f} header is stale — run npm run build`);
}

/* -------------------------------------------------------------- 3. SUI pins */
section(`3. SUI pin freshness (expected ${SUI_COMPAT})`);
for (const f of ['README.md','index.html','ai-instructions/instructions.md',
                 'ai-instructions/llms.txt','ai-instructions/ai-prompt-template.md',
                 'ai-instructions/.cursorrules']) {
  const body = f === 'README.md' ? readmeCurrent : read(f);
  const pins = [...body.matchAll(/speyer-ui@(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  const stale = pins.filter(p => p !== SUI_COMPAT);
  stale.length === 0
    ? ok(`${f}: ${pins.length} speyer-ui@ pin(s) all ${SUI_COMPAT}`)
    : bad(`${f}: stale speyer-ui@ pin(s): ${[...new Set(stale)].join(', ')}`);
}
/* Prose mentions of "SUI x.y.z" / "Speyer UI x.y.z" outside changelog */
{
  const staleProse = [...readmeCurrent.matchAll(/Speyer[ _]UI[ -]?v?(\d+\.\d+\.\d+)/gi)]
    .map(m => m[1]).filter(p => p !== SUI_COMPAT);
  staleProse.length === 0
    ? ok(`README prose SUI versions all ${SUI_COMPAT}`)
    : bad(`README prose mentions stale SUI version(s): ${[...new Set(staleProse)].join(', ')}`);
}

/* ------------------------------------------------------------ 4. SUI tokens */
section('4. SUI token parity');
{
  const allow = new Set(read('scripts/sui-tokens.allowlist').split('\n').map(s => s.trim()).filter(Boolean));
  const css = read('speyer-tour.css').replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
  const used = [...new Set([...css.matchAll(/var\((--sui-[a-z0-9-]+)/g)].map(m => m[1]))];
  const phantoms = used.filter(t => !allow.has(t));
  phantoms.length === 0
    ? ok(`${used.length} --sui-* token references all exist in SUI ${SUI_COMPAT}`)
    : bad(`phantom SUI token(s): ${phantoms.join(', ')}`);
}

/* ------------------------------------------------------------- 5. API parity */
section('5. API documentation parity');
{
  const api = ['start','reset','next','back','goToStep','close','destroy',
               'VERSION','DEFAULT_LABELS','onBeforeShow','onAfterShow',
               'onTargetMissing','contentHTML','globalThis'];
  const src = read('speyer-tour.js');
  for (const sym of api) {
    if (!src.includes(sym)) { bad(`API symbol "${sym}" not found in source — update preflight list`); continue; }
    const missing = ['README.md','ai-instructions/llms.txt','ai-instructions/instructions.md']
      .filter(f => !read(f).includes(sym));
    missing.length === 0
      ? ok(`"${sym}" documented in README + llms.txt + instructions.md`)
      : bad(`"${sym}" missing from: ${missing.join(', ')}`);
  }
}

/* ---------------------------------------------------- 6. Private references */
section('6. Private-file reference scan');
{
  const shipped = ['README.md','index.html','package.json','speyer-tour.js','speyer-tour.css',
                   'ai-instructions/instructions.md','ai-instructions/llms.txt',
                   'ai-instructions/ai-prompt-template.md','ai-instructions/.cursorrules',
                   'dist/speyer-tour.min.js','dist/speyer-tour.min.css'];
  /* Needles are assembled from fragments so this shipped file never contains
     the literal names it scans for. */
  const needles = ['SUI-COPI'+'LOT', 'PUSH'+'-v', 'COMPONENT-PROP'+'OSALS',
                   'COPILOT-'+'GUIDE', 'WORK'+'ORDER', 'TOUR-COPI'+'LOT'];
  let hits = 0;
  for (const f of shipped) {
    if (!existsSync(path.join(ROOT, f))) continue;
    const body = read(f);
    for (const n of needles) if (body.includes(n)) { bad(`${f} references private "${n}"`); hits++; }
  }
  if (hits === 0) ok('no private-file references in shipped files');
}

/* --------------------------------------------------------- 7. HTML balance */
section('7. HTML tag balance (index.html)');
{
  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
  const html = read('index.html')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style[\s\S]*?<\/style>/gi, '<style></style>');
  const stack = []; let balanced = true;
  for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*?>/g)) {
    const tag = m[1].toLowerCase();
    if (VOID.has(tag) || m[0].endsWith('/>')) continue;
    if (m[0][1] === '/') {
      if (stack.length && stack[stack.length-1] === tag) stack.pop();
      else { bad(`mismatched </${tag}>`); balanced = false; break; }
    } else stack.push(tag);
  }
  if (balanced && stack.length) { bad(`unclosed <${stack[stack.length-1]}>`); balanced = false; }
  if (balanced) ok('index.html tags balanced');
}

/* ---------------------------------------------------- 8. Encoding hygiene */
section('8. Encoding hygiene');
{
  const mojibake = /\u00C3[\u00A0-\u00BF]|\u00E2\u20AC|\u00EF\u00BB\u00BF/;
  let clean = true;
  for (const f of ['README.md','index.html','speyer-tour.js','speyer-tour.css',
                   'ai-instructions/instructions.md','ai-instructions/llms.txt',
                   'ai-instructions/ai-prompt-template.md','ai-instructions/.cursorrules']) {
    if (mojibake.test(read(f))) { bad(`${f} contains mojibake sequences`); clean = false; }
  }
  if (clean) ok('no mojibake in shipped text files');
}

/* ------------------------------------------------ 9. ESM/global contract */
section('9. ESM/global contract');
{
  const src = read('speyer-tour.js');
  src.includes('export class SpeyerTour') ? ok('ESM export present') : bad('missing `export class SpeyerTour`');
  src.includes('globalThis.SpeyerTour')   ? ok('globalThis assignment present') : bad('missing globalThis.SpeyerTour assignment');
  pkg.type === 'module' ? ok('package.json "type": "module"') : bad('package.json missing "type": "module"');
  /UMD/.test(src) ? bad('source claims "UMD" — known past regression') : ok('no stale UMD claim');
}

/* ------------------------------------------------------------------ Summary */
console.log(`\n${'='.repeat(50)}\nPreflight: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
