/**
 * Modular Egyptian-futurist architecture and props. Every piece adds its
 * geometry to a Batcher (merged per material) so a whole environment costs a
 * handful of draw calls.
 */
import * as THREE from 'three';
import type { Batcher } from './batch';
import { cone, cyl, lathe, rbox, torus, xf, type V3 } from '../characters/shapes';

type M = THREE.Material;

/** Box whose top face is scaled (Egyptian batter / pylons / obelisks). */
export function taperedBox(w: number, h: number, d: number, topX: number, topZ = topX): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * topX);
      p.setZ(i, p.getZ(i) * topZ);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Cavetto cornice: the flared lip that caps pylons and doorways. */
function cornice(w: number, d: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0, h * 0.2);
  s.quadraticCurveTo(h * 0.05, h * 0.9, h * 0.75, h);
  s.lineTo(h * 0.75, h * 1.12);
  s.lineTo(-0.02, h * 1.12);
  s.lineTo(-0.02, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 6 });
  // profile in XY, extruded along Z -> rotate so the lip faces +Z and runs along X
  g.translate(0, 0, -w / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(0, 0, d / 2);
  return g;
}

export interface PylonMats {
  stone: M;
  relief: M;
  gold: M;
  glow?: M;
}

/** Monumental pylon tower with relief face, torus moulding, cornice and sun disc. */
export function pylon(b: Batcher, m: PylonMats, x: number, z: number, w: number, h: number, d: number): void {
  b.add(taperedBox(w, h, d, 0.82, 0.85), m.stone, { p: [x, h / 2, z] }, { uvScale: 2 });
  b.add(new THREE.PlaneGeometry(w * 0.66, h * 0.62), m.relief, { p: [x, h * 0.46, z + d * 0.5 * 0.93 + 0.02], r: [-3.2, 0, 0] });
  b.add(cornice(w * 0.86, d * 0.85, 0.5), m.stone, { p: [x, h - 0.02, z] }, { uvScale: 1.5 });
  b.add(new THREE.BoxGeometry(w * 0.9, 0.12, d * 0.9), m.gold, { p: [x, h + 0.55, z] });
  // torus mouldings on the vertical edges
  for (const s of [-1, 1]) {
    const edge = cyl(0.06, 0.07, h * 0.98, 8);
    b.add(edge, m.gold, { p: [x + s * w * 0.455, h * 0.49, z + d * 0.44], r: [0, 0, -s * 5] });
  }
  // winged sun disc
  const disc = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24);
  b.add(disc, m.gold, { p: [x, h * 0.86, z + d * 0.44 + 0.06], r: [90, 0, 0] });
  if (m.glow) b.add(new THREE.CircleGeometry(0.22, 20), m.glow, { p: [x, h * 0.86, z + d * 0.44 + 0.11] });
  for (const s of [-1, 1]) {
    const wing = new THREE.BoxGeometry(0.9, 0.12, 0.05);
    b.add(wing, m.gold, { p: [x + s * 0.72, h * 0.86 + 0.02, z + d * 0.44 + 0.06], r: [0, 0, s * 8] });
  }
}

export function obelisk(b: Batcher, m: { stone: M; gold: M; relief?: M }, x: number, z: number, h: number, w = 0.7): void {
  b.add(new THREE.BoxGeometry(w * 1.5, 0.4, w * 1.5), m.stone, { p: [x, 0.2, z] }, { uvScale: 1.5 });
  b.add(taperedBox(w, h, w, 0.62), m.relief ?? m.stone, { p: [x, 0.4 + h / 2, z] }, { uvScale: 1.2 });
  const tip = cone(w * 0.62 * 0.72, w * 0.6, 4);
  b.add(tip, m.gold, { p: [x, 0.4 + h + w * 0.3, z], r: [0, 45, 0] });
}

