/**
 * Enemy clip sets. Every attack has a readable wind-up in its startup phase.
 */
import type { ClipSpec, PoseSpec } from '../pose';
import { k, STANCE } from './humanoid';

// ---------------------------------------------------------------------------
// SCARAB (grunt)
// ---------------------------------------------------------------------------
const GRUNT_STANCE: PoseSpec = {
  ...STANCE,
  pos: [0, -0.06, 0],
  hips: [0, -12, 0],
  spine: [8, 4, 0],
  chest: [6, 6, 0],
  upperArmL: [-36, 0, 16],
  lowerArmL: [-86, 0, 0],
  upperArmR: [-26, 0, -18],
  lowerArmR: [-104, 0, 0],
};

export const GRUNT_CLIPS: Record<string, ClipSpec> = {
  idle: {
    mode: 'loop',
    length: 80,
    base: GRUNT_STANCE,
    blend: 8,
    keys: [k(0, {}), k(0.5, { pos: [0, -0.08, 0], spine: [10, 4, 0], chest: [8, 8, 0], upperArmL: [-33, 0, 16], upperArmR: [-23, 0, -18], head: [-2, 8, -2] })],
  },
  grunt_jab: {
    mode: 'move',
    base: GRUNT_STANCE,
    blend: 3,
    keys: [
      k(['S', 0], {}),
      k(['S', 0.7], { pos: [0, -0.1, -0.05], hips: [0, -4, 0], chest: [0, 18, 0], spine: [4, 6, 0], shoulderL: [0, 12, 4], upperArmL: [-6, 0, 24], lowerArmL: [-124, 0, 0], head: [-6, -6, 0] }, 'out'),
      k(['S', 0.95], { upperArmL: [-2, 0, 24] }, 'linear'),
      k(['A', 0], { pos: [0, -0.07, 0.07], hips: [0, -24, 0], chest: [6, -10, 0], shoulderL: [0, -14, 4], upperArmL: [-88, 0, -4], lowerArmL: [-4, 0, 0], head: [-4, 10, 0] }, 'snap'),
      k(['A', 1], { upperArmL: [-90, 0, -6] }, 'out'),
      k(['R', 0.5], { pos: [0, -0.06, 0.03], chest: [6, 2, 0], shoulderL: [0, 0, 3], upperArmL: [-50, 0, 12], lowerArmL: [-80, 0, 0] }),
      k(['R', 1], { ...GRUNT_STANCE }),
    ],
  },
  grunt_hook: {
    mode: 'move',
    base: GRUNT_STANCE,
    blend: 2,
    keys: [
      k(['S', 0], {}),
      k(['S', 0.8], { pos: [0, -0.1, -0.02], hips: [0, -34, 0], chest: [4, -30, 0], shoulderR: [0, -12, -4], upperArmR: [-40, 0, -72], lowerArmR: [-92, 0, 0], head: [0, 12, 0] }, 'in'),
      k(['A', 0.3], { pos: [0, -0.1, 0.08], hips: [0, 14, 0], chest: [8, 32, 0], shoulderR: [0, 16, -4], upperArmR: [-86, 0, 30], lowerArmR: [-90, 0, 0], head: [-2, -10, 0] }, 'snap'),
      k(['A', 1], { chest: [8, 38, 0], upperArmR: [-84, 0, 44] }, 'out'),
      k(['R', 0.5], { pos: [0, -0.07, 0.04], hips: [0, -4, 0], chest: [6, 10, 0], shoulderR: [0, 2, -2], upperArmR: [-40, 0, -10], lowerArmR: [-100, 0, 0] }),
      k(['R', 1], { ...GRUNT_STANCE }),
    ],
  },
};

