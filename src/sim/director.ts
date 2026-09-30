/**
 * Level director: encounter triggers, camera locks, wave spawning, boss
 * intros, the tram, environment transitions and level completion. Also owns
 * the belt camera (follows the lead player, never scrolls backward).
 */
import type { Fighter, InputState, PlayerSlot, World } from './types';
import { NEUTRAL_INPUT } from './types';
import { ENVIRONMENTS, getEnv } from '../data/level';
import { MIDBOSS, FINALBOSS } from '../data/bosses';
import { CAMERA, SCORE, TRANSITION } from '../data/tuning';
import { findFighter, isAlive, setAnim, setState, toIdle } from './fighter';
import { spawnItem } from './items';
import { laneZ, spawnBoss, spawnEnemy, spawnFromDef } from './spawn';
import { approach, clamp, VIEW_HALF_WIDTH } from './view';

const RIGHT: InputState = Object.freeze({ x: 1, z: 0, attack: false, jump: false, run: false });

function players(w: World): Fighter[] {
  const out: Fighter[] = [];
  for (const s of w.players) {
    const f = findFighter(w, s.fighterId);
    if (f) out.push(f);
  }
  return out;
}

export function leadX(w: World): number {
  let x = -Infinity;
  for (const f of players(w)) if (f.state !== 'dead') x = Math.max(x, f.x);
  return x === -Infinity ? w.camera.x : x;
}

export function rearX(w: World): number {
  let x = Infinity;
  for (const f of players(w)) if (f.state !== 'dead') x = Math.min(x, f.x);
  return x === Infinity ? w.camera.x : x;
}

export function isFinalEnv(w: World): boolean {
  return w.level.env >= ENVIRONMENTS.length - 1;
}

/** Reset level state for an environment and place the players at its start. */
export function loadEnvironment(w: World, envIndex: number, walkIn: boolean): void {
  const env = getEnv(envIndex);
  const L = w.level;
  const firstLoad = w.frame === 0;
  L.env = envIndex;
  L.nextEncounter = 0;
  L.active = null;
  L.goTimer = 0;
  L.exitOpen = false;
  L.tramSpeed = 0;
  L.tramTarget = 0;
  L.bossId = -1;
  L.cutscene = null;
  L.bossDefeated = false;
  L.completeTimer = 0;
  w.fighters = w.fighters.filter((f) => f.team === 0);
  w.items = [];
  w.projectiles = [];
  for (const it of env.items) spawnItem(w, it.type, it.x, laneZ(w, it.z));
  w.camera.x = VIEW_HALF_WIDTH;
  w.camera.px = w.camera.x;
  w.camera.lockX = null;
  let i = 0;
  for (const f of players(w)) {
    f.x = walkIn ? -1.4 - i * 1.1 : env.startX - i * 0.8;
    f.z = laneZ(w, i === 0 ? 0.1 : -0.5);
    f.y = 0;
    f.vx = f.vy = f.vz = 0;
    f.px = f.x;
    f.py = 0;
    f.pz = f.z;
    f.dying = false;
    f.hitstop = 0;
    f.weapon = null;
    f.weaponDurability = 0;
    if (!firstLoad) f.hp = Math.min(f.maxHp, Math.max(f.hp, 1) + Math.round(f.maxHp * env.healOnEnter));
    f.facing = 1;
    toIdle(f);
    i++;
  }
  if (walkIn) {
    L.transition = { phase: 'enter', frame: 0 };
    L.titleTimer = TRANSITION.titleFrames;
  } else {
    L.transition = null;
    L.titleTimer = 0;
  }
}

/** Debug / test helper: skip straight to an encounter of the current environment. */
export function jumpToEncounter(w: World, index: number): void {
  const env = getEnv(w.level.env);
  const L = w.level;
  const enc = env.encounters[index];
  if (!enc) return;
  L.transition = null;
  L.titleTimer = 0;
  L.nextEncounter = index;
  const x = enc.trigger - 2.5;
  w.camera.x = clamp(x + CAMERA.follow, VIEW_HALF_WIDTH, env.length - VIEW_HALF_WIDTH);
  w.camera.px = w.camera.x;
  let i = 0;
  for (const f of players(w)) {
    f.x = x - i * 0.8;
    f.px = f.x;
    i++;
  }
}

