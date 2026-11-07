import { mkdir, access, writeFile } from 'node:fs/promises';
export default async function prepare() {
  const dir = new URL('../.cache/sui-3.5.2/', import.meta.url);
  await mkdir(dir, { recursive: true });
  for (const file of ['sui-tokens.min.css', 'sui-components.min.css', 'sui-icons.min.css', 'sui.min.js', 'sui-icons.min.svg']) {
    const destination = new URL(file, dir);
    try { await access(destination); continue; } catch { /* First run downloads pinned QA assets. */ }
    const response = await fetch(`https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.5.2/dist/${file}`);
    if (!response.ok) throw new Error(`SUI test asset ${file}: HTTP ${response.status}`);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }
}
