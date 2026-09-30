/**
 * Debug overlay: hurtboxes (green), active hitboxes (red) and projectile
 * hit volumes (orange), drawn as wire boxes in belt space. Box depth shows
 * the z tolerance.
 */
import * as THREE from 'three';
import type { World } from '../sim/types';
import { getFighterDef } from '../data/fighters';
import { getMove } from '../data/moves';
import { COMBAT } from '../data/tuning';
import { PROJECTILES } from '../data/weapons';
import { hitActive, hitboxX } from '../sim/combat';
import { hurtHeight, isHittable } from '../sim/fighter';

const MAX_BOXES = 128;
// 12 edges per box, 2 vertices each
const VERTS_PER_BOX = 24;

export class HitboxOverlay {
  readonly lines: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private n = 0;

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_BOXES * VERTS_PER_BOX * 3);
    this.col = new Float32Array(MAX_BOXES * VERTS_PER_BOX * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, fog: false }));
    this.lines.renderOrder = 100;
    this.lines.frustumCulled = false;
    this.lines.visible = false;
  }

  private box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: THREE.Color): void {
    if (this.n >= MAX_BOXES) return;
    const v = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ];
    const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    let o = this.n * VERTS_PER_BOX * 3;
    for (const i of e) {
      const p = v[i]!;
      this.pos[o] = p[0]!;
      this.pos[o + 1] = p[1]!;
      this.pos[o + 2] = p[2]!;
      this.col[o] = c.r;
      this.col[o + 1] = c.g;
      this.col[o + 2] = c.b;
      o += 3;
    }
    this.n++;
  }

  update(w: World): void {
    if (!this.lines.visible) return;
    this.n = 0;
    const green = new THREE.Color(0.2, 1, 0.4);
    const grey = new THREE.Color(0.35, 0.45, 0.4);
    const red = new THREE.Color(1, 0.15, 0.15);
    const orange = new THREE.Color(1, 0.6, 0.1);
    for (const f of w.fighters) {
      const def = getFighterDef(f.def);
      const hw = def.hurt.halfWidth;
      const zr = def.hurt.zRadius;
      this.box(f.x - hw, f.x + hw, f.y, f.y + hurtHeight(f), f.z - zr, f.z + zr, isHittable(f) ? green : grey);
      if (f.move && f.state === 'attack') {
        const md = getMove(f.move.id);
        md.hits.forEach((h, i) => {
          if (!hitActive(f, i)) return;
          const [x0, x1] = hitboxX(f, h);
          const zz = h.zRange ?? COMBAT.defaultZRange;
          this.box(x0, x1, f.y + h.box.y0, f.y + h.box.y1, f.z - zz, f.z + zz, red);
        });
      }
    }
    for (const p of w.projectiles) {
      const def = PROJECTILES[p.kind];
      if (def.ring) {
        const r = p.radius;
        this.box(p.x - r, p.x + r, 0, def.height, p.z - r, p.z + r, orange);
      } else {
        this.box(p.x - def.radius, p.x + def.radius, p.y - def.radius, p.y + def.radius, p.z - 0.2, p.z + 0.2, orange);
      }
    }
    const g = this.lines.geometry;
    g.setDrawRange(0, this.n * VERTS_PER_BOX);
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('color').needsUpdate = true;
  }
}
