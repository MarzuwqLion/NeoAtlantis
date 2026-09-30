// Screenshot characters / clips in the animation viewer.
// usage: node scripts/shoot-viewer.mjs "heru:idle:0,heru:jab_1:3" [outDir]
import { chromium } from 'playwright';

const specs = (process.argv[2] ?? 'heru:idle:0').split(',');
const out = process.argv[3] ?? 'shots';
const url = process.env.URL ?? 'http://localhost:5173/?viewer';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__viewer, null, { timeout: 30000 });
for (const spec of specs) {
  const [model, clip, frame, view, weapon, palette] = spec.split(':');
  await page.evaluate(([model, clip, frame, view, weapon, palette]) => {
    const v = window.__viewer;
    if (v.model !== model || v.palette !== (palette || 'default')) v.setModel(model, palette || 'default');
    v.weapon = weapon && weapon !== 'none' ? weapon : null;
    v.setModel(model, palette || 'default');
    v.setClip(clip);
    v.view = view || 'right';
    v.playing = false;
    v.frame = Number(frame);
  }, [model, clip, frame ?? '0', view ?? 'right', weapon ?? 'none', palette ?? 'default']);
  // let springs settle a little
  await page.waitForTimeout(700);
  const name = `${out}/v_${model}${palette ? '-' + palette : ''}_${clip}_${frame}${view ? '_' + view : ''}${weapon && weapon !== 'none' ? '_' + weapon : ''}.png`;
  await page.screenshot({ path: name });
  console.log('saved', name);
}
await browser.close();
