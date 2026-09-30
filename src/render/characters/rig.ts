/**
 * Hierarchical joint rig and the builder that turns authored pieces into a
 * handful of rigidly-skinned meshes (one per material) sharing one skeleton.
 *
 * Character local space: +Z forward, +Y up, +X is the character's LEFT.
 * Limbs hang along -Y from their joint; spine / neck / head extend along +Y.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { V3 } from './shapes';
import { matrixOf, type XForm } from './shapes';

export const JOINTS = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'upperArmL',
  'lowerArmL',
  'handL',
  'shoulderR',
  'upperArmR',
  'lowerArmR',
  'handR',
  'upperLegL',
  'lowerLegL',
  'footL',
  'upperLegR',
  'lowerLegR',
  'footR',
] as const;

export type JointName = (typeof JOINTS)[number];
export const JOINT_INDEX: Record<JointName, number> = Object.fromEntries(JOINTS.map((j, i) => [j, i])) as Record<JointName, number>;

export interface Proportions {
  /** Hip joint height above the ground at rest. Derived: legs + ankle + 0.02. */
  upperLeg: number;
  lowerLeg: number;
  ankle: number;
  hipW: number;
  /** hips → spine */
  pelvis: number;
  /** spine → chest */
  spine: number;
  /** chest → neck */
  chest: number;
  /** neck → head */
  neck: number;
  /** Shoulder joint half-width and height below the neck joint. */
  shoulderW: number;
  shoulderDrop: number;
  upperArm: number;
  lowerArm: number;
}

export function hipHeight(p: Proportions): number {
  return p.upperLeg + p.lowerLeg + p.ankle + 0.02;
}

export type MatKey = 'matte' | 'metal' | 'gloss' | 'glow';

export interface SpringParams {
  stiffness: number;
  damping: number;
  gravity: number;
}

export interface ChainDef {
  name: string;
  bones: THREE.Bone[];
  lengths: number[];
  /** Rest direction of each segment in its parent's local space. */
  restDirs: THREE.Vector3[];
  params: SpringParams;
}

interface Piece {
  geometry: THREE.BufferGeometry;
  mat: MatKey;
  /** Either a single bone (rigid) or per-vertex weights (strips). */
  bone: number;
  color: THREE.Color;
  /** Optional vertical colour gradient (bottom colour). */
  colorBottom?: THREE.Color;
  outline: boolean;
  weights?: { index: Float32Array; weight: Float32Array };
}

export interface CharacterModel {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  bones: Record<JointName, THREE.Bone>;
  /** Every bone by name, including spring-chain bones. */
  boneMap: Map<string, THREE.Bone>;
  meshes: Partial<Record<MatKey, THREE.SkinnedMesh>>;
  outline: THREE.SkinnedMesh | null;
  chains: ChainDef[];
  proportions: Proportions;
  height: number;
}

export class RigBuilder {
  readonly root = new THREE.Group();
  readonly bones = {} as Record<JointName, THREE.Bone>;
  readonly boneMap = new Map<string, THREE.Bone>();
  private readonly boneList: THREE.Bone[] = [];
  private readonly pieces: Piece[] = [];
  private readonly chains: ChainDef[] = [];

