// Quick visual checks of the running game.
// usage: node scripts/shoot-game.mjs [scenario] [outDir]
import { chromium } from 'playwright';

const scenario = process.argv[2] ?? 'envs';
const out = process.argv[3] ?? 'shots';
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('X4122') || t.startsWith('(2')) return;
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${t}`);
});
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'debug');
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const shot = async (name) => {
  await page.screenshot({ path: `${out}/g_${name}.png` });
  console.log('saved', name);
};
if (scenario === 'envs') {
  await shot('press');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await shot('title');
  for (const [env, enc] of [[0, 0], [1, 0], [2, 1], [3, 0], [1, 3], [3, 3]]) {
    await page.evaluate(([e, i]) => window.__game.start(e, i), [env, enc]);
    await page.waitForTimeout(2500);
    await shot(`env${env}_enc${enc}`);
  }
}
if (scenario === 'fight') {
  await page.evaluate(() => { window.__game.start(0, 0); window.__game.autoplay(true); });
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1500);
    await shot(`fight_${i}`);
  }
}
console.log('--- console ---');
for (const l of logs.slice(0, 40)) console.log(l);
console.log('errors:', await page.evaluate(() => window.__game.errors));
await browser.close();
