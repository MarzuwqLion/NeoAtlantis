/**
 * Fighter creation and small state helpers shared by players, enemies and
 * bosses. No behaviour lives here: see actions.ts for the state machine.
 */
import type { Fighter, FighterKind, FighterState, Team, World, AIState, BossState } from './types';
import { getFighterDef } from '../data/fighters';
import { getMove } from '../data/moves';
import { WEAPONS } from '../data/weapons';
import { COMBAT, PHYSICS } from '../data/tuning';
import { randInt, randRange, pickSign } from './rng';

export function createFighter(w: World, defId: string, kind: FighterKind, team: Team, x: number, z: number, player = -1): Fighter {
  const def = getFighterDef(defId);
  const f: Fighter = {
    id: w.nextId++,
    kind,
    def: defId,
    team,
    player,
    x,
    y: 0,
    z,
    px: x,
    py: 0,
    pz: z,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: team === 0 ? 1 : -1,
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    stateFrame: 0,
    stateLen: 0,
    hitType: 'light',
    move: null,
    hitstop: 0,
    invuln: 0,
    flash: 0,
    telegraph: false,
    airAttackUsed: false,
    jumpDir: 0,
    bounces: 0,
    dying: false,
    weapon: def.weapon ?? null,
    weaponDurability: def.weapon ? WEAPONS[def.weapon].durability : 0,
    anim: 'idle',
    animFrame: 0,
    pAnimFrame: 0,
    animMove: null,
    animLen: 0,
    ai: null,
    boss: null,
    removeMe: false,
    age: 0,
    stepped: false,
    lastAttacker: -1,
    landLen: 0,
    encounter: -1,
  };
  w.fighters.push(f);
  return f;
}

export function createAI(w: World, f: Fighter): AIState {
  const def = getFighterDef(f.def);
  const ai = def.ai;
  const circle = ai ? ai.circle : ([3, 4] as [number, number]);
  return {
    mode: 'enter',
    timer: randInt(w, 30, 90),
    targetId: -1,
    hasToken: false,
    tokenFrames: 0,
    cooldown: randInt(w, 30, 80),
    retry: randInt(w, 10, 40),
    side: pickSign(w),
    circleDist: randRange(w, circle[0], circle[1]),
    zOffset: randRange(w, -1.2, 1.2),
    enterX: f.x,
    enterZ: f.z,
    mx: 0,
    mz: 0,
    speedMul: 1,
    wantMove: null,
    wantChain: false,
    followUp: null,
    reaction: 0,
    aimX: f.x,
    aimZ: f.z,
    attacked: false,
  };
}

export function createBossState(): BossState {
  return {
    phase: 1,
    summoned: false,
    step: 0,
    idle: 40,
    hitsSinceAction: 0,
    reinforceTimer: 0,
    reinforcements: 0,
    phaseChanging: false,
    dashCount: 0,
  };
}

export function findFighter(w: World, id: number): Fighter | undefined {
  for (const f of w.fighters) if (f.id === id) return f;
  return undefined;
}

/** Switch clip. The frame counter restarts when the clip (or move) changes, or when forced. */
export function setAnim(f: Fighter, name: string, move: string | null = null, len = 0, restart = false): void {
  if (restart || f.anim !== name || f.animMove !== move) {
    f.anim = name;
    f.animFrame = 0;
    f.pAnimFrame = 0;
    f.animMove = move;
  }
  f.animLen = len;
}

export function setState(f: Fighter, state: FighterState, len = 0): void {
  f.state = state;
  f.stateFrame = 0;
  f.stateLen = len;
  if (state !== 'attack') {
    f.move = null;
    f.telegraph = false;
  }
}

export function toIdle(f: Fighter): void {
  setState(f, 'idle');
  setAnim(f, 'idle');
  f.vx = 0;
  f.vz = 0;
}

export function hurtHeight(f: Fighter): number {
  const def = getFighterDef(f.def);
  if (f.move) {
    const md = getMove(f.move.id);
    if (md.hurtbox) return md.hurtbox.height;
  }
  return def.hurt.height;
}

export function isAlive(f: Fighter): boolean {
  return !f.dying && f.state !== 'dead' && f.hp > 0;
}

/** True when the fighter can currently be struck. */
export function isHittable(f: Fighter): boolean {
  if (f.dying || f.hp <= 0) return false;
  switch (f.state) {
    case 'launched':
    case 'lying':
    case 'getup':
    case 'dead':
    case 'intro':
    case 'respawn':
    case 'victory':
      return false;
    default:
      break;
  }
  if (f.invuln > 0) return false;
  if (f.move) {
    const md = getMove(f.move.id);
    if (md.invuln && f.move.frame >= md.invuln.from && f.move.frame < md.invuln.to) return false;
  }
  return true;
}

/** Can act on its own (walk, start moves). */
export function isFree(f: Fighter): boolean {
  return f.state === 'idle' || f.state === 'walk' || f.state === 'run';
}

export function armorLevel(f: Fighter): 'none' | 'light' | 'full' {
  if (!f.move || f.state !== 'attack') return 'none';
  const md = getMove(f.move.id);
  if (md.armor && f.move.frame >= md.armor.from && f.move.frame < md.armor.to) return md.armor.level;
  return 'none';
}

export function releaseToken(w: World, f: Fighter): void {
  const ai = f.ai;
  if (!ai) return;
  if (ai.hasToken) {
    ai.hasToken = false;
    ai.tokenFrames = 0;
    const def = getFighterDef(f.def);
    const cd = def.ai ? def.ai.tokenCooldown : ([60, 120] as [number, number]);
    ai.cooldown = randInt(w, cd[0], cd[1]);
  }
  ai.attacked = false;
}

/** Airtime (frames) of a ballistic arc starting at height y with vertical speed vy. */
export function airtime(vy: number, gravity: number, y = 0): number {
  // Solve y + vy t - g t^2 / 2 = 0 for the positive root.
  const disc = vy * vy + 2 * gravity * y;
  return Math.max(1, Math.round((vy + Math.sqrt(disc)) / gravity));
}

export function launchAirtime(vy: number): number {
  return airtime(vy, PHYSICS.launchGravity);
}

export function getupInvuln(f: Fighter): number {
  return f.player >= 0 ? COMBAT.getupInvuln.player : COMBAT.getupInvuln.enemy;
}