  constructor(readonly p: Proportions) {
    const hh = hipHeight(p);
    const mk = (name: string, parent: THREE.Object3D, pos: V3): THREE.Bone => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(pos[0], pos[1], pos[2]);
      parent.add(b);
      this.boneMap.set(name, b);
      this.boneList.push(b);
      return b;
    };
    const B = this.bones;
    B.hips = mk('hips', this.root, [0, hh, 0]);
    B.spine = mk('spine', B.hips, [0, p.pelvis, 0]);
    B.chest = mk('chest', B.spine, [0, p.spine, 0]);
    B.neck = mk('neck', B.chest, [0, p.chest, 0]);
    B.head = mk('head', B.neck, [0, p.neck, 0]);
    for (const side of ['L', 'R'] as const) {
      const s = side === 'L' ? 1 : -1;
      const sh = mk(`shoulder${side}`, B.chest, [s * p.shoulderW * 0.32, p.chest - p.shoulderDrop, 0]);
      const ua = mk(`upperArm${side}`, sh, [s * p.shoulderW * 0.68, 0, 0]);
      const la = mk(`lowerArm${side}`, ua, [0, -p.upperArm, 0]);
      const hd = mk(`hand${side}`, la, [0, -p.lowerArm, 0]);
      const ul = mk(`upperLeg${side}`, B.hips, [s * p.hipW, -0.02, 0]);
      const ll = mk(`lowerLeg${side}`, ul, [0, -p.upperLeg, 0]);
      const ft = mk(`foot${side}`, ll, [0, -p.lowerLeg, 0]);
      B[`shoulder${side}`] = sh;
      B[`upperArm${side}`] = ua;
      B[`lowerArm${side}`] = la;
      B[`hand${side}`] = hd;
      B[`upperLeg${side}`] = ul;
      B[`lowerLeg${side}`] = ll;
      B[`foot${side}`] = ft;
    }
  }

  private boneIndex(name: string): number {
    const b = this.boneMap.get(name);
    if (!b) throw new Error(`Unknown bone ${name}`);
    return this.boneList.indexOf(b);
  }

  /**
   * Add a rigid piece. The geometry is authored in the bone's local space
   * (optionally transformed by `t`).
   */
  add(bone: string, geometry: THREE.BufferGeometry, mat: MatKey, color: THREE.ColorRepresentation, t?: XForm, opts: { bottom?: THREE.ColorRepresentation; outline?: boolean } = {}): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    if (t) g.applyMatrix4(matrixOf(t));
    this.pieces.push({
      geometry: g,
      mat,
      bone: this.boneIndex(bone),
      color: new THREE.Color(color),
      colorBottom: opts.bottom !== undefined ? new THREE.Color(opts.bottom) : undefined,
      outline: opts.outline ?? mat !== 'glow',
    });
    return this;
  }

  /**
   * Add the same piece to both sides; geometry is authored for the LEFT side
   * (+X) and mirrored for the right. Limb pairs go on the L/R bones; for a
   * centre bone (e.g. the head) both copies go on that bone.
   */
  addPair(boneBase: string, make: () => THREE.BufferGeometry, mat: MatKey, color: THREE.ColorRepresentation, t?: XForm, opts: { bottom?: THREE.ColorRepresentation; outline?: boolean } = {}): this {
    const sided = this.boneMap.has(`${boneBase}L`);
    this.add(sided ? `${boneBase}L` : boneBase, make(), mat, color, t, opts);
    const g = make();
    if (t) g.applyMatrix4(matrixOf(t));
    g.scale(-1, 1, 1);
    flipWinding(g);
    this.add(sided ? `${boneBase}R` : boneBase, g, mat, color, undefined, opts);
    return this;
  }

  /**
   * Spring chain of `count` bones hanging from `parent` at `offset`, each
   * segment `segLen` long along `dir` (parent-local rest direction).
   */
  chain(name: string, parent: string, offset: V3, count: number, segLen: number, dir: V3, params: SpringParams): string[] {
    const parentBone = this.boneMap.get(parent)!;
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const names: string[] = [];
    const bones: THREE.Bone[] = [];
    let prev: THREE.Object3D = parentBone;
    for (let i = 0; i < count; i++) {
      const b = new THREE.Bone();
      b.name = `${name}${i}`;
      if (i === 0) b.position.set(offset[0], offset[1], offset[2]);
      else b.position.copy(d).multiplyScalar(segLen);
      prev.add(b);
      this.boneMap.set(b.name, b);
      this.boneList.push(b);
      names.push(b.name);
      bones.push(b);
      prev = b;
    }
    // Terminal bone so the last segment has an end point.
    this.chains.push({
      name,
      bones,
      lengths: bones.map(() => segLen),
      restDirs: bones.map(() => d.clone()),
      params,
    });
    return names;
  }

  /**
   * A cloth strip skinned smoothly along a chain. `width(t)` tapers it,
   * `thick` gives it a little body. Lies across the chain's local X axis unless `across` says otherwise.
   */
  strip(chainName: string, width: (t: number) => number, thick: number, mat: MatKey, color: THREE.ColorRepresentation, opts: { bottom?: THREE.ColorRepresentation; across?: V3; rows?: number; outline?: boolean } = {}): this {
    const ch = this.chains.find((c) => c.name === chainName);
    if (!ch) throw new Error(`Unknown chain ${chainName}`);
    this.root.updateMatrixWorld(true);
    const n = ch.bones.length;
    const seg = ch.lengths[0]!;
    const rows = opts.rows ?? n * 3;
    const across = new THREE.Vector3(...(opts.across ?? [1, 0, 0])).normalize();
    const dir = ch.restDirs[0]!.clone();
    const normal = new THREE.Vector3().crossVectors(across, dir).normalize();
    const firstWorld = new THREE.Vector3();
    ch.bones[0]!.getWorldPosition(firstWorld);
    // Chain direction in world space (rest) = parent world rotation * dir.
    const parentQ = new THREE.Quaternion();
    ch.bones[0]!.parent!.getWorldQuaternion(parentQ);
    const wDir = dir.clone().applyQuaternion(parentQ);
    const wAcross = across.clone().applyQuaternion(parentQ);
    const wNormal = normal.clone().applyQuaternion(parentQ);
    const pos: number[] = [];
    const nor: number[] = [];
    const si: number[] = [];
    const sw: number[] = [];
    const total = seg * n;
    const first = this.boneIndex(ch.bones[0]!.name);
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const s = t * total;
      const w = width(t) / 2;
      const center = firstWorld.clone().addScaledVector(wDir, s);
      const bi = Math.min(n - 1, Math.floor(s / seg));
      const f = Math.min(1, s / seg - bi);
      const b0 = first + bi;
      const b1 = first + Math.min(n - 1, bi + 1);
      for (const side of [-1, 1]) {
        for (const face of [-1, 1]) {
          const p = center.clone().addScaledVector(wAcross, side * w).addScaledVector(wNormal, (face * thick) / 2);
          pos.push(p.x, p.y, p.z);
          nor.push(wNormal.x * face, wNormal.y * face, wNormal.z * face);
          si.push(b0, b1, 0, 0);
          sw.push(1 - f * 0.999, f * 0.999, 0, 0);
        }
      }
    }
    // Triangles: two faces (front/back), 4 verts per row: [L-back, L-front, R-back, R-front]
    const idx: number[] = [];
    for (let r = 0; r < rows; r++) {
      const a = r * 4;
      const b = (r + 1) * 4;
      // Front face (normal = +N = across x dir): verts 1 (L) and 3 (R), wound CCW about +N.
      idx.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
      // Back face (normal = -N): verts 0 and 2.
      idx.push(a + 0, b + 0, a + 2, a + 2, b + 0, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    const ng = g.toNonIndexed();
    g.dispose();
    // Expand skin attributes to match the non-indexed layout.
    const idxArr = idx;
    const siOut = new Float32Array(idxArr.length * 4);
    const swOut = new Float32Array(idxArr.length * 4);
    idxArr.forEach((vi, k) => {
      for (let c = 0; c < 4; c++) {
        siOut[k * 4 + c] = si[vi * 4 + c]!;
        swOut[k * 4 + c] = sw[vi * 4 + c]!;
      }
    });
    this.pieces.push({
      geometry: ng,
      mat,
      bone: -1,
      color: new THREE.Color(color),
      colorBottom: opts.bottom !== undefined ? new THREE.Color(opts.bottom) : undefined,
      outline: opts.outline ?? false,
      weights: { index: siOut, weight: swOut },
    });
    return this;
  }

  build(materials: Record<MatKey, THREE.Material>, outlineMaterial: THREE.Material | null): CharacterModel {
    this.root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.boneList);
    const groups = new Map<MatKey, THREE.BufferGeometry[]>();
    const outlineParts: THREE.BufferGeometry[] = [];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pc of this.pieces) {
      const g = pc.geometry;
      if (pc.bone >= 0) g.applyMatrix4(this.boneList[pc.bone]!.matrixWorld);
      const count = g.getAttribute('position').count;
      const pos = g.getAttribute('position');
      // Vertex colours (with optional vertical gradient for a painted / AO feel).
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < count; i++) {
        const y = pos.getY(i);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      minY = Math.min(minY, y0);
      maxY = Math.max(maxY, y1);
      const col = new Float32Array(count * 3);
      const tmp = new THREE.Color();
      for (let i = 0; i < count; i++) {
        if (pc.colorBottom) {
          const t = y1 > y0 ? (pos.getY(i) - y0) / (y1 - y0) : 1;
          tmp.copy(pc.colorBottom).lerp(pc.color, t);
        } else tmp.copy(pc.color);
        col[i * 3] = tmp.r;
        col[i * 3 + 1] = tmp.g;
        col[i * 3 + 2] = tmp.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (pc.weights) {
        g.setAttribute('skinIndex', new THREE.BufferAttribute(pc.weights.index, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(pc.weights.weight, 4));
      } else {
        const si = new Float32Array(count * 4);
        const sw = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          si[i * 4] = pc.bone;
          sw[i * 4] = 1;
        }
        g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      }
      if (g.getAttribute('uv')) g.deleteAttribute('uv');
      if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const list = groups.get(pc.mat) ?? [];
      list.push(g);
      groups.set(pc.mat, list);
      if (pc.outline) outlineParts.push(g);
    }
    const meshes: Partial<Record<MatKey, THREE.SkinnedMesh>> = {};
    for (const [key, list] of groups) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.SkinnedMesh(merged, materials[key]);
      mesh.frustumCulled = false;
      mesh.bind(skeleton, new THREE.Matrix4());
      this.root.add(mesh);
      meshes[key] = mesh;
    }
    let outline: THREE.SkinnedMesh | null = null;
    if (outlineMaterial && outlineParts.length) {
      const merged = mergeGeometries(
        outlineParts.map((g) => {
          const c = new THREE.BufferGeometry();
          c.setAttribute('position', g.getAttribute('position'));
          c.setAttribute('normal', g.getAttribute('normal'));
          c.setAttribute('skinIndex', g.getAttribute('skinIndex'));
          c.setAttribute('skinWeight', g.getAttribute('skinWeight'));
          return c;
        }),
        false,
      );
      if (merged) {
        outline = new THREE.SkinnedMesh(merged, outlineMaterial);
        outline.frustumCulled = false;
        outline.bind(skeleton, new THREE.Matrix4());
        this.root.add(outline);
      }
    }
    for (const list of groups.values()) for (const g of list) g.dispose();
    return {
      root: this.root,
      skeleton,
      bones: this.bones,
      boneMap: this.boneMap,
      meshes,
      outline,
      chains: this.chains,
      proportions: this.p,
      height: maxY - Math.min(0, minY),
    };
  }
}

/** Reverse triangle winding after a mirror (normals were already mirrored by applyMatrix4). */
export function flipWinding(g: THREE.BufferGeometry): void {
  if (g.index) {
    const idx = g.index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]!;
      idx[i + 1] = idx[i + 2]!;
      idx[i + 2] = t;
    }
    g.index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    const size = a.itemSize;
    const arr = a.array as Float32Array;
    for (let i = 0; i + 2 < a.count; i += 3) {
      for (let c = 0; c < size; c++) {
        const t = arr[(i + 1) * size + c]!;
        arr[(i + 1) * size + c] = arr[(i + 2) * size + c]!;
        arr[(i + 2) * size + c] = t;
      }
    }
    a.needsUpdate = true;
  }
}
