/**
 * End-to-end playthrough in Chrome.
 *
 * A virtual "standard" gamepad is injected (navigator.getGamepads) and driven
 * every frame from the autoplay bot's decisions, so the game is played through
 * the real gamepad input path: press-any-button, title menu, four stages,
 * both bosses, level clear. Continues are taken if the bot runs out of lives.
 * Screenshots are saved for every environment, enemy type and boss fight.
 *
 * usage:
 *   npm run dev            (or: npm run build && npm run preview)
 *   node scripts/playtest.mjs [--fast] [--headed] [--out=shots/playtest] [--url=http://localhost:5173/]
 *
 * --fast skips the virtual pad and runs the bot through the input override at 4x speed.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const out = args.out ?? 'shots/playtest';
const url = args.url ?? 'http://localhost:5173/';
const fast = !!args.fast;
const headed = !!args.headed;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !headed,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('X4122') || /^\(\d+/.test(t)) return;
  if (m.type() === 'error') problems.push(`console.error: ${t}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

// Virtual standard-mapping gamepad.
await page.addInitScript(() => {
  const pad = {
    id: 'Virtual Pad (STANDARD GAMEPAD Vendor: 045e Product: 02ea)',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: { type: 'dual-rumble', playEffect: () => Promise.resolve('complete'), reset: () => Promise.resolve('complete') },
    hapticActuators: [],
  };
  navigator.getGamepads = () => [pad, null, null, null];
  window.__vpad = {
    set(buttons, axes) {
      pad.timestamp = performance.now();
      for (let i = 0; i < pad.buttons.length; i++) {
        const on = !!buttons[i];
        pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 };
      }
      pad.axes = [axes[0] ?? 0, axes[1] ?? 0, 0, 0];
    },
  };
});

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('  [shot]', name);
};
const tapButton = async (b) => {
  await page.evaluate((b) => {
    const btn = [];
    btn[b] = true;
    window.__vpad.set(btn, [0, 0]);
  }, b);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__vpad.set([], [0, 0]));
  await page.waitForTimeout(300);
};

await shot('00_press_any_button');
await tapButton(0);
await page.waitForTimeout(700);
console.log('state after pressing A:', await page.evaluate(() => window.__game.state()));
await shot('01_title');
await tapButton(0);
await page.waitForTimeout(900);
console.log('state after START GAME:', await page.evaluate(() => window.__game.state()));

// Drive the pad from the bot every frame (or use the fast override path).
await page.evaluate((fast) => {
  const G = window.__game;
  if (fast) {
    G.autoplay(true);
    G.speed(4);
    let hold = 0;
    const cont = () => {
      if (G.app.state === 'gameover') {
        hold = (hold + 1) % 20;
        window.__vpad.set([hold < 3], [0, 0]);
      }
      requestAnimationFrame(cont);
    };
    requestAnimationFrame(cont);
    return;
  }
  const bot = G.makeBot();
  let hold = 0;
  // Per simulation step: the bot decides, the decision is written to the
  // virtual pad, and the game re-polls its gamepads before sampling input.
  G.app.onBeforeStep(() => {
    if (G.app.state !== 'playing') return;
    const i = bot.decide(G.world(), 0);
    const b = [];
    b[0] = i.jump; // A / Cross
    b[2] = i.attack; // X / Square
    b[5] = i.run; // RB / R1
    window.__vpad.set(b, [i.x, i.z]);
    G.app.input.poll();
  });
  const loop = () => {
    const app = G.app;
    if (app.state === 'gameover') {
      // CONTINUE is the first menu item: tap A.
      hold = (hold + 1) % 20;
      window.__vpad.set([hold < 3], [0, 0]);
    } else {
      window.__vpad.set([], [0, 0]);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}, fast);

const seenTypes = new Set();
const seen = new Set();
const t0 = Date.now();
let lastLog = 0;
let result = 'timeout';
const limitMs = (fast ? 12 : 45) * 60 * 1000;
while (Date.now() - t0 < limitMs) {
  await page.waitForTimeout(250);
  const s = await page.evaluate(() => {
    const G = window.__game;
    const w = G.world();
    const me = w.fighters.find((f) => f.player === 0);
    const cam = w.camera.x;
    const onScreen = w.fighters
      .filter((f) => f.team === 1 && !f.dying && Math.abs(f.x - cam) < 5.5 && f.state !== 'enter')
      .map((f) => ({ def: f.def, state: f.state }));
    const boss = w.fighters.find((f) => f.kind === 'boss');
    return {
      state: G.state(),
      env: w.level.env,
      enc: w.level.active ? w.level.active.index : -1,
      tram: w.level.tramSpeed,
      cut: w.level.cutscene ? w.level.cutscene.frame : -1,
      transition: w.level.transition ? w.level.transition.phase : null,
      boss: boss ? { def: boss.def, hp: boss.hp, max: boss.maxHp, phase: boss.boss ? boss.boss.phase : 0 } : null,
      onScreen,
      hp: me ? me.hp : 0,
      lives: w.players[0].lives,
      continues: w.players[0].continues,
      frame: w.frame,
      slowmo: w.slowmo,
    };
  });
  const once = (k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  if (s.state === 'playing' && !s.transition && once(`env${s.env}`)) await shot(`10_env${s.env}_start`);
  for (const e of s.onScreen) {
    if (!seenTypes.has(e.def) && e.state !== 'lying' && e.state !== 'launched') {
      seenTypes.add(e.def);
      await shot(`20_enemy_${e.def}`);
    }
  }
  if (s.tram > 0.9 && once('tram')) await shot('30_tram_ride');
  if (s.boss) {
    const f = s.boss.hp / s.boss.max;
    if (s.cut > 80 && once(`intro_${s.boss.def}`)) await shot(`40_${s.boss.def}_intro`);
    if (s.cut < 0 && f < 0.85 && once(`fight1_${s.boss.def}`)) await shot(`41_${s.boss.def}_fight`);
    if (s.boss.phase === 2 && once(`phase2_${s.boss.def}`)) await shot(`42_${s.boss.def}_phase2`);
    if (s.cut < 0 && f < 0.3 && once(`fight2_${s.boss.def}`)) await shot(`43_${s.boss.def}_late`);
    if (s.slowmo > 0 && once(`kill_${s.boss.def}`)) await shot(`44_${s.boss.def}_final_hit`);
  }
  if (s.state === 'gameover' && once(`gameover${s.continues}`)) await shot(`50_game_over_${s.continues}`);
  if (Date.now() - lastLog > 20000) {
    lastLog = Date.now();
    console.log(
      `${((Date.now() - t0) / 1000).toFixed(0)}s state=${s.state} env=${s.env} enc=${s.enc} hp=${s.hp} lives=${s.lives} continues=${s.continues} frame=${s.frame}${s.boss ? ` boss=${s.boss.def}:${s.boss.hp}` : ''}`,
    );
  }
  if (s.state === 'clear') {
    await page.waitForTimeout(1500);
    await shot('90_level_clear');
    result = 'clear';
    break;
  }
}
const errors = await page.evaluate(() => window.__game.errors);
const final = await page.evaluate(() => {
  const w = window.__game.world();
  const p = w.players[0];
  return { frames: p.frames, minutes: +(p.frames / 3600).toFixed(1), score: p.score, continues: p.continues, damageTaken: p.damageTaken, defeated: p.enemiesDefeated };
});
console.log('RESULT', result, JSON.stringify(final), 'wall', `${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('enemy types seen:', [...seenTypes].join(', '));
console.log('problems:', problems.length ? problems : 'none');
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(result === 'clear' && problems.length === 0 && errors.length === 0 ? 0 : 1);