/** Bundled papyrus / lotus column with painted bands and a flared capital. */
export function lotusColumn(b: Batcher, m: { stone: M; gold: M; paint?: M }, x: number, z: number, h: number, r: number): void {
  b.add(cyl(r * 1.35, r * 1.4, 0.25, 20), m.stone, { p: [x, 0.125, z] }, { uvScale: 1.5 });
  // fluted, slightly bulbous shaft
  const shaft = new THREE.CylinderGeometry(r * 0.82, r, h * 0.78, 32, 8);
  const p = shaft.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const pz = p.getZ(i);
    const py = p.getY(i) / (h * 0.78) + 0.5;
    const a = Math.atan2(px, pz);
    const flute = 1 - 0.06 * Math.abs(Math.sin(a * 4));
    const bulge = 1 + 0.12 * Math.sin(Math.min(1, py * 3) * Math.PI) * (py < 0.34 ? 1 : 0.3);
    p.setX(i, px * flute * bulge);
    p.setZ(i, pz * flute * bulge);
  }
  shaft.computeVertexNormals();
  b.add(shaft, m.stone, { p: [x, 0.25 + h * 0.39, z] }, { uvScale: 1.6 });
  const top = 0.25 + h * 0.78;
  for (let i = 0; i < 3; i++) b.add(cyl(r * 0.86, r * 0.86, 0.1, 24), i === 1 ? (m.paint ?? m.gold) : m.gold, { p: [x, top - 0.35 + i * 0.13, z] });
  // capital: flaring papyrus bloom
  const cap = lathe(
    [
      [r * 0.82, 0],
      [r * 0.9, h * 0.06],
      [r * 1.25, h * 0.13],
      [r * 1.7, h * 0.19],
      [r * 1.78, h * 0.2],
      [r * 0.4, h * 0.2],
    ],
    32,
  );
  b.add(cap, m.paint ?? m.stone, { p: [x, top, z] }, { uvScale: 1.2 });
  b.add(new THREE.BoxGeometry(r * 2.4, h * 0.03, r * 2.4), m.stone, { p: [x, top + h * 0.2 + h * 0.015, z] }, { uvScale: 1.5 });
}

