/**
 * Frame-time measurement in busy scenes. Runs Chrome with vsync and the frame
 * limiter disabled so the real cost per frame is visible, optionally on the
 * low-power (integrated) GPU.
 *
 * usage: node scripts/perf.mjs [--url=http://localhost:4173/] [--lowpower] [--seconds=8] [--size=1920x1080]
 */
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const url = args.url ?? 'http://localhost:4173/';
const seconds = Number(args.seconds ?? 8);
const [w, h] = String(args.size ?? '1920x1080').split('x').map(Number);
const lowpower = !!args.lowpower;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !args.headed,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    ...(lowpower ? ['--force_low_power_gpu'] : ['--force_high_performance_gpu']),
  ],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + (lowpower ? 'lowpower' : 'highperf'));
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
const gpu = await page.evaluate(() => {
  const gl = document.getElementById('game').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('GPU:', gpu, `${w}x${h}`);
const scenes = args.stress ? [['Crowd stress (10 enemies)', 3, 1]] : [
  ['Docks fight', 0, 2],
  ['Bazaar mid-boss', 1, 3],
  ['Tube tram ride', 2, 1],
  ['Temple mixed wave', 3, 0],
  ['Temple final boss', 3, 3],
];
for (const [name, env, enc] of scenes) {
  await page.evaluate(([e, i]) => {
    const G = window.__game;
    G.start(e, i);
    G.god(true);
    G.autoplay(true);
    G.app.renderer.adaptive = false;
    G.app.renderer.pixelRatio = 1;
    G.app.renderer.resize(document.getElementById('app').clientWidth, document.getElementById('app').clientHeight);
  }, [env, enc]);
  if (args.stress) {
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const G = window.__game;
      G.autoplay(false);
      const types = ['grunt', 'grunt_elite', 'bladeRunner', 'bruiser', 'thrower', 'acrobat', 'grunt', 'bladeRunner', 'bruiser', 'acrobat'];
      const w = G.world();
      for (const t of types) G.app.world.fighters.length < 14 && window.__spawn(t);
    });
  }
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async (secs) => {
    const times = [];
    let last = performance.now();
    const end = last + secs * 1000;
    await new Promise((res) => {
      const f = (t) => {
        times.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(f);
        else res(0);
      };
      requestAnimationFrame(f);
    });
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    const R = window.__game.app.renderer;
    return { frames: times.length, avg, p95, fps: 1000 / avg, calls: R.lastDrawCalls, tris: R.lastTriangles, fighters: window.__game.world().fighters.length };
  }, seconds);
  console.log(`${name.padEnd(20)} avg ${r.avg.toFixed(2)} ms  p95 ${r.p95.toFixed(2)} ms  (~${r.fps.toFixed(0)} fps uncapped)  draws ${r.calls}  tris ${(r.tris / 1000).toFixed(0)}k  fighters ${r.fighters}`);
}
await browser.close();