// ---------------------------------------------------------------------------
// JACKAL (blade runner): low knife stance, prowling.
// ---------------------------------------------------------------------------
const BR_STANCE: PoseSpec = {
  pos: [0, -0.14, 0],
  hips: [6, -20, 0],
  spine: [14, 4, 0],
  chest: [8, 8, 0],
  neck: [-10, 4, 0],
  head: [-8, 6, 0],
  shoulderL: [0, 0, 0],
  shoulderR: [0, 0, 0],
  upperArmL: [-60, 0, 22],
  lowerArmL: [-44, 0, 0],
  handL: [10, 0, 0],
  upperArmR: [-34, 0, -10],
  lowerArmR: [-50, 0, 0],
  handR: [16, 0, 0],
  upperLegL: [-40, 12, 6],
  lowerLegL: [56, 0, 0],
  footL: [-14, -8, 0],
  upperLegR: [10, -10, -6],
  lowerLegR: [48, 0, 0],
  footR: [16, 8, 0],
};

export const BLADE_RUNNER_CLIPS: Record<string, ClipSpec> = {
  idle: {
    mode: 'loop',
    length: 60,
    base: BR_STANCE,
    blend: 8,
    keys: [
      k(0, {}),
      k(0.5, { pos: [0, -0.16, 0], spine: [16, 2, 0], upperArmR: [-40, 0, -10], upperArmL: [-56, 0, 22], head: [-6, 12, 0] }),
    ],
  },
  idle_wpn: {
    mode: 'loop',
    length: 60,
    base: BR_STANCE,
    blend: 8,
    keys: [k(0, {}), k(0.5, { pos: [0, -0.16, 0], spine: [16, 2, 0], upperArmR: [-40, 0, -10], head: [-6, 12, 0] })],
  },
  walk: {
    mode: 'stride',
    length: 1.4,
    base: BR_STANCE,
    blend: 6,
    keys: [
      k(0, { pos: [0, -0.16, 0], upperLegL: [-50, 8, 4], lowerLegL: [44, 0, 0], footL: [-14, 0, 0], upperLegR: [20, -8, -4], lowerLegR: [50, 0, 0], footR: [20, 0, 0] }),
      k(0.25, { pos: [0, -0.1, 0], upperLegL: [-20, 8, 4], lowerLegL: [30, 0, 0], footL: [0, 0, 0], upperLegR: [-40, -8, -4], lowerLegR: [90, 0, 0], footR: [20, 0, 0] }),
      k(0.5, { pos: [0, -0.16, 0], upperLegR: [-50, -8, -4], lowerLegR: [44, 0, 0], footR: [-14, 0, 0], upperLegL: [20, 8, 4], lowerLegL: [50, 0, 0], footL: [20, 0, 0] }),
      k(0.75, { pos: [0, -0.1, 0], upperLegR: [-20, -8, -4], lowerLegR: [30, 0, 0], footR: [0, 0, 0], upperLegL: [-40, 8, 4], lowerLegL: [90, 0, 0], footL: [20, 0, 0] }),
    ],
  },
  br_dash_slash: {
    mode: 'move',
    base: BR_STANCE,
    blend: 3,
    keys: [
      k(['S', 0], {}),
      k(
        ['S', 0.55],
        {
          pos: [0, -0.26, -0.06],
          hips: [16, -30, 0],
          spine: [30, -10, 0],
          chest: [10, -20, 0],
          head: [-20, 10, 0],
          upperArmR: [34, 0, -36],
          lowerArmR: [-66, 0, 0],
          handR: [30, 0, 0],
          upperArmL: [-80, 0, 30],
          lowerArmL: [-20, 0, 0],
          upperLegL: [-66, 12, 6],
          lowerLegL: [100, 0, 0],
          upperLegR: [24, -10, -6],
          lowerLegR: [84, 0, 0],
        },
        'out',
      ),
      k(['S', 0.9], { pos: [0, -0.2, 0.08], hips: [22, -20, 0], spine: [40, -6, 0], upperLegL: [-70, 12, 6], lowerLegL: [60, 0, 0], upperLegR: [44, -10, -6], lowerLegR: [30, 0, 0], footR: [40, 0, 0] }, 'in'),
      k(['A', 0.3], { pos: [0, -0.16, 0.14], hips: [14, 16, 0], spine: [30, 12, 0], chest: [10, 34, 0], upperArmR: [-100, 0, 44], lowerArmR: [-8, 0, 0], handR: [-10, 0, 0], upperArmL: [10, 0, 40], lowerArmL: [-60, 0, 0] }, 'snap'),
      k(['A', 1], { chest: [10, 44, 0], upperArmR: [-70, 0, 60] }, 'out'),
      k(['R', 0.5], { pos: [0, -0.18, 0.06], hips: [8, -6, 0], spine: [20, 4, 0], chest: [8, 10, 0], upperArmR: [-40, 0, 0], lowerArmR: [-60, 0, 0] }),
      k(['R', 1], { ...BR_STANCE }),
    ],
  },
  br_retreat: {
    mode: 'move',
    base: BR_STANCE,
    blend: 2,
    keys: [
      k(['R', 0], {}),
      k(['R', 0.2], { pos: [0, 0.02, -0.04], hips: [-4, -20, 0], spine: [4, 4, 0], upperLegL: [-50, 12, 6], lowerLegL: [100, 0, 0], upperLegR: [-20, -10, -6], lowerLegR: [100, 0, 0], upperArmL: [-90, 0, 40], lowerArmL: [-30, 0, 0] }, 'out'),
      k(['R', 0.55], { pos: [0, -0.24, 0], spine: [24, 4, 0], upperLegL: [-60, 12, 6], lowerLegL: [90, 0, 0], upperLegR: [16, -10, -6], lowerLegR: [80, 0, 0] }, 'in'),
      k(['R', 1], { ...BR_STANCE }),
    ],
  },
};