/** Seated colossus facing the camera (+Z): throne, legs, hands on knees, nemes. */
export function colossus(b: Batcher, m: { stone: M; gold: M; paint: M; glow?: M }, x: number, z: number, s: number, yBase = 0): void {
  const Y = (v: number) => yBase + v * s;
  // plinth and throne
  b.add(new THREE.BoxGeometry(3.2 * s, 0.6 * s, 3.2 * s), m.stone, { p: [x, Y(0.3), z] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(2.6 * s, 2.2 * s, 2.2 * s), m.paint, { p: [x, Y(1.7), z - 0.3 * s] }, { uvScale: 2.5 });
  b.add(new THREE.BoxGeometry(2.8 * s, 0.18 * s, 2.4 * s), m.gold, { p: [x, Y(2.85), z - 0.3 * s] });
  // shins and feet
  for (const sd of [-1, 1]) {
    b.add(rbox(0.62 * s, 2.0 * s, 0.62 * s, 0.12 * s), m.stone, { p: [x + sd * 0.45 * s, Y(1.6), z + 1.0 * s] }, { uvScale: 2 });
    b.add(rbox(0.66 * s, 0.3 * s, 1.0 * s, 0.1 * s), m.stone, { p: [x + sd * 0.45 * s, Y(0.75), z + 1.2 * s] }, { uvScale: 2 });
    // thighs (horizontal)
    b.add(rbox(0.7 * s, 0.62 * s, 1.9 * s, 0.14 * s), m.stone, { p: [x + sd * 0.45 * s, Y(2.9), z + 0.25 * s] }, { uvScale: 2 });
    // forearms resting on thighs, hands on knees
    b.add(rbox(0.36 * s, 0.34 * s, 1.5 * s, 0.1 * s), m.stone, { p: [x + sd * 0.72 * s, Y(3.35), z + 0.35 * s] }, { uvScale: 2 });
    b.add(rbox(0.44 * s, 0.24 * s, 0.5 * s, 0.1 * s), m.stone, { p: [x + sd * 0.72 * s, Y(3.3), z + 1.05 * s] }, { uvScale: 2 });
    // upper arms
    b.add(rbox(0.4 * s, 1.3 * s, 0.44 * s, 0.12 * s), m.stone, { p: [x + sd * 0.86 * s, Y(3.95), z - 0.3 * s], r: [8, 0, sd * 4] }, { uvScale: 2 });
    // gold bracelets
    b.add(cyl(0.22 * s, 0.22 * s, 0.14 * s, 16), m.gold, { p: [x + sd * 0.72 * s, Y(3.35), z + 0.85 * s], r: [90, 0, 0] });
  }
  // kilt front
  b.add(taperedBox(1.4 * s, 1.2 * s, 0.25 * s, 0.7, 1), m.gold, { p: [x, Y(2.4), z + 1.15 * s], r: [0, 0, 180] });
  // torso (tapered upward to broad shoulders)
  b.add(taperedBox(1.3 * s, 1.7 * s, 0.9 * s, 1.4, 1), m.stone, { p: [x, Y(4.05), z - 0.35 * s] }, { uvScale: 2 });
  // broad collar
  b.add(cyl(0.9 * s, 0.95 * s, 0.2 * s, 24, false), m.paint, { p: [x, Y(4.72), z - 0.3 * s], s: [1, 1, 0.6] });
  b.add(cyl(0.95 * s, 1.0 * s, 0.08 * s, 24, false), m.gold, { p: [x, Y(4.6), z - 0.3 * s], s: [1, 1, 0.6] });
  // head with nemes and false beard
  b.add(rbox(0.62 * s, 0.8 * s, 0.66 * s, 0.2 * s), m.stone, { p: [x, Y(5.35), z - 0.25 * s] }, { uvScale: 2 });
  b.add(taperedBox(1.25 * s, 1.0 * s, 0.9 * s, 0.62, 0.7), m.paint, { p: [x, Y(5.45), z - 0.36 * s] }, { uvScale: 2 });
  for (const sd of [-1, 1]) b.add(new THREE.BoxGeometry(0.28 * s, 0.9 * s, 0.14 * s), m.paint, { p: [x + sd * 0.48 * s, Y(4.75), z + 0.02 * s], r: [-4, 0, 0] }, { uvScale: 2 });
  b.add(taperedBox(0.16 * s, 0.4 * s, 0.14 * s, 0.8), m.gold, { p: [x, Y(4.85), z + 0.1 * s] });
  b.add(cone(0.14 * s, 0.4 * s, 12), m.gold, { p: [x, Y(6.1), z - 0.3 * s] });
  if (m.glow) {
    for (const sd of [-1, 1]) b.add(new THREE.PlaneGeometry(0.12 * s, 0.05 * s), m.glow, { p: [x + sd * 0.14 * s, Y(5.45), z + 0.09 * s] });
  }
}

export function crate(b: Batcher, m: M, trim: M, x: number, y: number, z: number, s: number, rotY = 0): void {
  b.add(new THREE.BoxGeometry(s, s, s), m, { p: [x, y + s / 2, z], r: [0, rotY, 0] }, { uvScale: s });
  for (const e of [-1, 1]) {
    b.add(new THREE.BoxGeometry(s * 1.02, s * 0.08, s * 1.02), trim, { p: [x, y + s / 2 + e * s * 0.42, z], r: [0, rotY, 0] });
  }
}

export function container(b: Batcher, m: M, trim: M, x: number, y: number, z: number, len: number, h: number, d: number, rotY = 0): void {
  b.add(new THREE.BoxGeometry(len, h, d), m, { p: [x, y + h / 2, z], r: [0, rotY, 0] }, { uvScale: h });
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const q = new THREE.Vector3(sx * (len / 2 - 0.05), 0, sz * (d / 2 - 0.05)).applyAxisAngle(new THREE.Vector3(0, 1, 0), (rotY * Math.PI) / 180);
    b.add(new THREE.BoxGeometry(0.12, h, 0.12), trim, { p: [x + q.x, y + h / 2, z + q.z], r: [0, rotY, 0] });
  }
}

