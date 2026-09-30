/**
 * Spawning enemies and bosses: from the screen edges, doorways, dropping in
 * from above, or leaping in (acrobats). Also boss reinforcement calls.
 */
import type { Fighter, WeaponType, World } from './types';
import type { SpawnDef, SpawnFrom } from '../data/defs';
import { getFighterDef } from '../data/fighters';
import { getEnv } from '../data/level';
import { WEAPONS } from '../data/weapons';
import { MIDBOSS, FINALBOSS } from '../data/bosses';
import { createAI, createBossState, createFighter, setAnim, setState } from './fighter';
import { startMove } from './actions';
import { randRange, pickSign } from './rng';
import { clamp, viewHalfWidthAt } from './view';

/** Map a normalised lane position (-1 back … +1 front) into the environment band. */
export function laneZ(w: World, zNorm: number): number {
  const env = getEnv(w.level.env);
  const inset = 0.35;
  const t = (clamp(zNorm, -1, 1) + 1) / 2;
  return env.zMin + inset + t * (env.zMax - env.zMin - inset * 2);
}

function nearestDoorX(w: World, x: number): number {
  const env = getEnv(w.level.env);
  let best = x;
  let bestD = Infinity;
  for (const d of env.doors) {
    const dd = Math.abs(d.x - x);
    if (dd < bestD) {
      bestD = dd;
      best = d.x;
    }
  }
  return best;
}

function nearestPlayerX(w: World, x: number): number {
  let best = w.camera.x;
  let bestD = Infinity;
  for (const f of w.fighters) {
    if (f.team !== 0) continue;
    const d = Math.abs(f.x - x);
    if (d < bestD) {
      bestD = d;
      best = f.x;
    }
  }
  return best;
}

export function spawnEnemy(
  w: World,
  type: string,
  from: SpawnFrom,
  zNorm: number,
  xOffset: number,
  anchorX: number,
  weapon?: WeaponType,
  encounter = -1,
): Fighter {
  const def = getFighterDef(type);
  const env = getEnv(w.level.env);
  const cam = w.camera.x;
  let z = laneZ(w, zNorm);
  let x = cam;
  let side: 1 | -1 = 1;
  switch (from) {
    case 'right':
    case 'left':
      side = from === 'right' ? 1 : -1;
      x = cam + side * (viewHalfWidthAt(z) + 1.2);
      break;
    case 'door':
      x = nearestDoorX(w, anchorX + xOffset);
      break;
    case 'drop':
      x = anchorX + xOffset;
      break;
    case 'leap': {
      const px = nearestPlayerX(w, cam);
      side = xOffset !== 0 ? (xOffset > 0 ? 1 : -1) : px < cam ? 1 : -1;
      x = cam + side * (viewHalfWidthAt(z) + 1.0);
      break;
    }
  }
  const f = createFighter(w, type, 'enemy', 1, x, z);
  f.encounter = encounter;
  f.facing = x > cam ? -1 : 1;
  if (weapon) {
    f.weapon = weapon;
    f.weaponDurability = WEAPONS[weapon].durability;
  }
  const ai = createAI(w, f);
  f.ai = ai;
  ai.side = x >= cam ? 1 : -1;

  switch (from) {
    case 'right':
    case 'left': {
      const hw = viewHalfWidthAt(z);
      ai.enterX = cam + side * (hw - 1.4 - randRange(w, 0, 1.4));
      ai.enterZ = z;
      setState(f, 'enter');
      setAnim(f, 'walk');
      break;
    }
    case 'door': {
      // Emerge from the doorway at the back of the lane.
      f.z = env.zMin - 1.3;
      ai.enterX = x + randRange(w, -0.8, 0.8);
      ai.enterZ = env.zMin + 0.4 + randRange(w, 0, 1.0);
      z = f.z;
      setState(f, 'enter');
      setAnim(f, 'walk');
      break;
    }
    case 'drop': {
      f.y = 7.5;
      f.py = f.y;
      f.vy = 0;
      setState(f, 'air');
      setAnim(f, 'fall');
      break;
    }
    case 'leap': {
      const hw = viewHalfWidthAt(z);
      const aimX = cam + side * (hw - 2.2 - randRange(w, 0, 1.2));
      f.facing = side === 1 ? -1 : 1;
      startMove(w, f, def.moves.leapIn ?? 'acro_leap_in', aimX, z);
      break;
    }
  }
  f.pz = f.z;
  w.events.push({ type: 'spawn', id: f.id, from });
  return f;
}

export function spawnFromDef(w: World, s: SpawnDef, anchorX: number, encounter: number): Fighter {
  return spawnEnemy(w, s.type, s.from, s.z, s.x ?? 0, anchorX, s.weapon, encounter);
}

export function spawnBoss(w: World, type: string, x: number, zNorm: number, encounter: number): Fighter {
  const z = laneZ(w, zNorm);
  const f = createFighter(w, type, 'boss', 1, x, z);
  f.encounter = encounter;
  f.facing = -1;
  f.ai = createAI(w, f);
  f.ai.mode = 'think';
  f.boss = createBossState();
  setState(f, 'intro');
  if (type === 'sobekhan') {
    f.y = 8;
    f.py = 8;
  }
  setAnim(f, `${f.def === 'sobekhan' ? 'mb' : 'fb'}_intro`, null, type === 'sobekhan' ? MIDBOSS.introFrames : FINALBOSS.introFrames, true);
  w.events.push({ type: 'spawn', id: f.id, from: 'boss' });
  return f;
}

function registerWithEncounter(w: World, f: Fighter): void {
  const a = w.level.active;
  if (a) {
    a.ids.push(f.id);
    f.encounter = a.index;
  }
}

/** Boss reinforcement call (triggered by the boss's roar / power-up move). */
export function summonFor(w: World, boss: Fighter): void {
  const list = boss.def === 'sobekhan' ? MIDBOSS.summon : boss.def === 'apep' ? FINALBOSS.reinforcements.initial : [];
  for (const s of list) {
    // Summons are staggered by their delay using the queue when possible.
    const a = w.level.active;
    if (a && (s.delay ?? 0) > 0) {
      a.queue.push({
        wave: -1,
        spawn: -1,
        at: w.frame + (s.delay ?? 0),
        direct: { type: s.type, from: s.from, z: s.z, x: s.x ?? 0, weapon: s.weapon ?? null },
      });
      continue;
    }
    const f = spawnFromDef(w, s, w.camera.x, a ? a.index : -1);
    registerWithEncounter(w, f);
  }
  if (boss.boss && boss.def === 'apep') boss.boss.reinforcements += list.length;
}

/** Spawn one reinforcement from a random edge. */
export function spawnReinforcement(w: World, type: string): Fighter {
  const side = pickSign(w);
  const f = spawnEnemy(w, type, side === 1 ? 'right' : 'left', randRange(w, -0.8, 0.8), 0, w.camera.x);
  registerWithEncounter(w, f);
  return f;
}