// ---------------------------------------------------------------------------
// KHNUM (bruiser): heavy, wide, arms low.
// ---------------------------------------------------------------------------
const BRUISER_STANCE: PoseSpec = {
  pos: [0, -0.06, 0],
  hips: [0, -10, 0],
  spine: [10, 2, 0],
  chest: [8, 4, 0],
  neck: [-12, 0, 0],
  head: [-6, 4, 0],
  shoulderL: [0, 0, 6],
  shoulderR: [0, 0, -6],
  upperArmL: [-26, 0, 22],
  lowerArmL: [-70, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-18, 0, -24],
  lowerArmR: [-80, 0, 0],
  handR: [0, 0, 0],
  upperLegL: [-16, 12, 10],
  lowerLegL: [20, 0, 0],
  footL: [0, -10, 0],
  upperLegR: [10, -12, -10],
  lowerLegR: [14, 0, 0],
  footR: [4, 10, 0],
};

export const BRUISER_CLIPS: Record<string, ClipSpec> = {
  idle: {
    mode: 'loop',
    length: 110,
    base: BRUISER_STANCE,
    blend: 10,
    keys: [k(0, {}), k(0.5, { pos: [0, -0.085, 0], spine: [12, 2, 0], chest: [11, 4, 0], shoulderL: [0, 0, 9], shoulderR: [0, 0, -9], upperArmL: [-22, 0, 24], upperArmR: [-14, 0, -26], head: [-4, 8, 0] })],
  },
  walk: {
    mode: 'stride',
    length: 1.3,
    base: BRUISER_STANCE,
    blend: 8,
    keys: [
      k(0, { pos: [0, -0.1, 0], hips: [0, -2, 5], chest: [8, 10, -4], upperLegL: [-26, 10, 10], lowerLegL: [14, 0, 0], footL: [-8, 0, 0], upperLegR: [18, -10, -10], lowerLegR: [18, 0, 0], footR: [12, 0, 0], upperArmL: [-10, 0, 24], upperArmR: [-34, 0, -24] }),
      k(0.25, { pos: [0, -0.03, 0], hips: [0, -8, 0], upperLegL: [-2, 10, 10], lowerLegL: [8, 0, 0], upperLegR: [-20, -10, -10], lowerLegR: [56, 0, 0] }),
      k(0.5, { pos: [0, -0.1, 0], hips: [0, -14, -5], chest: [8, -2, 4], upperLegR: [-26, -10, -10], lowerLegR: [14, 0, 0], footR: [-8, 0, 0], upperLegL: [18, 10, 10], lowerLegL: [18, 0, 0], footL: [12, 0, 0], upperArmL: [-34, 0, 24], upperArmR: [-10, 0, -24] }),
      k(0.75, { pos: [0, -0.03, 0], hips: [0, -8, 0], upperLegR: [-2, -10, -10], lowerLegR: [8, 0, 0], upperLegL: [-20, 10, 10], lowerLegL: [56, 0, 0] }),
    ],
  },
  bruiser_charge: {
    mode: 'move',
    base: BRUISER_STANCE,
    blend: 4,
    keys: [
      k(['S', 0], {}),
      // Paw the ground twice, head lowered, shoulders hunched: unmistakable wind-up.
      k(['S', 0.18], { pos: [0, -0.12, 0], spine: [30, 0, 0], neck: [-24, 0, 0], shoulderL: [0, 0, 14], shoulderR: [0, 0, -14], upperLegR: [-40, -12, -10], lowerLegR: [70, 0, 0], upperArmL: [10, 0, 30], upperArmR: [10, 0, -30] }, 'out'),
      k(['S', 0.32], { upperLegR: [12, -12, -10], lowerLegR: [10, 0, 0], footR: [20, 0, 0] }, 'in'),
      k(['S', 0.5], { upperLegR: [-42, -12, -10], lowerLegR: [72, 0, 0] }, 'out'),
      k(['S', 0.64], { upperLegR: [14, -12, -10], lowerLegR: [10, 0, 0] }, 'in'),
      k(['S', 1], { pos: [0, -0.2, -0.05], hips: [14, 24, 0], spine: [40, 10, 0], chest: [14, 14, 0], neck: [-30, 0, 0], upperLegL: [-44, 12, 10], lowerLegL: [70, 0, 0], upperLegR: [30, -12, -10], lowerLegR: [40, 0, 0], footR: [30, 0, 0] }, 'inOut'),
      k(['A', 1], { pos: [0, -0.16, 0.05] }),
      // Crashed: dazed, staggering back (vulnerable).
      k(['R', 0.15], { pos: [0, -0.02, -0.12], hips: [-10, 0, 0], spine: [-16, 0, 0], chest: [-10, 0, 0], neck: [-10, 0, 0], head: [-24, 10, 8], upperArmL: [-60, 0, 50], upperArmR: [-50, 0, -50], lowerArmL: [-30, 0, 0], lowerArmR: [-30, 0, 0], upperLegL: [-30, 12, 10], lowerLegL: [20, 0, 0], upperLegR: [20, -12, -10] }, 'snap'),
      k(['R', 0.4], { head: [6, -16, -10], chest: [4, -8, 6], spine: [4, 0, 0] }),
      k(['R', 0.65], { head: [-10, 16, 10], chest: [0, 8, -6] }),
      k(['R', 1], { ...BRUISER_STANCE }),
    ],
  },
  bruiser_charge_loop: {
    mode: 'loop',
    length: 18,
    base: BRUISER_STANCE,
    blend: 3,
    keys: [
      k(0, { pos: [0, -0.16, 0.06], hips: [14, 28, 0], spine: [40, 8, 0], chest: [14, 14, 0], neck: [-30, 0, 0], shoulderR: [0, 12, -10], upperArmR: [-10, 0, -10], lowerArmR: [-90, 0, 0], upperArmL: [30, 0, 30], lowerArmL: [-60, 0, 0], upperLegL: [-60, 10, 6], lowerLegL: [40, 0, 0], upperLegR: [36, -10, -6], lowerLegR: [80, 0, 0], footR: [40, 0, 0] }),
      k(0.5, { pos: [0, -0.1, 0.06], upperLegR: [-60, -10, -6], lowerLegR: [40, 0, 0], footR: [0, 0, 0], upperLegL: [36, 10, 6], lowerLegL: [80, 0, 0], footL: [40, 0, 0] }),
    ],
  },
  bruiser_smash: {
    mode: 'move',
    base: BRUISER_STANCE,
    blend: 3,
    keys: [
      k(['S', 0], {}),
      k(['S', 0.85], { pos: [0, 0.02, -0.06], spine: [-16, 0, 0], chest: [-10, 0, 0], neck: [0, 0, 0], head: [-16, 0, 0], shoulderL: [0, 0, 20], shoulderR: [0, 0, -20], upperArmL: [-172, 0, -4], lowerArmL: [-40, 0, 0], upperArmR: [-172, 0, 4], lowerArmR: [-40, 0, 0], upperLegL: [-26, 12, 10], lowerLegL: [20, 0, 0] }, 'out'),
      k(['S', 1], { spine: [-18, 0, 0], upperArmL: [-176, 0, -4], upperArmR: [-176, 0, 4] }, 'linear'),
      k(['A', 0.4], { pos: [0, -0.22, 0.12], sq: 0.9, spine: [44, 0, 0], chest: [18, 0, 0], head: [10, 0, 0], shoulderL: [0, 0, 0], shoulderR: [0, 0, 0], upperArmL: [-60, 0, -10], lowerArmL: [-10, 0, 0], upperArmR: [-60, 0, 10], lowerArmR: [-10, 0, 0], upperLegL: [-50, 12, 10], lowerLegL: [80, 0, 0], upperLegR: [16, -12, -10], lowerLegR: [60, 0, 0] }, 'snap'),
      k(['A', 1], { pos: [0, -0.24, 0.12], sq: 1, spine: [48, 0, 0] }, 'out'),
      k(['R', 0.5], { pos: [0, -0.14, 0.06], spine: [24, 0, 0], upperArmL: [-40, 0, 14], upperArmR: [-40, 0, -14], lowerArmL: [-50, 0, 0], lowerArmR: [-50, 0, 0] }),
      k(['R', 1], { ...BRUISER_STANCE }),
    ],
  },
};

