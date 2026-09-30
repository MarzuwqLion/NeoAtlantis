/**
 * Environment view contract and per-environment look (lighting, fog, grade).
 */
import type * as THREE from 'three';
import type { SimEvent, World } from '../../sim/types';
import type { EnvMapOptions } from '../envmap';
import type { Effects } from '../fx/Effects';

export type V3 = [number, number, number];

export interface Lamp {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
  /** 0 = steady, >0 = torch-like flicker amount. */
  flicker?: number;
}

export interface EnvLook {
  background: number;
  fog: { color: number; density: number };
  hemi: { sky: number; ground: number; intensity: number };
  key: { color: number; intensity: number; dir: V3 };
  fill: { color: number; intensity: number; dir: V3 };
  rim: { color: number; strength: number };
  caustics: { color: number; strength: number; scale: number; speed: number };
  grade: {
    exposure: number;
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    saturation: number;
    contrast: number;
    vignette: number;
    lift: number;
    gamma: number;
    gain: number;
    tint: number;
  };
  envMap: EnvMapOptions;
  dust: number;
  accent: number;
  lamps: Lamp[];
  shadowStrength: number;
}

export interface EnvUpdate {
  time: number;
  dt: number;
  camX: number;
  world: World;
  fx: Effects;
}

export interface EnvironmentView {
  readonly group: THREE.Group;
  readonly look: EnvLook;
  update(u: EnvUpdate): void;
  onEvent(e: SimEvent, w: World): void;
  dispose(): void;
}
