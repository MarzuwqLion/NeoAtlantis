/**
 * CharacterVisual: the boundary between gameplay and visuals.
 *
 * Gameplay only ever hands a character a *logical clip name* plus the timing
 * the simulation dictates (frame / normalised length / move phases) and a few
 * presentation flags (facing, flash, fade, telegraph glow, held weapon).
 * The code-built implementation below poses a procedural rig; a rigged GLB
 * implementation could implement the same interface (mapping clip names to
 * AnimationActions) without any gameplay change.
 */
import * as THREE from 'three';
import type { WeaponType } from '../../sim/types';
import type { MoveDef } from '../../data/defs';
import { getPalette, MODEL_BUILDERS } from './models';
import { hipHeight, JOINTS, type CharacterModel, type MatKey } from './rig';
import { characterGlow, characterOutline, characterStandard, createCharacterUniforms, type CharacterUniforms } from '../materials';
import { Animator } from '../anim/Animator';
import { getClipLibrary } from '../anim/library';
import { SpringChainSim } from '../anim/springs';
import { createWeaponMesh, jarGroup } from './weapons';

export interface ClipRequest {
  clip: string;
  /** Interpolated clip frame (frames / move clips). */
  frame: number;
  /** Duration of normalised clips. */
  len: number;
  move: MoveDef | null;
  /** Force a crossfade length (frames), or -1 for the clip default. */
  blend?: number;
}

export interface CharacterVisual {
  readonly object: THREE.Object3D;
  readonly model: string;
  readonly palette: string;
  /** Logical clip names in, visuals out. */
  play(req: ClipRequest, dt: number): void;
  setTransform(x: number, y: number, z: number, facing: 1 | -1, dt: number, snap?: boolean): void;
  setFlash(v: number): void;
  setFade(v: number): void;
  setGlow(v: number): void;
  setRim(color: THREE.Color, strength: number): void;
  setWeapon(type: WeaponType | null): void;
  setProp(visible: boolean): void;
  /** Extra shake offset (hitstop jitter) in metres. */
  setShake(x: number, y: number): void;
  hasClip(name: string): boolean;
  clipNames(): string[];
  boneWorldPosition(name: string, out: THREE.Vector3): THREE.Vector3;
  /** Weapon blade tip / base in world space (for trails). Returns false when no blade. */
  bladePoints(base: THREE.Vector3, tip: THREE.Vector3): boolean;
  resetSecondary(): void;
  dispose(): void;
}

/** Yaw that keeps the character profile-on but cheats a little toward the camera. */
const FACE_CHEAT = (14 * Math.PI) / 180;

export class CodeCharacter implements CharacterVisual {
  readonly object = new THREE.Group();
  readonly uniforms: CharacterUniforms;
  private readonly rig: CharacterModel;
  private readonly animator: Animator;
  private readonly springs: SpringChainSim[];
  private readonly bones: THREE.Bone[];
  private readonly hipsRest = new THREE.Vector3();
  private readonly posScale: number;
  private readonly materials: THREE.Material[] = [];
  private weaponType: WeaponType | null = null;
  private weaponMesh: THREE.Object3D | null = null;
  private prop: THREE.Object3D | null = null;
  private yaw = FACE_CHEAT;
  private dist = 0;
  private lastX = 0;
  private lastZ = 0;
  private facing: 1 | -1 = 1;
  private readonly shakeOffset = new THREE.Vector2();
  private readonly builtinBlades: boolean;

  constructor(
    readonly model: string,
    readonly palette: string,
  ) {
    const pal = getPalette(model, palette);
    const build = MODEL_BUILDERS[model];
    if (!build) throw new Error(`Unknown model ${model}`);
    this.uniforms = createCharacterUniforms();
    const u = this.uniforms;
    // Telegraph / power glow: warning orange, violet for the Serpent Pharaoh.
    if (model === 'apep') u.uGlowColor.value.setRGB(0.75, 0.35, 1.0);
    const mats: Record<MatKey, THREE.Material> = {
      matte: characterStandard({ roughness: 0.72, metalness: 0.02 }, u),
      metal: characterStandard({ roughness: 0.28, metalness: 0.92 }, u),
      gloss: characterStandard({ roughness: 0.32, metalness: 0.18 }, u),
      glow: characterGlow(2.4, u),
    };
    const outline = characterOutline(model === 'sobekhan' ? 0.022 : 0.014, 0x07080c, u);
    this.materials.push(...Object.values(mats), outline);
    const rb = build(pal);
    this.rig = rb.build(mats, outline);
    this.bones = JOINTS.map((j) => this.rig.bones[j]);
    this.hipsRest.copy(this.rig.bones.hips.position);
    this.posScale = hipHeight(this.rig.proportions) / 0.96;
    this.object.add(this.rig.root);
    this.animator = new Animator(getClipLibrary(model));
    this.springs = this.rig.chains.map((c) => new SpringChainSim(c));
    this.builtinBlades = model === 'apep';
    this.object.name = `char:${model}`;
  }

