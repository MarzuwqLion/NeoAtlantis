/**
 * Boss behaviour tuning. Stats and hurtboxes live in fighters.ts, frame data
 * in moves.ts; this file holds the pattern logic parameters.
 */
import type { SpawnDef } from './defs';

export interface MidBossData {
  title: string;
  introFrames: number;
  /** Frame of the intro at which the name card appears. */
  cardAt: number;
  /** Health fraction at which the boss roars and calls in reinforcements. */
  summonAt: number;
  summon: SpawnDef[];
  /** Pause between attacks while walking toward the player. */
  idleFrames: [number, number];
  /** Prefer the charge when the player is at least this far away (x). */
  chargeMinDistance: number;
  /** Sweep reach (x) and slam reach used for pattern choice. */
  sweepRange: number;
  slamRange: number;
  /** After this many hits without acting, the boss answers with an armoured shove. */
  breakAfterHits: number;
}

export interface FinalBossPhase {
  combo: string;
  leap: string;
  counter: string;
  dash: string | null;
  idleFrames: [number, number];
  leapChance: number;
  dashChance: number;
  backstepChance: number;
  /** Chance that a dash is immediately followed by a dash back. */
  doubleDashChance: number;
  speedMul: number;
}

export interface FinalBossData {
  title: string;
  introFrames: number;
  cardAt: number;
  phase2At: number;
  phase1: FinalBossPhase;
  phase2: FinalBossPhase;
  breakAfterHits: number;
  reinforcements: {
    type: string;
    /** Spawned when phase 2 starts. */
    initial: SpawnDef[];
    maxAlive: number;
    interval: number;
    total: number;
  };
}

export const MIDBOSS: MidBossData = {
  title: 'THE IRON WARDEN',
  introFrames: 190,
  cardAt: 58,
  summonAt: 0.5,
  summon: [
    { type: 'grunt', from: 'right', z: -0.5 },
    { type: 'grunt', from: 'left', z: 0.4, delay: 20 },
    { type: 'grunt_elite', from: 'right', z: 0.7, delay: 40 },
  ],
  idleFrames: [34, 70],
  chargeMinDistance: 4.2,
  sweepRange: 2.6,
  slamRange: 1.8,
  breakAfterHits: 6,
};

export const FINALBOSS: FinalBossData = {
  title: 'THE SERPENT PHARAOH',
  introFrames: 210,
  cardAt: 70,
  phase2At: 0.5,
  phase1: {
    combo: 'fb_combo_1',
    leap: 'fb_leap',
    counter: 'fb_counter',
    dash: null,
    idleFrames: [28, 56],
    leapChance: 0.3,
    dashChance: 0,
    backstepChance: 0.25,
    doubleDashChance: 0,
    speedMul: 1,
  },
  phase2: {
    combo: 'fb2_combo_1',
    leap: 'fb2_leap',
    counter: 'fb2_counter',
    dash: 'fb2_dash',
    idleFrames: [22, 44],
    leapChance: 0.25,
    dashChance: 0.35,
    backstepChance: 0.2,
    doubleDashChance: 0.5,
    speedMul: 1.25,
  },
  breakAfterHits: 5,
  reinforcements: {
    type: 'thrower',
    initial: [
      { type: 'thrower', from: 'right', z: -0.7 },
      { type: 'thrower', from: 'left', z: 0.7, delay: 30 },
    ],
    maxAlive: 2,
    interval: 540,
    total: 6,
  },
};
