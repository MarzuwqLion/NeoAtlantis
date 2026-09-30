// Build a contact sheet (grid of centre crops) from screenshots.
// usage: node scripts/contact.mjs out.png cols cropW cropH scale file1 file2 ...
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const [outFile, colsArg, cwArg, chArg, scaleArg, ...files] = process.argv.slice(2);
const cols = Number(colsArg ?? 4);
const cw = Number(cwArg ?? 420);
const ch = Number(chArg ?? 560);
const scale = Number(scaleArg ?? 0.6);
const cells = files
  .map((f) => {
    const url = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
    const label = path.basename(f).replace(/\.png$/, '');
    return `<div class="c"><div class="i" style="background-image:url('${url}')"></div><div class="l">${label}</div></div>`;
  })
  .join('');
const html = `<html><body style="margin:0;background:#111;font:12px sans-serif;color:#ddd">
<style>.g{display:grid;grid-template-columns:repeat(${cols},${cw * scale}px);gap:4px;padding:4px}
.c{position:relative}.i{width:${cw * scale}px;height:${ch * scale}px;background-size:${1280 * scale}px ${720 * scale}px;background-position:center;background-repeat:no-repeat}
.l{position:absolute;left:2px;bottom:2px;background:rgba(0,0,0,.6);padding:1px 3px}</style>
<div class="g">${cells}</div></body></html>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
const rows = Math.ceil(files.length / cols);
const page = await browser.newPage({ viewport: { width: Math.ceil(cols * (cw * scale + 4) + 4), height: Math.ceil(rows * (ch * scale + 4) + 4) } });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: outFile });
await browser.close();
console.log('saved', outFile);
