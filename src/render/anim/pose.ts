/**
 * Pose-keyframe animation data.
 *
 * A pose is joint rotations (Euler XYZ, degrees) plus a hips offset and a
 * squash factor. A clip is a list of keyed poses with per-segment easing.
 * Keys only need to list what changes: every key inherits the rest of its
 * pose from the previous key (the first from the clip's base pose).
 *
 * Clip timing modes:
 *   move    keys at [phase, fraction] with phase S(tartup) / A(ctive) / R(ecovery);
 *           placed against the move's frame data, so the move owns the timing.
 *   norm    keys at 0..1 of the state's duration (hitstun, getup, jump arc …)
 *   loop    keys at 0..1 of a `length`-frame cycle
 *   stride  keys at 0..1 of a cycle driven by distance travelled (`length` metres)
 *   frames  keys at absolute frames
 *
 * Conventions (character space: +Z forward, +Y up, +X = character's left):
 *   hips / spine / chest / neck / head:  X+ bends forward, Y+ turns to own left, Z+ leans to own right
 *   upper arms / legs (hang along -Y):   X- swings forward, X+ swings back
 *                                        Z+ moves the limb toward +X (left arm out / right arm in)
 *   elbows (lowerArm):                   X- flexes;   knees (lowerLeg): X+ flexes
 *   feet:                                X+ points toes down
 */
import type { MoveDef } from '../../data/defs';
import { JOINTS, JOINT_INDEX, type JointName } from '../characters/rig';

export type Vec3 = [number, number, number];
export type PoseSpec = Partial<Record<JointName, Vec3>> & { pos?: Vec3; sq?: number };
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'snap' | 'back' | 'hold';
export type Phase = 'S' | 'A' | 'R';
export type KeyTime = number | [Phase, number];
export interface KeySpec {
  t: KeyTime;
  p: PoseSpec;
  e?: Ease;
}
export type ClipMode = 'loop' | 'norm' | 'frames' | 'move' | 'stride';
export interface ClipSpec {
  mode: ClipMode;
  /** loop: frames per cycle; stride: metres per cycle; frames: total frames. */
  length?: number;
  keys: KeySpec[];
  /** Base pose the first key builds on. */
  base?: PoseSpec;
  /** Crossfade frames when entering this clip. */
  blend?: number;
}

export const POSE_SIZE = JOINTS.length * 3 + 4;
export const POS = JOINTS.length * 3;
export const SQ = POS + 3;

export interface CompiledClip {
  name: string;
  mode: ClipMode;
  length: number;
  times: KeyTime[];
  poses: Float32Array[];
  eases: Ease[];
  blend: number;
}

export function emptyPose(): Float32Array {
  const p = new Float32Array(POSE_SIZE);
  p[SQ] = 1;
  return p;
}

export function applySpec(target: Float32Array, spec: PoseSpec): void {
  for (const k in spec) {
    if (k === 'pos') {
      const v = spec.pos!;
      target[POS] = v[0];
      target[POS + 1] = v[1];
      target[POS + 2] = v[2];
    } else if (k === 'sq') {
      target[SQ] = spec.sq!;
    } else {
      const i = JOINT_INDEX[k as JointName];
      if (i === undefined) throw new Error(`Unknown joint in pose: ${k}`);
      const v = spec[k as JointName]!;
      target[i * 3] = v[0];
      target[i * 3 + 1] = v[1];
      target[i * 3 + 2] = v[2];
    }
  }
}

/** Mirror a pose spec left <-> right (for alternating cycles). */
export function mirror(spec: PoseSpec): PoseSpec {
  const out: PoseSpec = {};
  for (const k in spec) {
    if (k === 'pos') {
      const v = spec.pos!;
      out.pos = [-v[0], v[1], v[2]];
    } else if (k === 'sq') {
      out.sq = spec.sq!;
    } else {
      const v = spec[k as JointName]!;
      let name = k;
      if (k.endsWith('L')) name = `${k.slice(0, -1)}R`;
      else if (k.endsWith('R')) name = `${k.slice(0, -1)}L`;
      out[name as JointName] = [v[0], -v[1], -v[2]];
    }
  }
  return out;
}

