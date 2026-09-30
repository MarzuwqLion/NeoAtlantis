/**
 * Plays logical clips on a joint rig: samples the clip at the time the
 * simulation dictates, crossfades from the previous output when the clip
 * changes, and writes joint rotations / hips offset / squash to the bones.
 */
import * as THREE from 'three';
import type { MoveDef } from '../../data/defs';
import { JOINTS } from '../characters/rig';
import type { ClipLibrary, CompiledClip } from './pose';
import { emptyPose, lerpPose, POS, POSE_SIZE, sampleClip, SQ } from './pose';

const DEG = Math.PI / 180;

export interface ClipTime {
  /** Interpolated frame counter of the clip (frames / move modes). */
  frame: number;
  /** Duration for normalised clips. */
  len: number;
  /** Distance travelled (stride clips). */
  dist: number;
  move: MoveDef | null;
}

export class Animator {
  readonly out = emptyPose();
  private readonly cur = emptyPose();
  private readonly from = emptyPose();
  private clip: CompiledClip | null = null;
  private clipName = '';
  private lastTime = 0;
  private blendT = 0;
  private blendLen = 0;
  /** Extra pose layered on top (hit shake, lean), in degrees. */
  readonly additive = new Float32Array(POSE_SIZE);

  constructor(private readonly lib: ClipLibrary, private readonly fallback = 'idle') {}

  has(name: string): boolean {
    return this.lib.has(name);
  }

  clipNames(): string[] {
    return [...this.lib.keys()];
  }

  /** Normalised clip time for the clip mode. */
  private timeFor(c: CompiledClip, t: ClipTime): number {
    switch (c.mode) {
      case 'move':
      case 'frames':
        return t.frame;
      case 'norm':
        return t.frame / Math.max(1, t.len);
      case 'loop':
        return (((t.frame / c.length) % 1) + 1) % 1;
      case 'stride':
        return (((t.dist / c.length) % 1) + 1) % 1;
    }
  }

  update(name: string, t: ClipTime, dt: number, forceBlend = -1): void {
    let clip = this.lib.get(name);
    if (!clip) clip = this.lib.get(this.fallback)!;
    const time = this.timeFor(clip, t);
    sampleClip(clip, time, this.cur, t.move);
    let restart = false;
    if (clip !== this.clip) {
      this.blendLen = forceBlend >= 0 ? forceBlend : clip.blend;
      this.clip = clip;
      this.clipName = name;
      restart = true;
    } else if ((clip.mode === 'move' || clip.mode === 'norm' || clip.mode === 'frames') && time + 1e-6 < this.lastTime - (clip.mode === 'norm' ? 0.2 : 2)) {
      // Same clip restarted (e.g. a new hit reaction): short re-blend so it doesn't pop.
      this.blendLen = Math.min(2, clip.blend);
      restart = true;
    }
    if (restart) {
      this.from.set(this.out);
      this.blendT = 0;
      // Wrap rotations so blends take the short way round (flips and spins end at ±360).
      for (let i = 0; i < POS; i++) {
        let d = this.from[i]! - this.cur[i]!;
        while (d > 180) {
          this.from[i] = this.from[i]! - 360;
          d -= 360;
        }
        while (d < -180) {
          this.from[i] = this.from[i]! + 360;
          d += 360;
        }
      }
    }
    this.lastTime = time;
    if (this.blendT < this.blendLen) {
      this.blendT += dt * 60;
      const u = Math.min(1, this.blendT / this.blendLen);
      const w = 1 - (1 - u) * (1 - u);
      lerpPose(this.from, this.cur, w, this.out);
    } else {
      this.out.set(this.cur);
    }
  }

  get currentClip(): string {
    return this.clipName;
  }

  /** Write the pose to the bones. `hipsRest` is the hips bone rest position. */
  apply(bones: THREE.Bone[], hipsRest: THREE.Vector3, root: THREE.Object3D, squashScale = 1, posScale = 1): void {
    const o = this.out;
    const a = this.additive;
    for (let i = 0; i < JOINTS.length; i++) {
      const b = bones[i]!;
      b.rotation.set((o[i * 3]! + a[i * 3]!) * DEG, (o[i * 3 + 1]! + a[i * 3 + 1]!) * DEG, (o[i * 3 + 2]! + a[i * 3 + 2]!) * DEG);
    }
    const hips = bones[0]!;
    hips.position.set(hipsRest.x + (o[POS]! + a[POS]!) * posScale, hipsRest.y + (o[POS + 1]! + a[POS + 1]!) * posScale, hipsRest.z + (o[POS + 2]! + a[POS + 2]!) * posScale);
    const sq = 1 + (o[SQ]! - 1) * squashScale;
    const inv = 1 / Math.sqrt(Math.max(0.2, sq));
    root.scale.set(inv, sq, inv);
  }
}