export function amphora(b: Batcher, m: M, x: number, y: number, z: number, s: number): void {
  const g = lathe(
    [
      [0.001, 0],
      [0.12, 0.03],
      [0.22, 0.2],
      [0.2, 0.42],
      [0.1, 0.56],
      [0.08, 0.64],
      [0.11, 0.68],
    ],
    16,
  );
  b.add(g, m, { p: [x, y, z], s }, { uvScale: 0 });
}

export function lampPost(b: Batcher, m: { metal: M; gold: M; glow: M }, x: number, z: number, h: number): V3 {
  b.add(cyl(0.07, 0.09, h, 10), m.metal, { p: [x, h / 2, z] });
  b.add(cyl(0.18, 0.22, 0.25, 10), m.metal, { p: [x, 0.125, z] });
  b.add(torus(0.08, 0.02, 6, 12), m.gold, { p: [x, h * 0.6, z], r: [90, 0, 0] });
  b.add(new THREE.BoxGeometry(0.5, 0.06, 0.08), m.metal, { p: [x + 0.2, h - 0.05, z] });
  b.add(lathe([[0.02, 0], [0.16, 0.06], [0.2, 0.18], [0.001, 0.2]], 12), m.gold, { p: [x + 0.4, h - 0.3, z] });
  b.add(new THREE.SphereGeometry(0.11, 12, 8), m.glow, { p: [x + 0.4, h - 0.26, z] });
  return [x + 0.4, h - 0.35, z];
}

/** Pylon doorway set into a wall (enemies can emerge from it). */
export function doorway(b: Batcher, m: { stone: M; gold: M; dark: M; relief?: M; glow?: M }, x: number, z: number, w: number, h: number): void {
  const jamb = 0.5;
  for (const s of [-1, 1]) b.add(taperedBox(jamb, h, 0.8, 0.85, 1), m.stone, { p: [x + s * (w / 2 + jamb / 2), h / 2, z] }, { uvScale: 1.5 });
  b.add(new THREE.BoxGeometry(w + jamb * 2.2, 0.55, 0.9), m.relief ?? m.stone, { p: [x, h + 0.27, z] }, { uvScale: 1.5 });
  b.add(cornice(w + jamb * 2.3, 0.9, 0.35), m.stone, { p: [x, h + 0.54, z] }, { uvScale: 1.5 });
  b.add(new THREE.PlaneGeometry(w, h), m.dark, { p: [x, h / 2, z - 0.3] });
  b.add(new THREE.BoxGeometry(w + jamb * 2.2, 0.06, 0.95), m.gold, { p: [x, h + 0.03, z] });
  if (m.glow) b.add(new THREE.PlaneGeometry(w * 0.9, 0.05), m.glow, { p: [x, h - 0.1, z + 0.41] });
}