/** Compile a clip: resolve every key against the previous one (carry-forward) into full poses. */
export function compile(name: string, spec: ClipSpec): CompiledClip {
  const poses: Float32Array[] = [];
  const times: KeyTime[] = [];
  const eases: Ease[] = [];
  const cur = emptyPose();
  if (spec.base) applySpec(cur, spec.base);
  for (const k of spec.keys) {
    applySpec(cur, k.p);
    poses.push(cur.slice());
    times.push(k.t);
    eases.push(k.e ?? 'inOut');
  }
  const cyclic = spec.mode === 'loop' || spec.mode === 'stride';
  if (cyclic) {
    const last = times[times.length - 1];
    if (typeof last === 'number' && last < 1) {
      poses.push(poses[0]!.slice());
      times.push(1);
      eases.push('inOut');
    }
  }
  return {
    name,
    mode: spec.mode,
    length: spec.length ?? 60,
    times,
    poses,
    eases,
    blend: spec.blend ?? (spec.mode === 'move' ? 2 : 6),
  };
}

export function ease(e: Ease, u: number): number {
  switch (e) {
    case 'linear':
      return u;
    case 'in':
      return u * u;
    case 'out':
      return 1 - (1 - u) * (1 - u);
    case 'inOut':
      return u * u * (3 - 2 * u);
    case 'snap':
      return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
    case 'back': {
      const c1 = 1.9;
      const c3 = c1 + 1;
      const v = u - 1;
      return 1 + c3 * v * v * v + c1 * v * v;
    }
    case 'hold':
      return u >= 1 ? 1 : 0;
  }
}

const resolved: number[] = [];

function resolveTimes(c: CompiledClip, move: MoveDef | null): number[] {
  resolved.length = c.times.length;
  for (let i = 0; i < c.times.length; i++) {
    const t = c.times[i]!;
    if (typeof t === 'number') {
      resolved[i] = t;
    } else if (move) {
      const [ph, f] = t;
      const s = move.startup;
      const a = move.active;
      const r = move.recovery;
      resolved[i] = ph === 'S' ? f * s : ph === 'A' ? s + f * a : s + a + f * r;
    } else {
      // Without frame data, assume a generic 10/4/14 split.
      const [ph, f] = t;
      resolved[i] = ph === 'S' ? f * 10 : ph === 'A' ? 10 + f * 4 : 14 + f * 14;
    }
  }
  return resolved;
}

/** Sample a clip at `time` (units depend on the clip mode) into `out`. */
export function sampleClip(c: CompiledClip, time: number, out: Float32Array, move: MoveDef | null = null): void {
  const times = resolveTimes(c, move);
  const n = times.length;
  if (n === 1 || time <= times[0]!) {
    out.set(c.poses[0]!);
    return;
  }
  if (time >= times[n - 1]!) {
    out.set(c.poses[n - 1]!);
    return;
  }
  let i = 0;
  while (i < n - 2 && time >= times[i + 1]!) i++;
  const t0 = times[i]!;
  const t1 = times[i + 1]!;
  const u = t1 > t0 ? (time - t0) / (t1 - t0) : 1;
  const w = ease(c.eases[i + 1]!, Math.min(1, Math.max(0, u)));
  const a = c.poses[i]!;
  const b = c.poses[i + 1]!;
  for (let k = 0; k < POSE_SIZE; k++) out[k] = a[k]! + (b[k]! - a[k]!) * w;
}

export function lerpPose(a: Float32Array, b: Float32Array, w: number, out: Float32Array): void {
  for (let k = 0; k < POSE_SIZE; k++) out[k] = a[k]! + (b[k]! - a[k]!) * w;
}

export type ClipLibrary = Map<string, CompiledClip>;

export function compileLibrary(specs: Record<string, ClipSpec>): ClipLibrary {
  const lib: ClipLibrary = new Map();
  for (const [name, spec] of Object.entries(specs)) lib.set(name, compile(name, spec));
  return lib;
}