// ---------------------------------------------------------------------------
// IBIS (thrower): upright, wary.
// ---------------------------------------------------------------------------
const THROWER_STANCE: PoseSpec = {
  pos: [0, -0.02, 0],
  hips: [0, -10, 0],
  spine: [2, 0, 0],
  chest: [0, 4, 0],
  neck: [-12, 0, 0],
  head: [8, 6, 0],
  shoulderL: [0, 0, 0],
  shoulderR: [0, 0, 0],
  upperArmL: [-30, 0, 18],
  lowerArmL: [-60, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-20, 0, -20],
  lowerArmR: [-70, 0, 0],
  handR: [0, 0, 0],
  upperLegL: [-12, 10, 4],
  lowerLegL: [12, 0, 0],
  footL: [0, -6, 0],
  upperLegR: [8, -10, -4],
  lowerLegR: [8, 0, 0],
  footR: [2, 6, 0],
};

export const THROWER_CLIPS: Record<string, ClipSpec> = {
  idle: {
    mode: 'loop',
    length: 90,
    base: THROWER_STANCE,
    blend: 8,
    keys: [k(0, {}), k(0.5, { pos: [0, -0.035, 0], neck: [-8, 4, 0], head: [12, -4, 0], upperArmR: [-24, 0, -20], chest: [2, 6, 0] })],
  },
  walk: {
    mode: 'stride',
    length: 1.5,
    base: THROWER_STANCE,
    blend: 6,
    keys: [
      k(0, { pos: [0, -0.04, 0], upperLegL: [-26, 4, 2], lowerLegL: [10, 0, 0], footL: [-10, 0, 0], upperLegR: [20, -4, -2], lowerLegR: [18, 0, 0], footR: [14, 0, 0], upperArmL: [-10, 0, 18], upperArmR: [-34, 0, -20] }),
      k(0.25, { pos: [0, 0.0, 0], upperLegL: [-2, 4, 2], lowerLegL: [4, 0, 0], footL: [0, 0, 0], upperLegR: [-18, -4, -2], lowerLegR: [58, 0, 0], footR: [18, 0, 0] }),
      k(0.5, { pos: [0, -0.04, 0], upperLegR: [-26, -4, -2], lowerLegR: [10, 0, 0], footR: [-10, 0, 0], upperLegL: [20, 4, 2], lowerLegL: [18, 0, 0], footL: [14, 0, 0], upperArmL: [-34, 0, 18], upperArmR: [-10, 0, -20] }),
      k(0.75, { pos: [0, 0.0, 0], upperLegR: [-2, -4, -2], lowerLegR: [4, 0, 0], footR: [0, 0, 0], upperLegL: [-18, 4, 2], lowerLegL: [58, 0, 0], footL: [18, 0, 0] }),
    ],
  },
  thrower_lob: {
    mode: 'move',
    base: THROWER_STANCE,
    blend: 3,
    keys: [
      k(['S', 0], {}),
      // Reach down into the satchel...
      k(['S', 0.3], { pos: [0, -0.08, 0], spine: [16, 10, 0], chest: [6, 14, 0], upperArmR: [-4, 0, 16], lowerArmR: [-40, 0, 0], head: [16, 10, 0] }, 'out'),
      // ...and raise the jar high overhead, leaning back.
      k(['S', 0.85], { pos: [0, 0.0, -0.05], spine: [-14, -6, 0], chest: [-10, -16, 0], neck: [-6, 0, 0], head: [0, 0, 0], upperArmR: [-168, 0, -24], lowerArmR: [-70, 0, 0], upperArmL: [-80, 0, 26], lowerArmL: [-10, 0, 0], upperLegL: [-26, 10, 4], lowerLegL: [24, 0, 0] }, 'inOut'),
      k(['S', 1], { spine: [-16, -8, 0], upperArmR: [-172, 0, -26] }, 'linear'),
      k(['A', 1], { pos: [0, -0.05, 0.08], spine: [20, 8, 0], chest: [10, 20, 0], upperArmR: [-70, 0, 6], lowerArmR: [-8, 0, 0], upperArmL: [-20, 0, 18], lowerArmL: [-50, 0, 0] }, 'snap'),
      k(['R', 0.4], { spine: [12, 4, 0], upperArmR: [-40, 0, -6], lowerArmR: [-30, 0, 0] }, 'out'),
      k(['R', 1], { ...THROWER_STANCE }),
    ],
  },
  thrower_shove: {
    mode: 'move',
    base: THROWER_STANCE,
    blend: 2,
    keys: [
      k(['S', 0], {}),
      k(['S', 1], { pos: [0, -0.06, -0.04], spine: [-4, 0, 0], upperArmL: [-40, 0, 6], lowerArmL: [-126, 0, 0], upperArmR: [-40, 0, -6], lowerArmR: [-126, 0, 0] }, 'in'),
      k(['A', 0.4], { pos: [0, -0.08, 0.1], spine: [18, 0, 0], upperArmL: [-86, 0, -8], lowerArmL: [-6, 0, 0], upperArmR: [-86, 0, 8], lowerArmR: [-6, 0, 0], handL: [-40, 0, 0], handR: [-40, 0, 0] }, 'snap'),
      k(['R', 0.5], { pos: [0, -0.04, 0.03], spine: [6, 0, 0], upperArmL: [-40, 0, 14], lowerArmL: [-60, 0, 0], upperArmR: [-30, 0, -14], lowerArmR: [-70, 0, 0] }),
      k(['R', 1], { ...THROWER_STANCE }),
    ],
  },
};

