/**
 * Boss brains.
 *
 * SOBEKHAN (mid-boss): telegraphed charge, ground slam with shockwave, wide
 * sweep. Armoured while attacking, vulnerable in recovery. Roars for grunt
 * reinforcements at 50% health.
 *
 * APEP (final boss): phase 1 duels with combo strings and a leaping strike;
 * phase 2 (50%) speeds up, adds a dash-through attack and thrower
 * reinforcements.
 *
 * Both answer long hit streaks with an armoured counter so they can't be
 * juggled forever.
 */
import type { Fighter, World } from './types';
import type { FighterDef } from '../data/defs';
import { MIDBOSS, FINALBOSS } from '../data/bosses';
import { chance, randInt } from './rng';
import { sign } from './view';
import { face, onScreen, targetOpen } from './aiUtil';
import { isAlive } from './fighter';
import { spawnReinforcement } from './spawn';

/** Runs every frame the boss is active (not only when it's free to act). */
export function bossTick(w: World, f: Fighter): void {
  const b = f.boss!;
  if (f.def !== 'apep' || b.phase !== 2) return;
  const R = FINALBOSS.reinforcements;
  b.reinforceTimer++;
  if (b.reinforceTimer < R.interval || b.reinforcements >= R.total) return;
  let alive = 0;
  for (const o of w.fighters) if (o.def === R.type && isAlive(o) && !o.removeMe) alive++;
  if (alive >= R.maxAlive) return;
  b.reinforceTimer = 0;
  b.reinforcements++;
  spawnReinforcement(w, R.type);
}

export function bossThink(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  if (f.def === 'sobekhan') midBoss(w, f, def, t);
  else finalBoss(w, f, t);
}

function midBoss(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  const b = f.boss!;
  const D = MIDBOSS;
  const dx = t.x - f.x;
  const dz = t.z - f.z;
  const adx = Math.abs(dx);
  const adz = Math.abs(dz);
  face(f, dx);

  if (!b.summoned && f.hp <= f.maxHp * D.summonAt) {
    b.summoned = true;
    ai.wantMove = def.moves.roar!;
    b.idle = 40;
    return;
  }
  if (b.hitsSinceAction >= D.breakAfterHits && adx < 2.6 && adz < 1.0) {
    ai.wantMove = def.moves.breaker!;
    b.hitsSinceAction = 0;
    return;
  }
  if (b.idle > 0) {
    b.idle--;
    const want = 2.1;
    ai.mz = adz > 0.25 ? sign(dz) * 0.9 : 0;
    ai.mx = adx > want + 0.5 ? sign(dx) : adx < want - 0.7 ? -sign(dx) * 0.5 : 0;
    return;
  }
  if (!targetOpen(t)) {
    ai.mz = adz > 0.4 ? sign(dz) * 0.5 : 0;
    return;
  }
  const aligned = adz < 0.45;
  let move: string | null = null;
  if (adx >= D.chargeMinDistance) {
    if (aligned && onScreen(w, f, 1.2)) move = def.moves.charge!;
    else {
      // Line up for the charge.
      ai.mz = sign(dz);
      ai.mx = adx > 7 ? sign(dx) * 0.6 : 0;
      return;
    }
  } else if (adx <= D.slamRange && adz < 1.0) {
    move = b.step++ % 2 === 0 ? def.moves.slam! : def.moves.sweep!;
  } else if (adx <= D.sweepRange && adz < 0.9) {
    move = def.moves.sweep!;
  } else if (chance(w, 0.4)) {
    move = def.moves.slam!;
  } else {
    ai.mx = sign(dx);
    ai.mz = adz > 0.2 ? sign(dz) * 0.8 : 0;
    return;
  }
  ai.wantMove = move;
  b.idle = randInt(w, D.idleFrames[0], D.idleFrames[1]);
}

function finalBoss(w: World, f: Fighter, t: Fighter): void {
  const ai = f.ai!;
  const b = f.boss!;
  const D = FINALBOSS;
  const P = b.phase === 1 ? D.phase1 : D.phase2;
  const dx = t.x - f.x;
  const dz = t.z - f.z;
  const adx = Math.abs(dx);
  const adz = Math.abs(dz);
  face(f, dx);
  ai.speedMul = P.speedMul;

  if (b.phase === 1 && f.hp <= f.maxHp * D.phase2At) {
    b.phase = 2;
    b.reinforceTimer = 0;
    ai.wantMove = 'fb_power';
    b.idle = 30;
    w.events.push({ type: 'bossPhase', id: f.id, phase: 2 });
    return;
  }
  if (b.hitsSinceAction >= D.breakAfterHits && adx < 2.2 && adz < 0.8) {
    ai.wantMove = P.counter;
    b.hitsSinceAction = 0;
    return;
  }
  if (b.idle > 0) {
    b.idle--;
    const want = 2.3;
    ai.mz = adz > 0.2 ? sign(dz) * 0.9 : 0;
    ai.mx = adx > want + 0.5 ? sign(dx) : adx < want - 0.9 ? -sign(dx) * 0.8 : 0;
    if (adx < 1.2 && adz < 0.5 && chance(w, P.backstepChance * 0.06)) ai.wantMove = 'fb_backstep';
    return;
  }
  if (!targetOpen(t)) {
    ai.mz = adz > 0.3 ? sign(dz) * 0.6 : 0;
    ai.mx = adx < 2 ? -sign(dx) * 0.5 : 0;
    return;
  }
  if (P.dash && adx >= 3 && adx <= 9.5 && adz < 0.35 && onScreen(w, f, 1.0) && chance(w, P.dashChance)) {
    ai.wantMove = P.dash;
    if (chance(w, P.doubleDashChance)) ai.followUp = P.dash;
  } else if (adx >= 3 && chance(w, P.leapChance)) {
    ai.aimX = t.x;
    ai.aimZ = t.z;
    ai.wantMove = P.leap;
  } else if (adx <= 1.6 && adz < 0.3) {
    ai.wantMove = P.combo;
    ai.wantChain = true;
  } else {
    ai.mx = sign(dx);
    ai.mz = adz > 0.15 ? sign(dz) : 0;
    return;
  }
  b.idle = randInt(w, P.idleFrames[0], P.idleFrames[1]);
}