export function stall(b: Batcher, m: { wood: M; cloth: M; goods: M[]; counter: M }, x: number, z: number, w: number, h: number): void {
  const d = 1.4;
  for (const sx of [-1, 1]) for (const sz of [0, 1]) b.add(cyl(0.05, 0.05, h, 8), m.wood, { p: [x + sx * (w / 2 - 0.05), h / 2, z - sz * d] });
  b.add(new THREE.BoxGeometry(w, 0.9, 0.6), m.counter, { p: [x, 0.45, z - 0.2] }, { uvScale: 1 });
  // sloped awning with scalloped front edge
  const aw = new THREE.PlaneGeometry(w + 0.3, d + 0.6, 1, 1);
  b.add(aw, m.cloth, { p: [x, h + 0.2, z - d / 2 + 0.1], r: [-68, 0, 0] }, { uvScale: 0 });
  const aw2 = new THREE.PlaneGeometry(w + 0.3, d + 0.6, 1, 1);
  b.add(aw2, m.cloth, { p: [x, h + 0.2, z - d / 2 + 0.1], r: [-68 + 180, 180, 0] }, { uvScale: 0 });
  for (let i = 0; i < Math.round(w / 0.4); i++) {
    const tri = new THREE.CircleGeometry(0.2, 3, Math.PI / 2 + Math.PI, Math.PI);
    b.add(tri, m.cloth, { p: [x - w / 2 + 0.2 + i * 0.4, h - 0.14, z + 0.36] });
  }
  // goods on the counter
  let gx = x - w / 2 + 0.3;
  let k = 0;
  while (gx < x + w / 2 - 0.2) {
    const gm = m.goods[k % m.goods.length]!;
    if (k % 3 === 0) b.add(new THREE.SphereGeometry(0.14, 10, 8), gm, { p: [gx, 1.03, z - 0.15] });
    else if (k % 3 === 1) b.add(lathe([[0.001, 0], [0.12, 0.02], [0.15, 0.14], [0.08, 0.26], [0.1, 0.3]], 10), gm, { p: [gx, 0.9, z - 0.2] });
    else b.add(new THREE.BoxGeometry(0.28, 0.16, 0.24), gm, { p: [gx, 0.98, z - 0.2], r: [0, 20, 0] });
    gx += 0.32;
    k++;
  }
}

export function torchStand(b: Batcher, m: { metal: M; gold: M }, x: number, z: number, h: number): V3 {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(cyl(0.025, 0.035, h, 6), m.metal, { p: [x + Math.sin(a) * 0.14, h / 2, z + Math.cos(a) * 0.14], r: [Math.cos(a) * 8, 0, -Math.sin(a) * 8] });
  }
  b.add(lathe([[0.05, 0], [0.26, 0.12], [0.3, 0.22], [0.001, 0.22]], 16), m.gold, { p: [x, h, z] });
  b.add(torus(0.3, 0.025, 6, 20), m.gold, { p: [x, h + 0.22, z], r: [90, 0, 0] });
  return [x, h + 0.3, z];
}

export function brazier(b: Batcher, m: { stone: M; gold: M }, x: number, z: number): V3 {
  b.add(cyl(0.3, 0.4, 0.8, 16), m.stone, { p: [x, 0.4, z] }, { uvScale: 1 });
  b.add(lathe([[0.1, 0], [0.5, 0.15], [0.55, 0.35], [0.001, 0.35]], 20), m.gold, { p: [x, 0.8, z] });
  return [x, 1.25, z];
}

export function balustrade(b: Batcher, m: { stone: M; gold: M }, x0: number, x1: number, z: number, h: number): void {
  const len = x1 - x0;
  b.add(new THREE.BoxGeometry(len, 0.18, 0.5), m.stone, { p: [(x0 + x1) / 2, h, z] }, { uvScale: 1.5 });
  b.add(new THREE.BoxGeometry(len, 0.2, 0.45), m.stone, { p: [(x0 + x1) / 2, 0.1, z] }, { uvScale: 1.5 });
  b.add(new THREE.BoxGeometry(len, 0.04, 0.52), m.gold, { p: [(x0 + x1) / 2, h + 0.1, z] });
  for (let x = x0 + 0.3; x < x1; x += 0.55) {
    b.add(lathe([[0.07, 0], [0.11, 0.1], [0.08, 0.3], [0.12, h * 0.55], [0.07, h - 0.18]], 10), m.stone, { p: [x, 0.18, z] }, { uvScale: 1 });
  }
}

