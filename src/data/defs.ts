/**
 * Type definitions for every data file. Data files are plain objects checked
 * against these interfaces; the simulation reads them, never mutates them.
 * All times are in 60 Hz frames, all distances in metres (belt space),
 * all speeds in metres per frame.
 */
import type { HitType, SparkKind, WeaponType, ProjectileKind, SpawnFrom } from '../sim/types';

export type { SpawnFrom };

/** Axis-aligned box relative to the fighter's feet, authored facing right (+x = forward). */
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface HitDef {
  /** First active frame (inclusive, relative to move start). Defaults to startup. */
  from?: number;
  /** Last active frame (exclusive). Defaults to startup + active. */
  to?: number;
  box: Box;
  /** Depth tolerance: hit connects if |dz| <= zRange + target.zRadius. */
  zRange?: number;
  damage: number;
  type: HitType;
  /** Stun frames for light/heavy hits (defaults in COMBAT.hitstun). */
  hitstun?: number;
  /** Horizontal push speed applied to light/heavy victims. */
  push?: number;
  /** Knockdown launch speeds. */
  launchX?: number;
  launchY?: number;
  /** Hitstop override (defaults in COMBAT.hitstop by type). */
  hitstop?: number;
  spark?: SparkKind;
  /** Screen shake amount on connect (0..1). */
  shake?: number;
  /** Knockback away from the attacker's centre regardless of facing (slams). */
  radial?: boolean;
  /** Only hits grounded targets. */
  groundOnly?: boolean;
}

export interface MotionSeg {
  from: number;
  to: number;
  /** Velocity along facing direction. */
  vx: number;
  vz?: number;
}

export interface MoveDef {
  /** Logical animation clip. Its keys are placed against startup/active/recovery. */
  clip: string;
  startup: number;
  active: number;
  recovery: number;
  hits: HitDef[];
  /** Combo chain: pressing attack from `from` onward (buffered) continues into `next`. */
  chain?: { next: string; from: number; requireHit: boolean };
  motion?: MotionSeg[];
  /** Friction multiplier on horizontal velocity when no motion segment is active. */
  friction?: number;
  /** Airborne impulse fired at `frame`. toTarget aims the landing at the move's aim point. */
  jump?: { frame: number; vy: number; vx: number; toTarget?: boolean; maxVx?: number };
  /** Hold the last active frame and travel at `speed` until `max` frames or the screen edge. */
  charge?: { speed: number; max: number; stopAtEdge: boolean };
  /** Super armour window: 'light' ignores light hits' stun, 'full' ignores all stun. */
  armor?: { from: number; to: number; level: 'light' | 'full' };
  invuln?: { from: number; to: number };
  /** Airborne move: keeps momentum and gravity; ends early on landing. */
  air?: boolean;
  landRecovery?: number;
  activeUntilLand?: boolean;
  /** Readable telegraph during startup (glow + glint). */
  telegraph?: boolean;
  /** Consumes weapon durability on hit. */
  weapon?: boolean;
  /** Releases the held weapon as a projectile on `frame`. */
  throwWeapon?: { frame: number };
  projectile?: { frame: number; kind: ProjectileKind; x: number; y: number };
  sfx?: { frame: number; name: string }[];
  /** Hurtbox override while this move runs (e.g. low slide). */
  hurtbox?: { height: number };
  /** Screen shake at a specific frame (slams, landings). */
  shakeAt?: { frame: number; amount: number; frames: number };
  /** Summons reinforcements at `frame` (boss roar). */
  summon?: { frame: number };
}

export interface HurtDef {
  halfWidth: number;
  height: number;
  zRadius: number;
}

export type BrainId = 'grunt' | 'bladeRunner' | 'bruiser' | 'thrower' | 'acrobat' | 'midboss' | 'finalboss';

export interface AIDef {
  brain: BrainId;
  /** Flanking distance range (x) while waiting for an attack token. */
  circle: [number, number];
  /** Horizontal distance window in which the primary attack starts. */
  attackRange: [number, number];
  /** Cooldown after releasing a token. */
  tokenCooldown: [number, number];
  /** Frames between token requests. */
  tokenRetry: [number, number];
  /** Probability of requesting a token when allowed. */
  aggression: number;
  approachSpeed: number;
  circleSpeed: number;
  /** z alignment tolerance before attacking (enemies line up on z). */
  alignTolerance: number;
  /** Frames of hesitation after regaining control. */
  reaction: number;
  /** Frames a token may be held without attacking before it's returned. */
  tokenTimeout: number;
}

export interface FighterDef {
  name: string;
  /** Render model id (render/characters). */
  model: string;
  /** Palette variant for the model. */
  palette: string;
  hp: number;
  hurt: HurtDef;
  walk: number;
  walkZ: number;
  run: number;
  /** Knockback divisor. Heavier fighters fly less. */
  weight: number;
  score: number;
  /** Multiplier on received hitstun. */
  hitstunScale: number;
  lyingFrames: number;
  getupFrames: number;
  /** Role → move id. */
  moves: Record<string, string>;
  /** Weapon carried on spawn. */
  weapon?: WeaponType;
  /** Weapon item dropped on death with a probability. */
  dropOnDeath?: { type: WeaponType; chance: number };
  ai?: AIDef;
}

export interface WeaponDef {
  name: string;
  durability: number;
  /** First move of the weapon's attack chain. */
  move: string;
  thrown: boolean;
  /** Frames a dropped (non-placed) item stays before vanishing. */
  groundLifetime: number;
  /** Pickup reach. */
  reach: number;
}

export interface ProjectileDef {
  gravity: number;
  radius: number;
  height: number;
  hit: HitDef;
  /** Damage splash on landing (lobbed jars). */
  splash?: { radius: number; zRange: number; hit: HitDef };
  /** Expanding ground ring (shockwave). */
  ring?: { speed: number; maxRadius: number; thickness: number };
  speedX?: number;
  speedY?: number;
  /** Lobbed: flight frames = clamp(distance * perMeter, min, max). */
  lob?: { perMeter: number; min: number; max: number };
  maxAge: number;
}

export interface SpawnDef {
  type: string;
  from: SpawnFrom;
  /** Normalised lane position: -1 back edge … +1 front edge. */
  z: number;
  /** x offset from the encounter lock point (door / drop spawns). */
  x?: number;
  /** Frames after the wave starts. */
  delay?: number;
  weapon?: WeaponType;
}

export interface WaveDef {
  /** Start when this many (or fewer) enemies of the encounter are still alive. */
  whenRemaining: number;
  /** Frames to wait once the condition is met. */
  delay: number;
  spawns: SpawnDef[];
}

export interface EncounterDef {
  name: string;
  /** Lead player x that triggers the lock. */
  trigger: number;
  /** Camera centre while locked. */
  lockX: number;
  waves: WaveDef[];
  /** Moving tram platform: background scrolls while the encounter is active. */
  tram?: boolean;
  /** Boss fighter def id (spawned with an intro). */
  boss?: string;
  /** Boss spawn x offset from lockX. */
  bossX?: number;
}

export interface PlacedItem {
  type: WeaponType;
  x: number;
  z: number;
}

export interface DoorDef {
  x: number;
}

export interface EnvDef {
  id: 'docks' | 'bazaar' | 'tube' | 'temple';
  name: string;
  stage: string;
  length: number;
  zMin: number;
  zMax: number;
  music: string;
  startX: number;
  /** Fraction of max health restored when the environment starts. */
  healOnEnter: number;
  encounters: EncounterDef[];
  items: PlacedItem[];
  doors: DoorDef[];
}