function queueWave(w: World, waveIndex: number): void {
  const A = w.level.active!;
  const def = getEnv(w.level.env).encounters[A.index]!;
  const wave = def.waves[waveIndex];
  A.wave = waveIndex;
  A.waveQueuedAt = w.frame;
  if (!wave) return;
  wave.spawns.forEach((s, i) => {
    A.queue.push({ wave: waveIndex, spawn: i, at: w.frame + wave.delay + (s.delay ?? 0), direct: null });
  });
}

function startEncounter(w: World, index: number): void {
  const L = w.level;
  const env = getEnv(L.env);
  const def = env.encounters[index]!;
  L.nextEncounter = index + 1;
  L.active = { index, wave: -1, queue: [], ids: [], waveQueuedAt: w.frame, clearing: false };
  L.goTimer = 0;
  w.camera.lockX = Math.max(def.lockX, w.camera.x);
  if (def.tram) L.tramTarget = 1;
  w.events.push({ type: 'encounterStart', index });
  if (def.boss) {
    const boss = spawnBoss(w, def.boss, def.lockX + (def.bossX ?? 3.5), 0, index);
    L.active.ids.push(boss.id);
    L.bossId = boss.id;
    const len = def.boss === 'sobekhan' ? MIDBOSS.introFrames : FINALBOSS.introFrames;
    L.cutscene = { kind: 'bossIntro', frame: 0, len, bossId: boss.id };
    w.events.push({ type: 'bossIntro', id: boss.id, def: def.boss });
  } else {
    queueWave(w, 0);
  }
}

/** Enemies of the encounter that haven't finished falling (dying ones still count). */
function standingCount(w: World, ids: number[]): number {
  let n = 0;
  for (const id of ids) {
    const f = findFighter(w, id);
    if (f && !f.removeMe && f.state !== 'dead') n++;
  }
  return n;
}

function aliveCount(w: World, ids: number[]): number {
  let n = 0;
  for (const id of ids) {
    const f = findFighter(w, id);
    if (f && !f.removeMe && isAlive(f)) n++;
  }
  return n;
}

function finishEncounter(w: World): void {
  const L = w.level;
  const A = L.active!;
  w.camera.lockX = null;
  L.active = null;
  w.events.push({ type: 'encounterClear', index: A.index });
  const env = getEnv(L.env);
  const def = env.encounters[A.index]!;
  if (def.boss && isFinalEnv(w)) {
    L.completeTimer = 1;
    return;
  }
  L.goTimer = TRANSITION.goFrames;
  w.events.push({ type: 'go' });
}

function updateEncounter(w: World): void {
  const L = w.level;
  const A = L.active!;
  const def = getEnv(L.env).encounters[A.index]!;

  if (A.queue.length > 0) {
    const due = A.queue.filter((e) => w.frame >= e.at);
    if (due.length > 0) {
      A.queue = A.queue.filter((e) => w.frame < e.at);
      for (const e of due) {
        let f: Fighter;
        if (e.direct) {
          const d = e.direct;
          f = spawnEnemy(w, d.type, d.from, d.z, d.x, w.camera.x, d.weapon ?? undefined, A.index);
        } else {
          const s = def.waves[e.wave]!.spawns[e.spawn]!;
          f = spawnFromDef(w, s, def.lockX, A.index);
        }
        A.ids.push(f.id);
      }
    }
  }

  if (A.clearing) {
    if (L.tramSpeed <= 0.01) finishEncounter(w);
    return;
  }

  const alive = aliveCount(w, A.ids);
  const next = A.wave + 1;
  if (!def.boss && next < def.waves.length && A.queue.length === 0 && alive <= def.waves[next]!.whenRemaining) {
    queueWave(w, next);
    return;
  }
  const allWaves = def.boss ? L.bossDefeated : A.wave >= def.waves.length - 1;
  if (allWaves && A.queue.length === 0 && alive === 0 && standingCount(w, A.ids) === 0) {
    if (def.tram) {
      L.tramTarget = 0;
      A.clearing = true;
    } else {
      finishEncounter(w);
    }
  }
}

