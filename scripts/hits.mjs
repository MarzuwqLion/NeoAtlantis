// Capture frames at the moment of impact (victim in hitstop) for a visual check of hit feedback.
// usage: node scripts/hits.mjs [env] [encounter] [count] [outDir]
import { chromium } from 'playwright';

const env = Number(process.argv[2] ?? 0);
const enc = Number(process.argv[3] ?? 0);
const count = Number(process.argv[4] ?? 6);
const out = process.argv[5] ?? 'shots';
const url = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(([e, i]) => {
  const G = window.__game;
  G.start(e, i);
  G.god(true);
  G.autoplay(true);
}, [env, enc]);
let n = 0;
const t0 = Date.now();
while (n < count && Date.now() - t0 < 90000) {
  // Freeze the sim on the first frame of a hit so the impact frame is captured.
  const hit = await page.evaluate(
    () =>
      new Promise((res) => {
        const G = window.__game;
        const check = () => {
          const w = G.world();
          const v = w.fighters.find((f) => f.hitstop > 3 && f.flash > 0 && (f.state === 'hitstun' || f.state === 'launched'));
          if (v) {
            G.app.frozen = true;
            res(`${v.def} ${v.state} ${v.hitType}`);
          } else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
  );
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${out}/hit_${env}_${n}.png` });
  console.log('hit', n, hit);
  n++;
  await page.evaluate(() => {
    window.__game.app.frozen = false;
  });
  await page.waitForTimeout(700 + Math.random() * 800);
}
await browser.close();