export function submarine(b: Batcher, m: { hull: M; gold: M; glow: M; dark: M }, x: number, y: number, z: number, len: number, flip = false): void {
  const r = len * 0.12;
  const hull = lathe(
    [
      [0.001, -len / 2],
      [r * 0.55, -len * 0.46],
      [r * 0.95, -len * 0.3],
      [r, 0],
      [r * 0.95, len * 0.25],
      [r * 0.6, len * 0.42],
      [0.001, len / 2],
    ],
    24,
  );
  const rot: V3 = [0, 0, flip ? 90 : -90];
  b.add(hull, m.hull, { p: [x, y, z], r: rot }, { uvScale: 2 });
  b.add(rbox(len * 0.16, r * 1.1, r * 0.5, r * 0.2), m.hull, { p: [x + (flip ? 0.1 : -0.1) * len, y + r * 1.25, z] });
  b.add(new THREE.BoxGeometry(len * 0.17, r * 0.08, r * 0.55), m.gold, { p: [x + (flip ? 0.1 : -0.1) * len, y + r * 1.82, z] });
  for (let i = 0; i < 5; i++) b.add(new THREE.CircleGeometry(r * 0.12, 12), m.glow, { p: [x + (i - 2) * len * 0.1, y + r * 0.2, z + r * 1.0] });
  b.add(new THREE.BoxGeometry(len * 0.02, r * 1.8, r * 0.08), m.gold, { p: [x + (flip ? -0.48 : 0.48) * len, y, z] });
  b.add(new THREE.BoxGeometry(len * 0.01, r * 0.4, len * 0.35), m.dark, { p: [x + (flip ? -0.47 : 0.47) * len, y, z] });
}

export function crane(b: Batcher, m: { metal: M; gold: M; glow: M }, x: number, z: number, h: number, reach: number): void {
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(0.22, h, 0.22), m.metal, { p: [x + s * 0.7, h / 2, z] });
    for (let y = 0.8; y < h - 0.5; y += 1.4) b.add(new THREE.BoxGeometry(0.08, 1.7, 0.08), m.metal, { p: [x, y + 0.7, z], r: [0, 0, s * 42] });
  }
  b.add(new THREE.BoxGeometry(reach, 0.35, 0.4), m.metal, { p: [x + reach / 2 - 1.2, h + 0.2, z] });
  b.add(new THREE.BoxGeometry(1.4, 0.8, 1.0), m.gold, { p: [x, h + 0.7, z] });
  b.add(new THREE.BoxGeometry(0.03, h * 0.5, 0.03), m.metal, { p: [x + reach - 1.6, h - h * 0.25, z] });
  b.add(new THREE.BoxGeometry(0.5, 0.3, 0.5), m.metal, { p: [x + reach - 1.6, h * 0.5, z] });
  b.add(new THREE.SphereGeometry(0.1, 8, 6), m.glow, { p: [x + reach - 1.2, h + 0.45, z] });
}

export function rock(b: Batcher, m: M, x: number, y: number, z: number, s: number, seed: number): void {
  const g = new THREE.DodecahedronGeometry(s, 1);
  const p = g.getAttribute('position');
  let k = seed;
  for (let i = 0; i < p.count; i++) {
    k = (k * 16807) % 2147483647;
    const f = 0.8 + ((k % 1000) / 1000) * 0.4;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  b.add(g, m, { p: [x, y, z] }, { uvScale: 1.5 });
}

export function coral(b: Batcher, m: M, x: number, y: number, z: number, s: number, seed: number): void {
  let k = seed;
  const r = () => {
    k = (k * 16807) % 2147483647;
    return (k % 1000) / 1000;
  };
  for (let i = 0; i < 5; i++) {
    const h = (0.5 + r() * 0.8) * s;
    b.add(cone(0.06 * s, h, 6), m, { p: [x + (r() - 0.5) * 0.5 * s, y + h / 2, z + (r() - 0.5) * 0.4 * s], r: [(r() - 0.5) * 40, 0, (r() - 0.5) * 40] });
  }
}

export function planter(b: Batcher, m: { stone: M; leaf: M }, x: number, z: number): void {
  b.add(lathe([[0.3, 0], [0.42, 0.5], [0.46, 0.55], [0.001, 0.55]], 14), m.stone, { p: [x, 0, z] }, { uvScale: 1 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.add(cone(0.08, 1.1, 4), m.leaf, { p: [x + Math.sin(a) * 0.3, 1.0, z + Math.cos(a) * 0.3], r: [Math.cos(a) * 35, 0, -Math.sin(a) * 35], s: [1, 1, 0.2] });
  }
}

export { xf };
