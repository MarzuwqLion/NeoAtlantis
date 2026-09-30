/**
 * Move frame data for every fighter. This is the single source of truth for
 * combat timing: the animation system stretches each clip's keys over the
 * startup / active / recovery phases defined here, so changing how a move
 * looks never changes how it plays.
 *
 * Hitboxes are authored facing right, relative to the fighter's feet:
 * x0..x1 forward reach, y0..y1 height band.
 */
import type { MoveDef } from './defs';

// ---------------------------------------------------------------------------
// Player: HERU
// ---------------------------------------------------------------------------
const PLAYER_MOVES: Record<string, MoveDef> = {
  jab_1: {
    clip: 'jab_1',
    startup: 3,
    active: 2,
    recovery: 8,
    hits: [{ box: { x0: 0.2, x1: 1.02, y0: 1.05, y1: 1.65 }, damage: 5, type: 'light', hitstun: 17, push: 0.03, spark: 'punch' }],
    chain: { next: 'jab_2', from: 5, requireHit: true },
    motion: [{ from: 0, to: 4, vx: 0.018 }],
  },
  jab_2: {
    clip: 'jab_2',
    startup: 3,
    active: 2,
    recovery: 9,
    hits: [{ box: { x0: 0.2, x1: 1.06, y0: 1.05, y1: 1.65 }, damage: 5, type: 'light', hitstun: 17, push: 0.03, spark: 'punch' }],
    chain: { next: 'body_blow', from: 5, requireHit: true },
    motion: [{ from: 0, to: 4, vx: 0.018 }],
  },
  body_blow: {
    clip: 'body_blow',
    startup: 5,
    active: 3,
    recovery: 11,
    hits: [{ box: { x0: 0.15, x1: 1.02, y0: 0.75, y1: 1.4 }, damage: 8, type: 'heavy', hitstun: 22, push: 0.045, spark: 'punch', hitstop: 8 }],
    chain: { next: 'finisher', from: 8, requireHit: true },
    motion: [{ from: 1, to: 7, vx: 0.032 }],
  },
  finisher: {
    clip: 'finisher',
    startup: 8,
    active: 3,
    recovery: 19,
    hits: [
      {
        box: { x0: 0.15, x1: 1.18, y0: 0.85, y1: 1.8 },
        damage: 13,
        type: 'knockdown',
        launchX: 0.12,
        launchY: 0.13,
        spark: 'punch',
        hitstop: 11,
        shake: 0.35,
      },
    ],
    motion: [{ from: 3, to: 11, vx: 0.042 }],
  },
  jump_kick: {
    clip: 'jump_attack',
    startup: 4,
    active: 40,
    recovery: 0,
    air: true,
    activeUntilLand: true,
    landRecovery: 7,
    hits: [{ box: { x0: -0.05, x1: 0.82, y0: -0.35, y1: 0.75 }, damage: 9, type: 'heavy', hitstun: 22, push: 0.05, spark: 'kick', hitstop: 7 }],
  },
  flying_kick: {
    clip: 'jump_attack_dir',
    startup: 4,
    active: 16,
    recovery: 30,
    air: true,
    landRecovery: 9,
    hits: [
      {
        box: { x0: 0.1, x1: 1.08, y0: 0.15, y1: 0.95 },
        damage: 11,
        type: 'knockdown',
        launchX: 0.11,
        launchY: 0.1,
        spark: 'kick',
        hitstop: 9,
        shake: 0.25,
      },
    ],
  },
  dash_attack: {
    clip: 'dash_attack',
    startup: 4,
    active: 9,
    recovery: 16,
    motion: [
      { from: 0, to: 6, vx: 0.15 },
      { from: 6, to: 13, vx: 0.11 },
      { from: 13, to: 22, vx: 0.035 },
    ],
    hits: [
      {
        box: { x0: 0.1, x1: 1.12, y0: 0.5, y1: 1.6 },
        damage: 12,
        type: 'knockdown',
        launchX: 0.14,
        launchY: 0.12,
        spark: 'kick',
        hitstop: 10,
        shake: 0.3,
      },
    ],
  },
  pickup: {
    clip: 'pickup',
    startup: 0,
    active: 0,
    recovery: 12,
    hits: [],
  },

  // --- Weapons -------------------------------------------------------------
  khopesh_1: {
    clip: 'khopesh_1',
    startup: 4,
    active: 3,
    recovery: 9,
    weapon: true,
    hits: [{ box: { x0: 0.15, x1: 1.42, y0: 0.8, y1: 1.85 }, damage: 9, type: 'light', hitstun: 19, push: 0.04, spark: 'blade' }],
    chain: { next: 'khopesh_2', from: 8, requireHit: true },
    motion: [{ from: 0, to: 5, vx: 0.02 }],
  },
  khopesh_2: {
    clip: 'khopesh_2',
    startup: 4,
    active: 3,
    recovery: 10,
    weapon: true,
    hits: [{ box: { x0: 0.15, x1: 1.42, y0: 0.8, y1: 1.85 }, damage: 9, type: 'light', hitstun: 19, push: 0.04, spark: 'blade' }],
    chain: { next: 'khopesh_3', from: 8, requireHit: true },
    motion: [{ from: 0, to: 5, vx: 0.02 }],
  },
  khopesh_3: {
    clip: 'khopesh_3',
    startup: 7,
    active: 4,
    recovery: 17,
    weapon: true,
    hits: [
      {
        box: { x0: 0.1, x1: 1.52, y0: 0.6, y1: 1.95 },
        damage: 14,
        type: 'knockdown',
        launchX: 0.12,
        launchY: 0.13,
        spark: 'blade',
        hitstop: 11,
        shake: 0.35,
      },
    ],
    motion: [{ from: 2, to: 10, vx: 0.045 }],
  },
  staff_swing: {
    clip: 'staff_swing',
    startup: 10,
    active: 4,
    recovery: 18,
    weapon: true,
    hits: [
      {
        box: { x0: 0.0, x1: 2.25, y0: 0.5, y1: 1.95 },
        zRange: 0.55,
        damage: 15,
        type: 'knockdown',
        launchX: 0.13,
        launchY: 0.13,
        spark: 'blunt',
        hitstop: 11,
        shake: 0.4,
      },
    ],
    motion: [{ from: 4, to: 12, vx: 0.03 }],
  },
  jar_throw: {
    clip: 'weapon_throw',
    startup: 9,
    active: 1,
    recovery: 14,
    hits: [],
    throwWeapon: { frame: 9 },
  },
};

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
const ENEMY_MOVES: Record<string, MoveDef> = {
  // Grunt (SCARAB): readable 2-hit punch.
  grunt_jab: {
    clip: 'grunt_jab',
    startup: 12,
    active: 2,
    recovery: 12,
    telegraph: true,
    hits: [{ box: { x0: 0.2, x1: 0.98, y0: 1.0, y1: 1.62 }, damage: 6, type: 'light', hitstun: 18, push: 0.03, spark: 'punch' }],
    chain: { next: 'grunt_hook', from: 15, requireHit: true },
    motion: [{ from: 8, to: 13, vx: 0.03 }],
  },
  grunt_hook: {
    clip: 'grunt_hook',
    startup: 9,
    active: 3,
    recovery: 22,
    telegraph: true,
    hits: [{ box: { x0: 0.2, x1: 1.02, y0: 0.95, y1: 1.68 }, damage: 8, type: 'heavy', hitstun: 24, push: 0.06, spark: 'punch', hitstop: 8 }],
    motion: [{ from: 4, to: 11, vx: 0.035 }],
  },
  grunt_staff: {
    clip: 'staff_swing',
    startup: 17,
    active: 4,
    recovery: 22,
    telegraph: true,
    hits: [
      {
        box: { x0: 0.0, x1: 2.05, y0: 0.5, y1: 1.85 },
        zRange: 0.5,
        damage: 12,
        type: 'knockdown',
        launchX: 0.11,
        launchY: 0.12,
        spark: 'blunt',
        shake: 0.3,
      },
    ],
    motion: [{ from: 10, to: 18, vx: 0.025 }],
  },
  grunt_khopesh: {
    clip: 'weapon_swing',
    startup: 13,
    active: 3,
    recovery: 18,
    telegraph: true,
    hits: [{ box: { x0: 0.15, x1: 1.38, y0: 0.8, y1: 1.8 }, damage: 9, type: 'heavy', hitstun: 22, push: 0.05, spark: 'blade' }],
    motion: [{ from: 8, to: 14, vx: 0.03 }],
  },

  // Blade runner (JACKAL): dash in with a knife slash, retreat.
  br_dash_slash: {
    clip: 'br_dash_slash',
    startup: 17,
    active: 6,
    recovery: 12,
    telegraph: true,
    motion: [
      { from: 10, to: 23, vx: 0.19 },
      { from: 23, to: 30, vx: 0.05 },
    ],
    hits: [{ box: { x0: 0.1, x1: 1.32, y0: 0.8, y1: 1.7 }, damage: 10, type: 'heavy', hitstun: 22, push: 0.05, spark: 'blade', hitstop: 8 }],
  },
  br_dash_strike: {
    clip: 'br_dash_slash',
    startup: 17,
    active: 6,
    recovery: 12,
    telegraph: true,
    motion: [
      { from: 10, to: 23, vx: 0.17 },
      { from: 23, to: 30, vx: 0.05 },
    ],
    hits: [{ box: { x0: 0.1, x1: 1.0, y0: 0.9, y1: 1.6 }, damage: 7, type: 'light', hitstun: 18, push: 0.05, spark: 'punch' }],
  },
  br_retreat: {
    clip: 'br_retreat',
    startup: 0,
    active: 0,
    recovery: 22,
    hits: [],
    motion: [{ from: 0, to: 15, vx: -0.12 }],
  },

  // Bruiser (RAM): armoured wind-ups, screen-crossing shoulder charge.
  bruiser_charge: {
    clip: 'bruiser_charge',
    startup: 38,
    active: 2,
    recovery: 42,
    telegraph: true,
    armor: { from: 0, to: 40, level: 'light' },
    charge: { speed: 0.23, max: 78, stopAtEdge: true },
    hits: [
      {
        box: { x0: 0.0, x1: 1.25, y0: 0.3, y1: 2.05 },
        zRange: 0.48,
        damage: 16,
        type: 'knockdown',
        launchX: 0.16,
        launchY: 0.14,
        spark: 'blunt',
        hitstop: 12,
        shake: 0.5,
      },
    ],
    sfx: [
      { frame: 2, name: 'charge_windup' },
      { frame: 38, name: 'charge_go' },
    ],
  },
  bruiser_smash: {
    clip: 'bruiser_smash',
    startup: 24,
    active: 4,
    recovery: 26,
    telegraph: true,
    armor: { from: 0, to: 24, level: 'light' },
    hits: [
      {
        box: { x0: 0.1, x1: 1.55, y0: 0.3, y1: 2.1 },
        damage: 14,
        type: 'knockdown',
        launchX: 0.12,
        launchY: 0.13,
        spark: 'blunt',
        hitstop: 12,
        shake: 0.4,
      },
    ],
    motion: [{ from: 16, to: 26, vx: 0.04 }],
  },

  // Thrower (IBIS): lobs clay jars along the lane; weak shove up close.
  thrower_lob: {
    clip: 'thrower_lob',
    startup: 22,
    active: 1,
    recovery: 22,
    telegraph: true,
    hits: [],
    projectile: { frame: 22, kind: 'lobJar', x: 0.25, y: 2.15 },
  },
  thrower_shove: {
    clip: 'thrower_shove',
    startup: 9,
    active: 3,
    recovery: 16,
    telegraph: true,
    hits: [{ box: { x0: 0.2, x1: 0.95, y0: 0.8, y1: 1.6 }, damage: 3, type: 'light', hitstun: 14, push: 0.14, spark: 'punch' }],
  },

  // Acrobat (CAT): leaps in, slide kicks, flips away. Long landing = punish window.
  acro_slide: {
    clip: 'acro_slide',
    startup: 13,
    active: 16,
    recovery: 10,
    telegraph: true,
    hurtbox: { height: 0.75 },
    motion: [
      { from: 11, to: 22, vx: 0.21 },
      { from: 22, to: 29, vx: 0.12 },
      { from: 29, to: 39, vx: 0.03 },
    ],
    hits: [
      {
        box: { x0: 0.15, x1: 1.12, y0: 0.0, y1: 0.62 },
        damage: 11,
        type: 'knockdown',
        launchX: 0.1,
        launchY: 0.12,
        spark: 'kick',
        hitstop: 9,
        shake: 0.25,
      },
    ],
  },
  acro_flip: {
    clip: 'acro_flip',
    startup: 0,
    active: 0,
    recovery: 60,
    air: true,
    landRecovery: 26,
    hits: [],
    jump: { frame: 1, vy: 0.15, vx: -0.12 },
  },
  acro_leap_in: {
    clip: 'acro_flip',
    startup: 0,
    active: 0,
    recovery: 90,
    air: true,
    landRecovery: 22,
    hits: [],
    jump: { frame: 0, vy: 0.19, vx: 0.1, toTarget: true, maxVx: 0.2 },
  },
  acro_kick: {
    clip: 'acro_kick',
    startup: 11,
    active: 3,
    recovery: 16,
    telegraph: true,
    hits: [{ box: { x0: 0.1, x1: 1.08, y0: 0.6, y1: 1.5 }, damage: 8, type: 'heavy', hitstun: 22, push: 0.06, spark: 'kick', hitstop: 8 }],
  },
};