// ---------------------------------------------------------------------------
// BASTET (acrobat): low, springy, always moving.
// ---------------------------------------------------------------------------
const ACRO_STANCE: PoseSpec = {
  pos: [0, -0.12, 0],
  hips: [4, -24, 0],
  spine: [16, 4, 0],
  chest: [6, 8, 0],
  neck: [-12, 4, 0],
  head: [-8, 8, 0],
  shoulderL: [0, 0, 0],
  shoulderR: [0, 0, 0],
  upperArmL: [-70, 0, 30],
  lowerArmL: [-30, 0, 0],
  handL: [20, 0, 0],
  upperArmR: [-20, 0, -40],
  lowerArmR: [-50, 0, 0],
  handR: [20, 0, 0],
  upperLegL: [-40, 14, 8],
  lowerLegL: [60, 0, 0],
  footL: [-10, -10, 0],
  upperLegR: [6, -12, -8],
  lowerLegR: [56, 0, 0],
  footR: [30, 10, 0],
};

export const ACROBAT_CLIPS: Record<string, ClipSpec> = {
  idle: {
    mode: 'loop',
    length: 36,
    base: ACRO_STANCE,
    blend: 6,
    keys: [k(0, {}), k(0.5, { pos: [0, -0.05, 0], upperLegL: [-30, 14, 8], lowerLegL: [40, 0, 0], lowerLegR: [40, 0, 0], footR: [36, 10, 0], upperArmL: [-76, 0, 30], upperArmR: [-26, 0, -40] }, 'inOut')],
  },
  walk: {
    mode: 'stride',
    length: 1.6,
    base: ACRO_STANCE,
    blend: 5,
    keys: [
      k(0, { pos: [0, -0.12, 0], upperLegL: [-46, 8, 4], lowerLegL: [40, 0, 0], footL: [-10, 0, 0], upperLegR: [20, -8, -4], lowerLegR: [50, 0, 0], footR: [30, 0, 0] }),
      k(0.25, { pos: [0, -0.02, 0], upperLegL: [-16, 8, 4], lowerLegL: [30, 0, 0], footL: [10, 0, 0], upperLegR: [-40, -8, -4], lowerLegR: [96, 0, 0], footR: [30, 0, 0] }),
      k(0.5, { pos: [0, -0.12, 0], upperLegR: [-46, -8, -4], lowerLegR: [40, 0, 0], footR: [-10, 0, 0], upperLegL: [20, 8, 4], lowerLegL: [50, 0, 0], footL: [30, 0, 0] }),
      k(0.75, { pos: [0, -0.02, 0], upperLegR: [-16, -8, -4], lowerLegR: [30, 0, 0], footR: [10, 0, 0], upperLegL: [-40, 8, 4], lowerLegL: [96, 0, 0], footL: [30, 0, 0] }),
    ],
  },
  acro_slide: {
    mode: 'move',
    base: ACRO_STANCE,
    blend: 3,
    keys: [
      k(['S', 0], {}),
      k(['S', 0.8], { pos: [0, -0.3, -0.04], hips: [16, -20, 0], spine: [30, 0, 0], upperLegL: [-80, 14, 8], lowerLegL: [130, 0, 0], upperLegR: [20, -12, -8], lowerLegR: [120, 0, 0], upperArmL: [-40, 0, 50], upperArmR: [30, 0, -50], head: [-24, 0, 0] }, 'out'),
      k(['S', 1], { pos: [0, -0.34, 0.02] }, 'linear'),
      k(['A', 0.1], { pos: [0, -0.58, 0.02], hips: [-46, 0, 0], spine: [-10, 0, 0], chest: [-6, 0, 0], neck: [20, 0, 0], head: [10, 0, 0], upperLegL: [-44, 0, 4], lowerLegL: [4, 0, 0], footL: [-20, 0, 0], upperLegR: [-10, 0, -8], lowerLegR: [130, 0, 0], upperArmL: [10, 0, 40], lowerArmL: [-10, 0, 0], upperArmR: [30, 0, -40], lowerArmR: [-10, 0, 0] }, 'snap'),
      k(['A', 1], { pos: [0, -0.58, 0.02] }),
      k(['R', 0.6], { pos: [0, -0.3, 0], hips: [10, -20, 0], spine: [24, 0, 0], chest: [6, 6, 0], neck: [-10, 0, 0], head: [-10, 0, 0], upperLegL: [-60, 14, 8], lowerLegL: [110, 0, 0], upperLegR: [10, -12, -8], lowerLegR: [100, 0, 0] }),
      k(['R', 1], { ...ACRO_STANCE }),
    ],
  },
  acro_flip: {
    mode: 'move',
    base: ACRO_STANCE,
    blend: 2,
    keys: [
      k(['R', 0], { pos: [0, -0.2, 0], upperLegL: [-60, 14, 8], lowerLegL: [100, 0, 0], upperLegR: [-10, -12, -8], lowerLegR: [100, 0, 0] }),
      k(['R', 0.12], { pos: [0, 0.1, 0], hips: [-80, 0, 0], spine: [-10, 0, 0], upperLegL: [-110, 0, 4], lowerLegL: [130, 0, 0], upperLegR: [-100, 0, -4], lowerLegR: [130, 0, 0], upperArmL: [-130, 0, 30], upperArmR: [-130, 0, -30] }, 'in'),
      k(['R', 0.3], { pos: [0, 0.3, 0], hips: [-220, 0, 0] }, 'linear'),
      k(['R', 0.5], { pos: [0, 0.1, 0], hips: [-340, 0, 0], upperLegL: [-50, 14, 8], lowerLegL: [70, 0, 0], upperLegR: [-20, -12, -8], lowerLegR: [70, 0, 0], upperArmL: [-90, 0, 40], upperArmR: [-60, 0, -40] }, 'out'),
      k(['R', 0.62], { pos: [0, -0.1, 0], hips: [-356, -24, 0] }, 'out'),
      k(['R', 1], { pos: [0, -0.12, 0], hips: [-356, -24, 0] }),
    ],
  },
  acro_kick: {
    mode: 'move',
    base: ACRO_STANCE,
    blend: 2,
    keys: [
      k(['S', 0], {}),
      k(['S', 0.9], { pos: [0, -0.06, -0.02], hips: [0, 50, 0], spine: [6, 20, 0], chest: [0, 20, 0], head: [-6, -40, 0], upperLegR: [-50, 0, 0], lowerLegR: [110, 0, 0], upperLegL: [-10, 14, 8], lowerLegL: [20, 0, 0] }, 'out'),
      k(['A', 0.3], { pos: [0, -0.02, 0.06], hips: [-10, 90, -10], spine: [-10, 10, -10], chest: [-6, 10, 0], upperLegR: [-88, 30, 0], lowerLegR: [4, 0, 0], footR: [-10, 0, 0], upperArmL: [-40, 0, 60], upperArmR: [20, 0, -40] }, 'snap'),
      k(['A', 1], { upperLegR: [-92, 30, 0] }, 'out'),
      k(['R', 0.5], { hips: [0, 20, 0], spine: [10, 4, 0], chest: [4, 6, 0], head: [-8, 0, 0], upperLegR: [-40, -12, -8], lowerLegR: [80, 0, 0] }),
      k(['R', 1], { ...ACRO_STANCE }),
    ],
  },
  land: {
    mode: 'norm',
    base: ACRO_STANCE,
    blend: 2,
    keys: [
      k(0, { pos: [0, -0.34, 0.02], sq: 0.86, hips: [10, -24, 0], spine: [34, 4, 0], upperLegL: [-80, 14, 8], lowerLegL: [124, 0, 0], upperLegR: [0, -12, -8], lowerLegR: [120, 0, 0], upperArmL: [-40, 0, 50], upperArmR: [-10, 0, -50] }),
      k(0.6, { pos: [0, -0.26, 0], sq: 0.98 }, 'out'),
      k(1, { ...ACRO_STANCE }),
    ],
  },
};
