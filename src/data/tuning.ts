/**
 * Global tuning: physics, combat defaults, camera geometry, player movement.
 * Frames are 1/60 s. Distances in metres. Speeds in metres per frame.
 */

export const PHYSICS = {
  /** Gravity for jumps. */
  gravity: 0.0085,
  /** Gravity for knockdown launches (slightly heavier so knockdowns snap). */
  launchGravity: 0.0098,
  maxFall: 0.42,
  /** Velocity decay per frame while sliding in hitstun. */
  hitstunFriction: 0.84,
  /** Velocity decay per frame on the ground after moves without motion. */
  groundFriction: 0.72,
  /** Ground bounce on knockdown: vy is reflected and scaled by this. */
  bounceDamping: 0.34,
  bounceMinVy: 0.05,
  bounceVxScale: 0.55,
  /** Keep fighters this far inside the visible screen edge. */
  screenMargin: 0.45,
  /** Soft separation radius between enemies. */
  separationX: 0.62,
  separationZ: 0.34,
  separationPush: 0.02,
} as const;

export const PLAYER_MOVEMENT = {
  jumpSquat: 3,
  jumpVelocity: 0.165,
  jumpSpeedX: 0.062,
  runJumpSpeedX: 0.11,
  jumpSpeedZ: 0.03,
  landFrames: 5,
  doubleTapWindow: 14,
  /** Frame of the pickup move on which the weapon attaches to the hand. */
  pickupFrame: 6,
  /** Landing recovery for enemies that drop in from above. */
  dropLandFrames: 12,
} as const;

export const COMBAT = {
  /** Frames a button press stays buffered (counts only frames the fighter actually steps). */
  inputBuffer: 6,
  defaultZRange: 0.34,
  hitstop: { light: 5, heavy: 8, knockdown: 11 },
  /** Extra hitstop the victim receives so the impact pose reads. */
  victimHitstopBonus: 1,
  hitstun: { light: 16, heavy: 22 },
  flashFrames: 8,
  /** Invulnerability after getting up. */
  getupInvuln: { player: 50, enemy: 16 },
  /** Frames the dead body blinks before being removed / respawning. */
  deathFrames: 64,
  respawnInvuln: 150,
  respawnHeight: 6.5,
  respawnBlastRadius: 3.8,
  /** Recovery after the respawn drop lands. */
  respawnLandFrames: 14,
  /** How long a defeated fighter lies on the floor before blinking out. */
  deathLyingFrames: 26,
  /** Frames of slow motion (stepped at quarter speed) after a boss takes its final hit. */
  bossDeathSlowmo: 48,
  /** Game speed during that slow motion. */
  slowmoScale: 0.25,
  /** Depth tolerance for picking up an item (x tolerance is the weapon's reach). */
  pickupZ: 0.45,
  maxAttackersPerTarget: 2,
  lastTargetFrames: 150,
  /** Consecutive hits within this window count toward the combo counter. */
  comboWindow: 70,
  /** Death launch overrides. */
  deathLaunchX: 0.13,
  deathLaunchY: 0.15,
  /** Damage multiplier bosses take while armoured. */
  bossArmorScale: 0.5,
  /** Score per point of damage dealt. */
  scorePerDamage: 10,
  /** Rumble strengths (0..1) and durations (ms). */
  rumble: {
    dealLight: { strong: 0.0, weak: 0.25, ms: 60 },
    dealHeavy: { strong: 0.35, weak: 0.45, ms: 110 },
    take: { strong: 0.75, weak: 0.5, ms: 190 },
    knockdown: { strong: 0.9, weak: 0.7, ms: 280 },
  },
} as const;

/**
 * Camera geometry. Shared by the renderer (projection) and the simulation
 * (which needs the visible width at a given depth to keep fighters on screen
 * and to stop enemies attacking from off-screen).
 */
export const CAMERA = {
  /** Vertical field of view in degrees. */
  fovY: 19,
  /** Downward tilt in degrees. */
  pitch: 16,
  /** Distance from the look-at point. */
  distance: 22.5,
  lookAtY: 1.25,
  lookAtZ: 0.6,
  /** Fixed aspect ratio (the canvas is letterboxed to it). */
  aspect: 16 / 9,
  /** Camera centre = lead player x + this. */
  follow: 1.4,
  maxSpeed: 0.15,
  lockSpeed: 0.09,
} as const;

export const PLAYER_DEF_ID = 'heru';

export const LIVES = {
  start: 3,
} as const;

export const SCORE = {
  bossBonus: 20000,
  clearBonus: 5000,
} as const;

/** Level flow timing, in frames. */
export const TRANSITION = {
  /** Walking off the right edge before the fade starts. */
  exitFrames: 75,
  fadeFrames: 40,
  /** Walk-in at the start of an environment (input is locked meanwhile). */
  enterFrames: 95,
  /** How long the stage title card stays up. */
  titleFrames: 250,
  /** From the final boss hitting the ground to the level-clear screen. */
  completeDelay: 150,
  /** How long the GO arrow blinks after an encounter clears. */
  goFrames: 240,
} as const;
