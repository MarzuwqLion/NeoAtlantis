/**
 * Shared environment helpers: textured PBR materials with caustics, neon
 * signs, distant skylines, passing submarines, ambient bubbles and flames.
 */
import * as THREE from 'three';
import { envStandard } from '../materials';
import type { SurfaceSet } from '../textures';
import { goldSet, neonSignTexture, windowLightsTexture } from '../textures';
import type { Batcher } from './batch';
import { srand } from './batch';
import { cone, lathe } from '../characters/shapes';
import type { Effects } from '../fx/Effects';

export function surfaceMaterial(set: SurfaceSet, params: THREE.MeshStandardMaterialParameters = {}, caustics = 1): THREE.MeshStandardMaterial {
  return envStandard(
    {
      map: set.map,
      normalMap: set.normalMap,
      roughnessMap: set.orm,
      metalnessMap: set.orm,
      roughness: 1,
      metalness: 1,
      normalScale: new THREE.Vector2(1, 1),
      ...params,
    },
    { caustics },
  );
}

export function flatMaterial(color: THREE.ColorRepresentation, roughness: number, metalness: number, caustics = 1, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return envStandard({ color, roughness, metalness, ...extra }, { caustics });
}

/** Brushed gold (canvas texture) with caustics. */
export function goldMaterial(caustics = 0.4, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return surfaceMaterial(goldSet('env'), { envMapIntensity: 1.3, ...extra }, caustics);
}

export function glowMaterial(color: THREE.ColorRepresentation, intensity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), fog: true });
}

export interface Sign {
  mesh: THREE.Mesh;
  base: number;
  flicker: number;
  phase: number;
}

/** Neon glyph sign: additive textured plane plus a dark backing plate. */
export function neonSign(group: THREE.Group, b: Batcher, backing: THREE.Material, key: string, glyphs: number[], color: string, x: number, y: number, z: number, h: number, flicker = 0, rotY = 0): Sign {
  const tex = neonSignTexture(key, glyphs, color);
  const aspect = tex.image.width / tex.image.height;
  const w = h * aspect;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z + 0.03);
  mesh.rotation.y = rotY;
  mesh.renderOrder = 4;
  group.add(mesh);
  b.add(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.06), backing, { p: [x, y, z - 0.02], r: [0, (rotY * 180) / Math.PI, 0] });
  return { mesh, base: 2.2, flicker, phase: x * 1.37 };
}

export function updateSigns(signs: Sign[], time: number): void {
  for (const s of signs) {
    let k = 1;
    if (s.flicker > 0) {
      const n = Math.sin(time * 13.1 + s.phase) * Math.sin(time * 7.3 + s.phase * 2.1);
      if (n > 1 - s.flicker * 0.4) k = 0.25;
      k *= 0.92 + 0.08 * Math.sin(time * 40 + s.phase);
    }
    (s.mesh.material as THREE.MeshBasicMaterial).color.setScalar(s.base * k);
  }
}