function updateCutscene(w: World): void {
  const L = w.level;
  const c = L.cutscene!;
  c.frame++;
  const boss = findFighter(w, c.bossId);
  for (const f of players(w)) {
    if (boss && f.state === 'idle') f.facing = boss.x >= f.x ? 1 : -1;
  }
  if (c.frame >= c.len) {
    if (boss && boss.state === 'intro') {
      toIdle(boss);
      if (boss.boss) boss.boss.idle = 24;
    }
    L.cutscene = null;
  }
}

function startTransition(w: World): void {
  w.level.transition = { phase: 'exit', frame: 0 };
  w.level.goTimer = 0;
}

function updateTransition(w: World): void {
  const L = w.level;
  const T = L.transition!;
  T.frame++;
  if (T.phase === 'exit' && T.frame >= TRANSITION.exitFrames) {
    T.phase = 'fade';
    T.frame = 0;
  } else if (T.phase === 'fade' && T.frame >= TRANSITION.fadeFrames) {
    loadEnvironment(w, L.env + 1, true);
    w.events.push({ type: 'envEnter', env: L.env });
  } else if (T.phase === 'enter' && T.frame >= TRANSITION.enterFrames) {
    L.transition = null;
  }
}

/** Inputs are overridden during transitions, cutscenes and after the level ends. */
export function effectiveInput(w: World, slot: PlayerSlot, input: InputState | undefined): InputState {
  const L = w.level;
  if (L.complete || w.gameOver) return NEUTRAL_INPUT;
  const T = L.transition;
  if (T) {
    if (T.phase === 'exit' || T.phase === 'fade') return RIGHT;
    const f = findFighter(w, slot.fighterId);
    const env = getEnv(L.env);
    if (f && f.x < env.startX - slot.index * 0.8) return RIGHT;
    return NEUTRAL_INPUT;
  }
  if (L.cutscene) return NEUTRAL_INPUT;
  return input ?? NEUTRAL_INPUT;
}

export function updateDirector(w: World): void {
  const L = w.level;
  const env = getEnv(L.env);
  if (L.goTimer > 0) L.goTimer--;
  if (L.titleTimer > 0) L.titleTimer--;
  L.tramSpeed = approach(L.tramSpeed, L.tramTarget, 1 / 150);

  if (L.transition) {
    updateTransition(w);
    return;
  }
  if (L.cutscene) updateCutscene(w);

  if (!L.active && L.nextEncounter < env.encounters.length && L.completeTimer === 0) {
    const def = env.encounters[L.nextEncounter]!;
    if (leadX(w) >= def.trigger) startEncounter(w, L.nextEncounter);
  }
  if (L.active) updateEncounter(w);

  if (!L.active && L.nextEncounter >= env.encounters.length) {
    if (isFinalEnv(w)) {
      if (L.completeTimer > 0 && !L.complete) {
        L.completeTimer++;
        if (L.completeTimer >= TRANSITION.completeDelay) {
          L.complete = true;
          for (const s of w.players) s.score += SCORE.clearBonus;
          for (const f of players(w)) {
            if (f.state !== 'dead') {
              setState(f, 'victory');
              setAnim(f, 'victory', null, 0, true);
              f.vx = f.vz = 0;
            }
          }
          w.events.push({ type: 'levelClear' });
        }
      }
    } else {
      L.exitOpen = true;
      if (leadX(w) >= env.length - 2.2) startTransition(w);
    }
  }
}

export function updateCamera(w: World): void {
  const cam = w.camera;
  const L = w.level;
  const env = getEnv(L.env);
  if (L.transition && L.transition.phase !== 'enter') return;
  const minX = VIEW_HALF_WIDTH;
  const maxX = env.length - VIEW_HALF_WIDTH;
  let target: number;
  if (cam.lockX !== null) {
    target = cam.lockX;
  } else {
    target = Math.max(cam.x, leadX(w) + CAMERA.follow);
    // Co-op: never leave the rear player behind the left edge.
    target = Math.min(target, Math.max(cam.x, rearX(w) + VIEW_HALF_WIDTH - 1.2));
  }
  target = clamp(target, minX, maxX);
  const speed = cam.lockX !== null ? CAMERA.lockSpeed : CAMERA.maxSpeed;
  let dx = clamp(target - cam.x, -speed, speed);
  if (cam.lockX === null && dx < 0) dx = 0;
  cam.x += dx;
}
