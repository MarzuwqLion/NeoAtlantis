/**
 * Deterministic RNG (mulberry32). Its state lives in the World so the
 * simulation replays identically from the same seed and inputs.
 */
import type { World } from './types';

export function random(w: World): number {
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(w: World, a: number, b: number): number {
  return a + (b - a) * random(w);
}

/** Integer in [a, b] inclusive. */
export function randInt(w: World, a: number, b: number): number {
  return Math.min(b, Math.floor(a + (b - a + 1) * random(w)));
}

export function chance(w: World, p: number): boolean {
  return random(w) < p;
}

export function pickSign(w: World): 1 | -1 {
  return random(w) < 0.5 ? -1 : 1;
}
