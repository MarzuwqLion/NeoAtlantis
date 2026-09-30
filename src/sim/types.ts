/**
 * Core simulation types. Everything in the World is plain, serialisable data:
 * no classes, no Maps, no references to rendering objects. The simulation is
 * advanced exclusively by step(world, inputs) and the renderer only reads it.
 *
 * Belt space: x = scroll direction (right is +), y = height (up is +),
 * z = depth lane (+ is toward the camera / down the screen).
 */

export type Facing = 1 | -1;
export type HitType = 'light' | 'heavy' | 'knockdown';
export type SparkKind = 'punch' | 'kick' | 'blade' | 'blunt' | 'shatter' | 'energy';
export type WeaponType = 'khopesh' | 'staff' | 'jar';
export type Team = 0 | 1;
export type FighterKind = 'player' | 'enemy' | 'boss';
export type ProjectileKind = 'jar' | 'lobJar' | 'shockwave';
export type SpawnFrom = 'left' | 'right' | 'door' | 'drop' | 'leap';

/** Per-player, per-frame input. Digital 8-way direction plus buttons. */
export interface InputState {
  x: -1 | 0 | 1;
  /** -1 = up the screen (away from camera), +1 = down the screen (toward camera). */
  z: -1 | 0 | 1;
  attack: boolean;
  jump: boolean;
  run: boolean;
}

export const NEUTRAL_INPUT: Readonly<InputState> = Object.freeze({ x: 0, z: 0, attack: false, jump: false, run: false });

export type FighterState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'jumpSquat'
  | 'air'
  | 'land'
  | 'hitstun'
  | 'launched'
  | 'lying'
  | 'getup'
  | 'dead'
  | 'enter'
  | 'intro'
  | 'respawn'
  | 'victory';

export interface MoveState {
  id: string;
  /** Frame of the move currently being executed (0-based). */
  frame: number;
  /** Encoded hit-def index * 100000 + target id, so each hit window hits a target once. */
  hitIds: number[];
  connected: boolean;
  /** Frames spent holding the active phase of a charge move. */
  chargeFrames: number;
  chargeDone: boolean;
  aimX: number;
  aimZ: number;
  /** Item id for pickups, -1 otherwise. */
  item: number;
  /** Last move frame whose one-shot effects (projectile, jump, sfx) were processed. */
  evFrame: number;
}

export type AIMode = 'enter' | 'think' | 'approach' | 'circle' | 'backoff' | 'flee' | 'wait';

export interface AIState {
  mode: AIMode;
  timer: number;
  targetId: number;
  hasToken: boolean;
  tokenFrames: number;
  cooldown: number;
  retry: number;
  side: Facing;
  circleDist: number;
  zOffset: number;
  enterX: number;
  enterZ: number;
  /** Movement intent in [-1, 1] (fraction of walk speed), consumed by the fighter update. */
  mx: number;
  mz: number;
  speedMul: number;
  /** Move the brain wants to start this frame. */
  wantMove: string | null;
  /** Brain wants to continue the current move's chain. */
  wantChain: boolean;
  /** Queued follow-up move (e.g. retreat after a dash). */
  followUp: string | null;
  reaction: number;
  /** Aim point for leaps and lobs. */
  aimX: number;
  aimZ: number;
  /** Started an attack while holding the token (token is returned once it ends). */
  attacked: boolean;
}

export interface BossState {
  phase: 1 | 2;
  summoned: boolean;
  step: number;
  idle: number;
  hitsSinceAction: number;
  reinforceTimer: number;
  reinforcements: number;
  phaseChanging: boolean;
  dashCount: number;
}

export interface Fighter {
  id: number;
  kind: FighterKind;
  /** Fighter definition id (data/fighters.ts). */
  def: string;
  team: Team;
  /** Player slot index, or -1 for AI fighters. */
  player: number;
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  state: FighterState;
  stateFrame: number;
  stateLen: number;
  /** Type of the last hit received (drives hit reaction clip). */
  hitType: HitType;
  move: MoveState | null;
  hitstop: number;
  invuln: number;
  flash: number;
  telegraph: boolean;
  airAttackUsed: boolean;
  /** 1 when the current jump was directional (flying kick), 0 for neutral. */
  jumpDir: number;
  bounces: number;
  dying: boolean;
  weapon: WeaponType | null;
  weaponDurability: number;
  /** Logical animation clip name plus the frame it has been playing for. */
  anim: string;
  animFrame: number;
  /** animFrame before the last step (render interpolation, like px/py/pz). */
  pAnimFrame: number;
  /** Move id when the clip is a move clip (renderer maps keys onto its phases). */
  animMove: string | null;
  /** Expected duration in frames for normalised clips (0 = free running). */
  animLen: number;
  ai: AIState | null;
  boss: BossState | null;
  removeMe: boolean;
  /** Frames since the entity was created (used for fade in / blinking). */
  age: number;
  /** Stepped this frame (not frozen by hitstop). Internal bookkeeping. */
  stepped: boolean;
  lastAttacker: number;
  /** Frames of invulnerability-knockdown pulse remaining after a respawn landing. */
  landLen: number;
  /** Spawned by encounter index (or -1). */
  encounter: number;
}

