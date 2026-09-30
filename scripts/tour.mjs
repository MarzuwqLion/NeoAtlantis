// Jump to encounters with the autoplay bot (god mode) and capture frames.
// usage: node scripts/tour.mjs "name:env:enc:delay1,delay2,...;..." [outDir]
import { chromium } from 'playwright';

const spec = process.argv[2] ?? 'midboss:1:3:1500,3000,6000,9000,14000';
const out = process.argv[3] ?? 'shots';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (t.includes('X4122') || t.startsWith('(2')) return; if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${t}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1000);
for (const scene of spec.split(';')) {
  const [name, env, enc, delays, god] = scene.split(':');
  await page.evaluate(([e, i, g]) => { const G = window.__game; G.start(Number(e), Number(i)); G.god(g !== 'nogod'); G.autoplay(true); }, [env, enc, god ?? '']);
  let t = 0;
  for (const d of delays.split(',').map(Number)) {
    await page.waitForTimeout(d - t);
    t = d;
    await page.screenshot({ path: `${out}/t_${name}_${d}.png` });
    const st = await page.evaluate(() => { const w = window.__game.world(); const b = w.fighters.find((f) => f.kind === 'boss'); return { f: w.frame, boss: b ? `${b.def} hp${b.hp} ${b.state}${b.move ? ':' + b.move.id : ''}` : '-', enemies: w.fighters.filter((f) => f.team === 1).map((f) => f.def + ':' + f.state).join(' '), cut: !!w.level.cutscene }; });
    console.log(name, d, JSON.stringify(st));
  }
}
console.log('--- console ---');
for (const l of logs.slice(0, 30)) console.log(l);
console.log('errors:', await page.evaluate(() => window.__game.errors));
await browser.close();
