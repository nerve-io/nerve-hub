/**
 * POC: UI Consistency Screenshot & Merge
 *
 * 1. Takes screenshots of 4 nerve-hub WebUI pages
 * 2. Merges them into a 2×2 grid using an HTML page (rendered by Puppeteer)
 * 3. Outputs merged image for VLM analysis
 *
 * Usage: node .poc/screenshot-merge.mjs
 */

import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', '.agent', 'reports', 'assets');
const BASE_URL = 'http://localhost:5173';

const PAGES = [
  { name: 'Kanban', path: '/kanban' },
  { name: 'Task Detail', path: '' }, // will set after getting a task id
  { name: 'Agents', path: '/agents' },
  { name: 'Event Log', path: '/events' },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const screenshots = [];

  try {
    // ── Step 1: Get a task ID from the Kanban page ──
    console.log('[1/5] Fetching task IDs from API...');
    let taskId;
    try {
      const res = await fetch('http://localhost:3141/api/tasks?limit=1');
      const tasks = await res.json();
      if (tasks.length > 0) taskId = tasks[0].id;
    } catch (e) {
      console.warn('Could not fetch task from API:', e.message);
    }

    // Resolve Task Detail path
    const pageConfigs = PAGES.map((p) => {
      if (p.name === 'Task Detail' && taskId) {
        return { name: p.name, path: `/tasks/${taskId}` };
      }
      return p;
    });

    // ── Step 2: Screenshot each page ──
    for (let i = 0; i < pageConfigs.length; i++) {
      const { name, path } = pageConfigs[i];
      if (!path) continue;
      const url = `${BASE_URL}${path}`;
      console.log(`[2/5] Screenshot: ${name} (${url})`);

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
        console.warn(`  ⚠️  Page load timed out for ${name}, taking whatever rendered`);
      });
      await new Promise((r) => setTimeout(r, 1000)); // extra render time

      const filePath = resolve(OUT_DIR, `poc-${name.toLowerCase().replace(/\s+/g, '-')}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      screenshots.push({ name: name.replace(/\s+/g, '_'), path: filePath });
      await page.close();
      console.log(`  ✓ ${filePath}`);
    }

    // ── Step 3: Create merge HTML page ──
    console.log('[3/5] Creating merge HTML...');
    const imgTags = screenshots
      .map(
        (s, i) =>
          `<div class="card"><div class="label">${i + 1}. ${s.name}</div><img src="file://${s.path}" style="width:100%" /></div>`,
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; padding:20px; background:#1a1a2e; color:#eee; font-family: system-ui; }
  h1 { text-align:center; font-size:24px; margin-bottom:20px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:1400px; margin:0 auto; }
  .card { background:#16213e; border-radius:8px; overflow:hidden; border:1px solid #333; }
  .label { padding:10px 16px; font-size:16px; font-weight:600; background:#0f3460; }
  img { display:block; }
</style></head><body>
  <h1>nerve-hub WebUI — Cross-Page Consistency Audit</h1>
  <div class="grid">${imgTags}</div>
</body></html>`;

    const htmlPath = resolve(OUT_DIR, 'poc-merge.html');
    writeFileSync(htmlPath, html);

    // ── Step 4: Screenshot the merge page ──
    console.log('[4/5] Rendering merge page...');
    const mergePage = await browser.newPage();
    await mergePage.setViewport({ width: 1440, height: 2000 });
    await mergePage.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));

    const mergePath = resolve(OUT_DIR, 'poc-merged.png');
    await mergePage.screenshot({ path: mergePath, fullPage: true });
    await mergePage.close();
    console.log(`  ✓ Merged: ${mergePath}`);

    // ── Step 5: Summary ──
    console.log('[5/5] Done!');
    console.log(`\nMerged image: ${mergePath}`);
    console.log(`Individual screenshots: ${screenshots.map((s) => s.path).join(', ')}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('POC failed:', err);
  process.exit(1);
});