// ---------------------------------------------------------------------------
// Mid-boss: SOBEKHAN (crocodile heavy). Armoured during attacks.
// ---------------------------------------------------------------------------
const MIDBOSS_MOVES: Record<string, MoveDef> = {
  mb_charge: {
    clip: 'mb_charge',
    startup: 46,
    active: 2,
    recovery: 58,
    telegraph: true,
    armor: { from: 0, to: 48, level: 'full' },
    charge: { speed: 0.27, max: 95, stopAtEdge: true },
    hits: [
      {
        box: { x0: -0.2, x1: 1.65, y0: 0.2, y1: 2.6 },
        zRange: 0.55,
        damage: 18,
        type: 'knockdown',
        launchX: 0.17,
        launchY: 0.15,
        spark: 'blunt',
        hitstop: 13,
        shake: 0.6,
      },
    ],
    sfx: [
      { frame: 1, name: 'boss_roar' },
      { frame: 46, name: 'charge_go' },
    ],
  },
  mb_slam: {
    clip: 'mb_slam',
    startup: 36,
    active: 4,
    recovery: 46,
    telegraph: true,
    armor: { from: 0, to: 40, level: 'full' },
    hits: [
      {
        radial: true,
        box: { x0: -1.5, x1: 1.5, y0: 0.0, y1: 1.3 },
        zRange: 1.1,
        damage: 16,
        type: 'knockdown',
        launchX: 0.14,
        launchY: 0.14,
        spark: 'blunt',
        hitstop: 12,
        shake: 0.8,
      },
    ],
    projectile: { frame: 36, kind: 'shockwave', x: 0.9, y: 0 },
    shakeAt: { frame: 36, amount: 0.9, frames: 20 },
  },
  mb_sweep: {
    clip: 'mb_sweep',
    startup: 28,
    active: 7,
    recovery: 34,
    telegraph: true,
    armor: { from: 0, to: 35, level: 'full' },
    hits: [
      {
        box: { x0: -0.6, x1: 2.9, y0: 0.2, y1: 1.9 },
        zRange: 1.0,
        damage: 15,
        type: 'knockdown',
        launchX: 0.15,
        launchY: 0.12,
        spark: 'blunt',
        hitstop: 12,
        shake: 0.5,
      },
    ],
    motion: [{ from: 22, to: 34, vx: 0.03 }],
  },
  mb_roar: {
    clip: 'mb_roar',
    startup: 0,
    active: 0,
    recovery: 84,
    invuln: { from: 0, to: 84 },
    hits: [],
    summon: { frame: 34 },
    shakeAt: { frame: 18, amount: 0.5, frames: 45 },
    sfx: [{ frame: 12, name: 'boss_roar' }],
  },
  mb_shove: {
    clip: 'mb_shove',
    startup: 9,
    active: 4,
    recovery: 24,
    telegraph: true,
    armor: { from: 0, to: 13, level: 'full' },
    hits: [
      {
        radial: true,
        box: { x0: -1.0, x1: 1.7, y0: 0.2, y1: 2.4 },
        zRange: 0.8,
        damage: 8,
        type: 'knockdown',
        launchX: 0.15,
        launchY: 0.1,
        spark: 'blunt',
        shake: 0.4,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Final boss: APEP, the Serpent Pharaoh (fast twin-khopesh duellist).
// Phase-2 moves reuse the phase-1 clips with tighter frame data: the clips
// automatically play faster because they are keyed to the move's phases.
// ---------------------------------------------------------------------------
const FINALBOSS_MOVES: Record<string, MoveDef> = {
  fb_combo_1: {
    clip: 'fb_combo_1',
    startup: 13,
    active: 3,
    recovery: 9,
    telegraph: true,
    hits: [{ box: { x0: 0.15, x1: 1.5, y0: 0.8, y1: 1.95 }, damage: 8, type: 'light', hitstun: 20, push: 0.03, spark: 'blade' }],
    chain: { next: 'fb_combo_2', from: 18, requireHit: false },
    motion: [{ from: 8, to: 16, vx: 0.05 }],
  },
  fb_combo_2: {
    clip: 'fb_combo_2',
    startup: 7,
    active: 3,
    recovery: 9,
    hits: [{ box: { x0: 0.15, x1: 1.5, y0: 0.8, y1: 1.95 }, damage: 8, type: 'light', hitstun: 20, push: 0.03, spark: 'blade' }],
    chain: { next: 'fb_combo_3', from: 12, requireHit: false },
    motion: [{ from: 2, to: 10, vx: 0.05 }],
  },
  fb_combo_3: {
    clip: 'fb_combo_3',
    startup: 11,
    active: 5,
    recovery: 28,
    hits: [
      {
        box: { x0: -0.9, x1: 1.7, y0: 0.4, y1: 2.0 },
        damage: 14,
        type: 'knockdown',
        launchX: 0.14,
        launchY: 0.14,
        spark: 'blade',
        hitstop: 12,
        shake: 0.4,
      },
    ],
    motion: [{ from: 4, to: 16, vx: 0.06 }],
  },
  fb_leap: {
    clip: 'fb_leap',
    startup: 18,
    active: 60,
    recovery: 0,
    telegraph: true,
    air: true,
    activeUntilLand: true,
    landRecovery: 30,
    jump: { frame: 18, vy: 0.2, vx: 0, toTarget: true, maxVx: 0.2 },
    hits: [
      {
        from: 42,
        box: { x0: -0.5, x1: 1.25, y0: -0.6, y1: 1.2 },
        zRange: 0.55,
        damage: 16,
        type: 'knockdown',
        launchX: 0.13,
        launchY: 0.14,
        spark: 'blade',
        hitstop: 12,
        shake: 0.6,
      },
    ],
    sfx: [{ frame: 18, name: 'leap' }],
  },
  fb_backstep: {
    clip: 'fb_backstep',
    startup: 0,
    active: 0,
    recovery: 18,
    invuln: { from: 0, to: 9 },
    hits: [],
    motion: [{ from: 0, to: 12, vx: -0.15 }],
  },
  fb_counter: {
    clip: 'fb_counter',
    startup: 7,
    active: 5,
    recovery: 20,
    telegraph: true,
    armor: { from: 0, to: 12, level: 'full' },
    hits: [
      {
        radial: true,
        box: { x0: -1.15, x1: 1.45, y0: 0.3, y1: 2.0 },
        zRange: 0.6,
        damage: 10,
        type: 'knockdown',
        launchX: 0.14,
        launchY: 0.12,
        spark: 'blade',
        shake: 0.35,
      },
    ],
  },
  fb_power: {
    clip: 'fb_power',
    startup: 0,
    active: 0,
    recovery: 100,
    invuln: { from: 0, to: 100 },
    hits: [],
    summon: { frame: 55 },
    shakeAt: { frame: 40, amount: 0.6, frames: 32 },
    sfx: [{ frame: 4, name: 'power_up' }],
  },

  // Phase 2 -----------------------------------------------------------------
  fb2_combo_1: {
    clip: 'fb_combo_1',
    startup: 11,
    active: 3,
    recovery: 7,
    telegraph: true,
    hits: [{ box: { x0: 0.15, x1: 1.5, y0: 0.8, y1: 1.95 }, damage: 9, type: 'light', hitstun: 20, push: 0.03, spark: 'blade' }],
    chain: { next: 'fb2_combo_2', from: 13, requireHit: false },
    motion: [{ from: 5, to: 12, vx: 0.055 }],
  },
  fb2_combo_2: {
    clip: 'fb_combo_2',
    startup: 5,
    active: 3,
    recovery: 7,
    hits: [{ box: { x0: 0.15, x1: 1.5, y0: 0.8, y1: 1.95 }, damage: 9, type: 'light', hitstun: 20, push: 0.03, spark: 'blade' }],
    chain: { next: 'fb2_combo_3', from: 9, requireHit: false },
    motion: [{ from: 1, to: 8, vx: 0.055 }],
  },
  fb2_combo_3: {
    clip: 'fb_combo_3',
    startup: 8,
    active: 5,
    recovery: 22,
    hits: [
      {
        box: { x0: -0.9, x1: 1.7, y0: 0.4, y1: 2.0 },
        damage: 15,
        type: 'knockdown',
        launchX: 0.15,
        launchY: 0.14,
        spark: 'blade',
        hitstop: 12,
        shake: 0.45,
      },
    ],
    motion: [{ from: 3, to: 13, vx: 0.065 }],
  },
  fb2_leap: {
    clip: 'fb_leap',
    startup: 12,
    active: 60,
    recovery: 0,
    telegraph: true,
    air: true,
    activeUntilLand: true,
    landRecovery: 24,
    jump: { frame: 12, vy: 0.21, vx: 0, toTarget: true, maxVx: 0.24 },
    hits: [
      {
        from: 36,
        box: { x0: -0.5, x1: 1.25, y0: -0.6, y1: 1.2 },
        zRange: 0.55,
        damage: 17,
        type: 'knockdown',
        launchX: 0.13,
        launchY: 0.14,
        spark: 'blade',
        hitstop: 12,
        shake: 0.6,
      },
    ],
    sfx: [{ frame: 12, name: 'leap' }],
  },
  fb2_dash: {
    clip: 'fb_dash',
    startup: 22,
    active: 22,
    recovery: 24,
    telegraph: true,
    motion: [
      { from: 22, to: 44, vx: 0.36 },
      { from: 44, to: 52, vx: 0.1 },
    ],
    hits: [
      {
        box: { x0: -0.3, x1: 1.25, y0: 0.45, y1: 1.95 },
        zRange: 0.5,
        damage: 15,
        type: 'knockdown',
        launchX: 0.15,
        launchY: 0.13,
        spark: 'blade',
        hitstop: 11,
        shake: 0.45,
      },
    ],
    sfx: [
      { frame: 10, name: 'glint' },
      { frame: 22, name: 'dash' },
    ],
  },
  fb2_counter: {
    clip: 'fb_counter',
    startup: 5,
    active: 5,
    recovery: 18,
    telegraph: true,
    armor: { from: 0, to: 10, level: 'full' },
    hits: [
      {
        radial: true,
        box: { x0: -1.15, x1: 1.45, y0: 0.3, y1: 2.0 },
        zRange: 0.6,
        damage: 11,
        type: 'knockdown',
        launchX: 0.14,
        launchY: 0.12,
        spark: 'blade',
        shake: 0.35,
      },
    ],
  },
};

export const MOVES: Record<string, MoveDef> = {
  ...PLAYER_MOVES,
  ...ENEMY_MOVES,
  ...MIDBOSS_MOVES,
  ...FINALBOSS_MOVES,
};

export function moveTotal(def: MoveDef): number {
  return def.startup + def.active + def.recovery;
}

export function getMove(id: string): MoveDef {
  const def = MOVES[id];
  if (!def) throw new Error(`Unknown move "${id}"`);
  return def;
}
