// Render every character side by side in the animation viewer.
// usage: node scripts/lineup.mjs [out.png] [three|right]
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'shots/lineup.png';
const view = process.argv[3] ?? 'three';
const url = process.env.URL ?? 'http://localhost:5173/?viewer';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__viewer, null, { timeout: 60000 });
await page.evaluate((v) => { window.__viewer.lineup(v); document.querySelector('.viewer-ui').style.display = 'none'; }, view);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
