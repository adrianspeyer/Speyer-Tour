// Kept as a compatible entry point; accessibility now runs in a real browser.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
if (process.argv[2] && process.argv[2] !== 'index.html') {
  console.error('The browser suite scans index.html and active tour states. Custom HTML targets are not supported.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [cli, 'test', '--grep', 'accessibility'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