  get height(): number {
    return this.rig.height;
  }

  hasClip(name: string): boolean {
    return this.animator.has(name);
  }

  clipNames(): string[] {
    return this.animator.clipNames();
  }

  play(req: ClipRequest, dt: number): void {
    let clip = req.clip;
    if (this.weaponType && this.animator.has(`${clip}_wpn`)) clip = `${clip}_wpn`;
    this.animator.update(clip, { frame: req.frame, len: req.len, dist: this.dist, move: req.move }, dt, req.blend ?? -1);
    this.animator.apply(this.bones, this.hipsRest, this.rig.root, 1, this.posScale);
    this.rig.root.position.set(this.shakeOffset.x, this.shakeOffset.y, 0);
    this.object.updateMatrixWorld(true);
    for (const s of this.springs) s.update(dt);
  }

  setTransform(x: number, y: number, z: number, facing: 1 | -1, dt: number, snap = false): void {
    // Stride distance: forward travel advances the walk cycle, backward travel reverses it.
    const dx = x - this.lastX;
    const dz = z - this.lastZ;
    if (!snap) {
      const along = dx * facing;
      const side = Math.abs(dz);
      this.dist += Math.abs(along) > side * 0.5 ? along + Math.sign(along) * side * 0.5 : side;
    }
    this.lastX = x;
    this.lastZ = z;
    this.object.position.set(x, y, z);
    const target = facing === 1 ? Math.PI / 2 - FACE_CHEAT : -Math.PI / 2 + FACE_CHEAT;
    if (snap || this.facing === facing) {
      this.yaw = snap ? target : this.yaw + (target - this.yaw) * Math.min(1, dt * 30);
    } else {
      this.yaw += (target - this.yaw) * Math.min(1, dt * 30);
    }
    if (Math.abs(target - this.yaw) < 0.002) this.yaw = target;
    this.facing = facing;
    this.object.rotation.y = this.yaw;
  }

  setShake(x: number, y: number): void {
    this.shakeOffset.set(x, y);
  }

  setFlash(v: number): void {
    this.uniforms.uFlash.value = v;
  }

  setFade(v: number): void {
    this.uniforms.uFade.value = v;
    this.object.visible = v > 0.01;
  }

  setGlow(v: number): void {
    this.uniforms.uGlow.value = v;
  }

  setRim(color: THREE.Color, strength: number): void {
    this.uniforms.uRimColor.value.copy(color);
    this.uniforms.uRimStrength.value = strength;
  }

  setWeapon(type: WeaponType | null): void {
    if (this.builtinBlades) return;
    if (type === this.weaponType) return;
    if (this.weaponMesh) {
      this.weaponMesh.removeFromParent();
      this.weaponMesh = null;
    }
    this.weaponType = type;
    if (type) {
      this.weaponMesh = createWeaponMesh(type);
      this.rig.bones.handR.add(this.weaponMesh);
    }
  }

  setProp(visible: boolean): void {
    if (visible && !this.prop) {
      this.prop = jarGroup();
      this.prop.position.set(0, -0.2, 0.08);
      this.rig.bones.handR.add(this.prop);
    }
    if (this.prop) this.prop.visible = visible;
  }

  boneWorldPosition(name: string, out: THREE.Vector3): THREE.Vector3 {
    const b = this.rig.boneMap.get(name);
    if (!b) return out.copy(this.object.position);
    return b.getWorldPosition(out);
  }

  private static readonly _v = new THREE.Vector3();

  bladePoints(base: THREE.Vector3, tip: THREE.Vector3): boolean {
    const hand = this.rig.bones.handR;
    let len = 0;
    if (this.builtinBlades) len = 0.62;
    else if (this.weaponType === 'khopesh') len = 0.62;
    else if (this.weaponType === 'staff') len = 1.5;
    if (len === 0) return false;
    // Blade runs along the hand's +Z (tilted by the grip) away from the fist.
    const v = CodeCharacter._v;
    v.set(0, -0.07 + 0.2 * 0.34, 0.2 * 0.94);
    base.copy(v);
    hand.localToWorld(base);
    v.set(0, -0.07 + len * 0.3, len * 0.9);
    tip.copy(v);
    hand.localToWorld(tip);
    return true;
  }

  /** Drive the stride cycle directly (animation viewer). */
  overrideTravel(d: number): void {
    this.dist = d;
  }

  resetSecondary(): void {
    for (const s of this.springs) s.reset();
    this.dist = 0;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