export interface PlayerSlot {
  index: number;
  fighterId: number;
  name: string;
  lives: number;
  score: number;
  prevInput: InputState;
  /** Frames since the buffered press (-1 = nothing buffered). Ages only while not in hitstop. */
  bufAttack: number;
  bufJump: number;
  tapDir: number;
  tapFrame: number;
  runLatched: boolean;
  lastTargetId: number;
  lastTargetTimer: number;
  damageTaken: number;
  enemiesDefeated: number;
  comboCount: number;
  comboTimer: number;
  maxCombo: number;
  continues: number;
  /** Frames played in total (carried over by continues). */
  frames: number;
}

export interface Item {
  id: number;
  type: WeaponType;
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  durability: number;
  age: number;
  /** Frames until the item disappears (-1 = never). */
  lifetime: number;
  removeMe: boolean;
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  owner: number;
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  /** Expanding ring radius (shockwave). */
  radius: number;
  /** Predicted landing point (lobbed projectiles, shown as a ground marker). */
  targetX: number;
  targetZ: number;
  hitIds: number[];
  removeMe: boolean;
}

export interface CameraState {
  x: number;
  px: number;
  lockX: number | null;
}

export interface SpawnQueueEntry {
  wave: number;
  spawn: number;
  at: number;
  /** Direct spawn (boss reinforcements) instead of a wave entry. */
  direct: { type: string; from: SpawnFrom; z: number; x: number; weapon: WeaponType | null } | null;
}

export interface ActiveEncounter {
  index: number;
  wave: number;
  queue: SpawnQueueEntry[];
  ids: number[];
  waveQueuedAt: number;
  clearing: boolean;
}

export interface TransitionState {
  phase: 'exit' | 'fade' | 'enter';
  frame: number;
}

export interface CutsceneState {
  kind: 'bossIntro';
  frame: number;
  len: number;
  bossId: number;
}

export interface LevelState {
  env: number;
  nextEncounter: number;
  active: ActiveEncounter | null;
  goTimer: number;
  titleTimer: number;
  transition: TransitionState | null;
  tramSpeed: number;
  tramTarget: number;
  bossId: number;
  cutscene: CutsceneState | null;
  exitOpen: boolean;
  complete: boolean;
  completeTimer: number;
  bossDefeated: boolean;
}

export interface World {
  frame: number;
  rng: number;
  nextId: number;
  fighters: Fighter[];
  items: Item[];
  projectiles: Projectile[];
  players: PlayerSlot[];
  camera: CameraState;
  level: LevelState;
  events: SimEvent[];
  /** Sim frames of slow motion remaining (the app loop steps the sim more slowly while > 0). */
  slowmo: number;
  gameOver: boolean;
  debug: { god: boolean; noAI: boolean };
}

export type SimEvent =
  | { type: 'hit'; attacker: number; target: number; x: number; y: number; z: number; hitType: HitType; spark: SparkKind; damage: number; blocked: boolean }
  | { type: 'whiff'; id: number; heavy: boolean }
  | { type: 'sfx'; name: string; x: number }
  | { type: 'jump'; id: number }
  | { type: 'land'; id: number; heavy: boolean }
  | { type: 'bounce'; id: number; x: number; z: number }
  | { type: 'death'; id: number; kind: FighterKind }
  | { type: 'spawn'; id: number; from: string }
  | { type: 'weaponPickup'; id: number; weapon: WeaponType }
  | { type: 'weaponBreak'; id: number; weapon: WeaponType; x: number; y: number; z: number }
  | { type: 'weaponDrop'; id: number; weapon: WeaponType }
  | { type: 'throw'; id: number }
  | { type: 'shatter'; x: number; y: number; z: number }
  | { type: 'shockwave'; x: number; z: number; big: boolean }
  | { type: 'telegraph'; id: number; move: string }
  | { type: 'encounterStart'; index: number }
  | { type: 'encounterClear'; index: number }
  | { type: 'bossIntro'; id: number; def: string }
  | { type: 'bossPhase'; id: number; phase: number }
  | { type: 'bossDefeated'; id: number; def: string }
  | { type: 'playerDeath'; player: number }
  | { type: 'respawn'; player: number; x: number; z: number }
  | { type: 'gameOver' }
  | { type: 'levelClear' }
  | { type: 'envEnter'; env: number }
  | { type: 'rumble'; player: number; strong: number; weak: number; ms: number }
  | { type: 'shake'; amount: number; frames: number }
  | { type: 'go' };
