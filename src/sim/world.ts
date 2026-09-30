/**
 * World creation and the fixed-step simulation entry point.
 *
 *   step(world, inputs)  — advance exactly one 60 Hz frame.
 *
 * inputs[i] is the InputState of player slot i. There is no global "the
 * player": every player is a slot + fighter pair, which is what makes local
 * co-op and rollback / lockstep netcode possible later.
 */
import type { InputState, World } from './types';
import { getFighterDef } from '../data/fighters';
import { getEnv } from '../data/level';
import { LIVES, PLAYER_DEF_ID } from '../data/tuning';
import { createFighter } from './fighter';
import { createPlayerSlot, recordInput, playerControl, ageBuffers } from './player';
import { aiThink, applyIntent } from './ai';
import { advanceCounters, clampFighters, resolveStateEnd, separate, updatePhysics } from './actions';
import { resolveCombat } from './combat';
import { updateProjectiles } from './projectiles';
import { updateItems } from './items';
import { effectiveInput, jumpToEncounter, loadEnvironment, updateCamera, updateDirector } from './director';
import { VIEW_HALF_WIDTH } from './view';

export interface WorldOptions {
  env?: number;
  players?: number;
  seed?: number;
  /** Carry score / continues over (used by "continue"). */
  carry?: { score: number; continues: number; damageTaken: number; enemiesDefeated: number; maxCombo: number; frames: number }[];
  /** Start right before this encounter of the environment (debug / tests). */
  encounter?: number;
  /** Skip the walk-in transition. */
  skipIntro?: boolean;
}

export function createWorld(opts: WorldOptions = {}): World {
  const w: World = {
    frame: 0,
    rng: (opts.seed ?? 0x1a7a) | 0,
    nextId: 1,
    fighters: [],
    items: [],
    projectiles: [],
    players: [],
    camera: { x: VIEW_HALF_WIDTH, px: VIEW_HALF_WIDTH, lockX: null },
    level: {
      env: 0,
      nextEncounter: 0,
      active: null,
      goTimer: 0,
      titleTimer: 0,
      transition: null,
      tramSpeed: 0,
      tramTarget: 0,
      bossId: -1,
      cutscene: null,
      exitOpen: false,
      complete: false,
      completeTimer: 0,
      bossDefeated: false,
    },
    events: [],
    slowmo: 0,
    gameOver: false,
    debug: { god: false, noAI: false },
  };
  const count = Math.max(1, opts.players ?? 1);
  const pdef = getFighterDef(PLAYER_DEF_ID);
  for (let i = 0; i < count; i++) {
    const f = createFighter(w, PLAYER_DEF_ID, 'player', 0, 0, 0, i);
    const slot = createPlayerSlot(i, f.id, count > 1 ? `${pdef.name} ${i + 1}` : pdef.name, LIVES.start);
    const c = opts.carry?.[i];
    if (c) {
      slot.score = c.score;
      slot.continues = c.continues;
      slot.damageTaken = c.damageTaken;
      slot.enemiesDefeated = c.enemiesDefeated;
      slot.maxCombo = c.maxCombo;
      slot.frames = c.frames;
    }
    w.players.push(slot);
  }
  const env = opts.env ?? 0;
  getEnv(env);
  loadEnvironment(w, env, !opts.skipIntro && opts.encounter === undefined);
  if (opts.encounter !== undefined) jumpToEncounter(w, opts.encounter);
  return w;
}

/** Advance the simulation by one fixed 60 Hz frame. */
export function step(w: World, inputs: readonly (InputState | undefined)[]): void {
  w.events.length = 0;
  w.frame++;
  if (w.slowmo > 0) w.slowmo--;
  for (const f of w.fighters) {
    f.px = f.x;
    f.py = f.y;
    f.pz = f.z;
    f.pAnimFrame = f.animFrame;
  }
  w.camera.px = w.camera.x;
  if (!w.level.complete && !w.gameOver) for (const s of w.players) s.frames++;

  updateDirector(w);

  const effective: InputState[] = [];
  for (const slot of w.players) {
    const input = effectiveInput(w, slot, inputs[slot.index]);
    effective[slot.index] = input;
    recordInput(w, slot, input);
  }

  // Pass 1: timers, decisions, movement.
  for (let i = 0; i < w.fighters.length; i++) {
    const f = w.fighters[i]!;
    f.stepped = false;
    if (f.flash > 0) f.flash--;
    if (f.removeMe) continue;
    if (f.hitstop > 0) {
      f.hitstop--;
      continue;
    }
    f.stepped = true;
    resolveStateEnd(w, f);
    if (f.player >= 0) {
      const slot = w.players[f.player];
      const input = effective[f.player];
      if (slot && input) playerControl(w, slot, f, input);
    } else if (f.ai) {
      aiThink(w, f);
      applyIntent(w, f);
    }
    updatePhysics(w, f);
  }
  clampFighters(w);

  // Pass 2: hits (collected first, then applied, so trades resolve).
  resolveCombat(w);
  updateProjectiles(w);
  updateItems(w);
  separate(w);

  // Pass 3: frame counters.
  for (const f of w.fighters) {
    if (f.stepped) {
      advanceCounters(f);
      if (f.player >= 0) {
        const slot = w.players[f.player];
        if (slot) ageBuffers(slot);
      }
    }
    f.age++;
  }

  updateCamera(w);
  compact(w);
}

function compact(w: World): void {
  let n = 0;
  for (const f of w.fighters) if (!f.removeMe) w.fighters[n++] = f;
  w.fighters.length = n;
  n = 0;
  for (const it of w.items) if (!it.removeMe) w.items[n++] = it;
  w.items.length = n;
  n = 0;
  for (const p of w.projectiles) if (!p.removeMe) w.projectiles[n++] = p;
  w.projectiles.length = n;
}

/** Snapshot of the stats shown on the level-clear screen and carried over by "continue". */
export function carryOver(w: World): NonNullable<WorldOptions['carry']> {
  return w.players.map((s) => ({
    score: s.score,
    continues: s.continues,
    damageTaken: s.damageTaken,
    enemiesDefeated: s.enemiesDefeated,
    maxCombo: s.maxCombo,
    frames: s.frames,
  }));
}
