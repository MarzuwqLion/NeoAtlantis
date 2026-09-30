/**
 * Static geometry batching for environments: pieces are transformed into
 * world space, given world-scaled UVs (so textures tile at a constant texel
 * density on any size of wall or floor) and merged into one mesh per material.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { matrixOf, type XForm } from '../characters/shapes';

export interface AddOptions {
  /** Metres per texture repeat for world-space UVs (0 keeps the geometry's own UVs). */
  uvScale?: number;
}

export class Batcher {
  private readonly buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geometry: THREE.BufferGeometry, material: THREE.Material, t?: XForm | THREE.Matrix4, o: AddOptions = {}): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    if (t) g.applyMatrix4(t instanceof THREE.Matrix4 ? t : matrixOf(t));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (o.uvScale && o.uvScale > 0) worldUV(g, o.uvScale);
    else if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    const list = this.buckets.get(material) ?? [];
    list.push(g);
    this.buckets.set(material, list);
  }

  build(name = 'static'): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [mat, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

/** Box-projected UVs from world position and dominant normal axis. */
export function worldUV(g: THREE.BufferGeometry, scale: number): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = -z;
    } else if (nx >= nz) {
      u = z * Math.sign(nor.getX(i) || 1);
      v = y;
    } else {
      u = x * Math.sign(nor.getZ(i) || 1);
      v = y;
    }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Seeded RNG for deterministic set dressing. */
export function srand(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