/** Distant city: domes, pyramids and needle towers with lit windows, on a lower tier. */
export function skyline(b: Batcher, x0: number, x1: number, z0: number, z1: number, yBase: number, seed: number, stone: THREE.Material, windows: THREE.Material, gold: THREE.Material, glow: THREE.Material): void {
  const r = srand(seed);
  let x = x0;
  while (x < x1) {
    const z = z0 + r() * (z1 - z0);
    const kind = r();
    const s = 4 + r() * 8;
    if (kind < 0.35) {
      // glass-ribbed dome on a drum
      b.add(new THREE.CylinderGeometry(s, s * 1.05, s * 0.8, 24), windows, { p: [x, yBase + s * 0.4, z] });
      b.add(new THREE.SphereGeometry(s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone, { p: [x, yBase + s * 0.8, z] });
      b.add(new THREE.CylinderGeometry(0.15, 0.3, s * 0.8, 6), gold, { p: [x, yBase + s * 2.2, z] });
      b.add(new THREE.SphereGeometry(0.35, 8, 6), glow, { p: [x, yBase + s * 2.6, z] });
    } else if (kind < 0.6) {
      b.add(cone(s * 1.1, s * 1.5, 4), stone, { p: [x, yBase + s * 0.75, z], r: [0, 45, 0] });
      b.add(cone(s * 0.2, s * 0.28, 4), gold, { p: [x, yBase + s * 1.36, z], r: [0, 45, 0] });
    } else if (kind < 0.85) {
      const h = s * 2.8;
      b.add(new THREE.BoxGeometry(s * 0.5, h, s * 0.5), windows, { p: [x, yBase + h / 2, z] });
      b.add(cone(s * 0.36, s * 0.5, 4), gold, { p: [x, yBase + h + s * 0.25, z], r: [0, 45, 0] });
    } else {
      const h = s * 1.4;
      b.add(lathe([[s * 0.6, 0], [s * 0.45, h * 0.6], [s * 0.2, h], [0.001, h * 1.05]], 12), windows, { p: [x, yBase, z] });
    }
    x += s * (1.2 + r() * 1.2);
  }
}

export function windowMaterial(key: string, warm: string, cool: string, base: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const tex = windowLightsTexture(key, warm, cool);
  tex.repeat.set(3, 3);
  return new THREE.MeshStandardMaterial({ color: base, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.2 });
}

/** A few large submarines gliding across the far background. */
export class SubmarinePassers {
  readonly group = new THREE.Group();
  private readonly subs: { m: THREE.Object3D; speed: number; x0: number; range: number }[] = [];

  constructor(hull: THREE.Material, light: THREE.Material, specs: { y: number; z: number; len: number; speed: number; x0: number; range: number }[]) {
    for (const s of specs) {
      const g = new THREE.Group();
      const r = s.len * 0.12;
      const body = new THREE.Mesh(
        lathe(
          [
            [0.001, -s.len / 2],
            [r * 0.6, -s.len * 0.45],
            [r, -s.len * 0.2],
            [r, s.len * 0.2],
            [r * 0.5, s.len * 0.45],
            [0.001, s.len / 2],
          ],
          16,
        ),
        hull,
      );
      body.rotation.z = s.speed > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(body);
      const sail = new THREE.Mesh(new THREE.BoxGeometry(s.len * 0.15, r * 1.2, r * 0.5), hull);
      sail.position.y = r * 1.1;
      g.add(sail);
      for (let i = 0; i < 6; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 4), light);
        l.position.set((i - 2.5) * s.len * 0.12, 0, r * 0.95);
        g.add(l);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), light);
      head.position.set((s.speed > 0 ? 1 : -1) * s.len * 0.49, 0, 0);
      g.add(head);
      g.position.set(s.x0, s.y, s.z);
      this.group.add(g);
      this.subs.push({ m: g, speed: s.speed, x0: s.x0, range: s.range });
    }
  }

  update(time: number): void {
    for (const s of this.subs) {
      const t = ((time * s.speed) % s.range + s.range) % s.range;
      s.m.position.x = s.x0 + (s.speed > 0 ? t : -t);
      s.m.position.y += Math.sin(time * 0.3 + s.x0) * 0.002;
    }
  }
}

/** Ambient rising bubbles near the camera window. */
export function emitBubbles(fx: Effects, camX: number, dt: number, rate: number, zMin: number, zMax: number, yMin: number, color: THREE.ColorRepresentation): void {
  const n = rate * dt;
  let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  while (k-- > 0) {
    fx.smoke.spawn({
      x: camX + (Math.random() - 0.5) * 22,
      y: yMin + Math.random() * 1.5,
      z: zMin + Math.random() * (zMax - zMin),
      vx: (Math.random() - 0.5) * 0.2,
      vy: 0.6 + Math.random() * 0.8,
      life: 3 + Math.random() * 3,
      size: 0.04 + Math.random() * 0.06,
      color,
      alpha: 0.7,
      alphaEnd: 0,
      cell: 2,
    });
  }
}

/** Torch / brazier flame particles. */
export function emitFlame(fx: Effects, x: number, y: number, z: number, dt: number, scale = 1): void {
  if (Math.random() < dt * 60) {
    fx.sparks.spawn({ x: x + (Math.random() - 0.5) * 0.12 * scale, y, z, vx: (Math.random() - 0.5) * 0.3, vy: 1.2 + Math.random() * 0.6, life: 0.35 + Math.random() * 0.25, size: 0.3 * scale, sizeEnd: 0.05, color: 0xffb040, colorEnd: 0xff3010, intensity: 2.6, alpha: 0.9, alphaEnd: 0, cell: 0, drag: 1 });
  }
  if (Math.random() < dt * 8) {
    fx.sparks.spawn({ x, y: y + 0.2, z, vx: (Math.random() - 0.5) * 0.8, vy: 1.5 + Math.random(), life: 0.8, size: 0.04, color: 0xffd080, intensity: 3, cell: 0, drag: 0.5 });
  }
}

export function disposeObject(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat.dispose();
    }
  });
  o.removeFromParent();
}
