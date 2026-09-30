/**
 * 4. TEMPLE PALACE — a polished gallery above a hall of seated colossi,
 * torchlight and bioluminescence, gold everywhere; the throne room of the
 * Serpent Pharaoh at the end (final boss).
 */
import * as THREE from 'three';
import type { EnvDef } from '../../data/defs';
import type { EnvironmentView, EnvLook, EnvUpdate, Lamp } from './types';
import type { SimEvent, World } from '../../sim/types';
import { Batcher, srand } from './batch';
import { balustrade, brazier, colossus, doorway, lotusColumn, obelisk, torchStand, taperedBox } from './pieces';
import { godRays, water } from './nature';
import { disposeObject, emitFlame, flatMaterial, goldMaterial, glowMaterial, neonSign, surfaceMaterial, updateSigns, type Sign } from './common';
import { clothTexture, floorSet, reliefSet, stoneSet } from '../textures';
import { cone, cyl, lathe, rbox, sweep, torus } from '../characters/shapes';

export const TEMPLE_LOOK: EnvLook = {
  background: 0x05060e,
  fog: { color: 0x0a0c1c, density: 0.02 },
  hemi: { sky: 0x5a68a8, ground: 0x2a1a0c, intensity: 0.9 },
  key: { color: 0xffc080, intensity: 1.6, dir: [0.3, 1, 0.6] },
  fill: { color: 0x6078e0, intensity: 0.4, dir: [-0.5, 0.3, -0.7] },
  rim: { color: 0xffc070, strength: 0.48 },
  caustics: { color: 0x60e8d0, strength: 0.3, scale: 0.2, speed: 0.4 },
  grade: { exposure: 1.1, bloomStrength: 0.85, bloomRadius: 0.62, bloomThreshold: 0.78, saturation: 1.12, contrast: 1.1, vignette: 0.42, lift: 0x04040c, gamma: 0xffffff, gain: 0xfff0e0, tint: 0xfff6ec },
  envMap: {
    top: 0x3a3a70,
    horizon: 0x2a1c14,
    bottom: 0x080604,
    panels: [
      { color: 0xffa040, intensity: 7, pos: [10, 5, 10], size: [6, 4] },
      { color: 0xffc070, intensity: 5, pos: [-10, 6, 8], size: [4, 4] },
      { color: 0x4a60b0, intensity: 1.2, pos: [0, 2, -14], size: [10, 3] },
    ],
  },
  dust: 0x9a8a70,
  accent: 0xffd070,
  lamps: [],
  shadowStrength: 0.85,
};

export function buildTemple(env: EnvDef): EnvironmentView {
  const group = new THREE.Group();
  group.name = 'env:temple';
  const b = new Batcher();
  const rnd = srand(404);
  const x0 = -16;
  const x1 = env.length + 16;
  const mid = (x0 + x1) / 2;
  const len = x1 - x0;
  const bossX = env.encounters[env.encounters.length - 1]!.lockX;
  const throneStart = bossX - 11;

  const floor = surfaceMaterial(floorSet('polished'), { envMapIntensity: 1.4 }, 0.5);
  const stone = surfaceMaterial(stoneSet('temple-stone', { base: [196, 168, 128], blocks: { w: 128, h: 80, mortar: 2 }, seed: 91 }), {}, 0.5);
  const stoneDark = surfaceMaterial(stoneSet('temple-dark', { base: [70, 62, 60], blocks: { w: 128, h: 128, mortar: 2 }, seed: 92 }), { envMapIntensity: 1.2 }, 0.4);
  const statueStone = surfaceMaterial(stoneSet('statue', { base: [180, 150, 112], seed: 93, variation: 0.06 }), {}, 0.6);
  const relief = surfaceMaterial(reliefSet('temple-relief', { base: [190, 160, 120], painted: true, cols: 6, rows: 5, seed: 71 }), {}, 0.5);
  const goldRelief = surfaceMaterial(reliefSet('temple-gold', { base: [120, 90, 60], painted: false, cols: 4, rows: 4, seed: 72, gold: true }), {}, 0.4);
  const paint = surfaceMaterial(reliefSet('temple-nemes', { base: [40, 70, 150], painted: true, cols: 3, rows: 3, seed: 73 }), {}, 0.4);
  const gold = goldMaterial(0.3, { envMapIntensity: 1.5 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x020206, fog: true });
  const backing = flatMaterial(0x0c0a10, 0.5, 0.6, 0.1);
  const bio = glowMaterial(0x30ffd0, 2.4);
  const bioBlue = glowMaterial(0x40a0ff, 2.2);
  const ember = glowMaterial(0xffa040, 3);
  const violet = glowMaterial(0xb45cff, 2.6);
  const bannerMat = flatMaterial(0xffffff, 0.85, 0, 0.2, { map: clothTexture('banner', 'zigzag', ['#2a0f3a', '#e0b04c', '#b45cff', '#1c2f6a']), side: THREE.DoubleSide });

  // --- Gallery floor, front steps ----------------------------------------------
  b.add(new THREE.BoxGeometry(len, 0.6, 8.8), floor, { p: [mid, -0.3, 0.5] }, { uvScale: 4 });
  b.add(new THREE.BoxGeometry(len, 0.3, 0.8), stoneDark, { p: [mid, -0.15, 5.3] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(len, 0.3, 0.8), stoneDark, { p: [mid, -0.45, 6.1] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(len, 0.04, 0.05), gold, { p: [mid, 0.01, 4.9] });
  // front braziers
  const flames: [number, number, number, number][] = [];
  for (let x = x0 + 14; x < throneStart - 6; x += 27) {
    const [fx, fy, fz] = brazier(b, { stone: stoneDark, gold }, x, 6.5);
    flames.push([fx, fy, fz, 1.3]);
  }

  // --- Gallery back: balustrade with stair doorways, colonnade, torches ------
  const lamps: Lamp[] = [];
  const signs: Sign[] = [];
  const doorXs = env.doors.map((d) => d.x);
  const balZ = -3.95;
  let bx = x0;
  for (const dx of doorXs) {
    balustrade(b, { stone: stoneDark, gold }, bx, dx - 1.6, balZ, 1.0);
    doorway(b, { stone, gold, dark, relief: goldRelief, glow: bio }, dx, balZ - 0.3, 2.2, 3.2);
    bx = dx + 1.6;
  }
  balustrade(b, { stone: stoneDark, gold }, bx, throneStart, balZ, 1.0);
  for (let x = x0 + 4; x < throneStart - 2; x += 8) {
    if (doorXs.some((d) => Math.abs(d - x) < 2.5)) continue;
    lotusColumn(b, { stone, gold, paint }, x, -4.9, 13, 0.72);
  }
  for (let x = x0 + 8; x < throneStart - 2; x += 8) {
    if (doorXs.some((d) => Math.abs(d - x) < 2.2)) continue;
    const [tx, ty, tz] = torchStand(b, { metal: stoneDark, gold }, x, -3.55, 1.7);
    flames.push([tx, ty, tz, 1]);
    lamps.push({ x: tx, y: ty + 0.2, z: tz + 0.6, color: 0xff9a40, intensity: 16, distance: 9, flicker: 0.25 });
  }

  // --- Lower hall of colossi --------------------------------------------------
  b.add(new THREE.BoxGeometry(len, 1, 20), stoneDark, { p: [mid, -6.5, -15] }, { uvScale: 4 });
  const pool = water(len, 3, 0x02140f, 0x0a4a3a, 0x30ffd0);
  pool.position.set(mid, -5.9, -9.5);
  group.add(pool);
  for (let x = x0 + 12; x < throneStart - 4; x += 16) {
    colossus(b, { stone: statueStone, gold, paint, glow: bio }, x, -14.5, 1.55, -6);
    lamps.push({ x, y: -1, z: -10, color: 0x30ffd0, intensity: 20, distance: 16 });
  }
  // back wall of the hall: painted reliefs and gold bands
  b.add(new THREE.BoxGeometry(len, 16, 1), stone, { p: [mid, 1, -20] }, { uvScale: 3 });
  for (let x = x0 + 4; x < x1; x += 7) b.add(new THREE.PlaneGeometry(5.5, 5), relief, { p: [x, -1.2, -19.49] });
  b.add(new THREE.BoxGeometry(len, 0.2, 0.1), gold, { p: [mid, 1.7, -19.45] });
  // vines along the hall: dark stems (thick enough to read ~40 m from the camera) carrying glowing bulbs
  const vine = flatMaterial(0x10261e, 0.85, 0, 0.3);
  for (let x = x0; x < throneStart; x += 3 + rnd() * 3) {
    const pts: [number, number, number][] = [];
    const h = 3 + rnd() * 4;
    for (let i = 0; i <= 6; i++) pts.push([x + Math.sin(i * 1.3) * 0.3, -5.8 + (i / 6) * h, -19.2 + Math.cos(i) * 0.1]);
    b.add(sweep(pts, (t) => 0.15 * (1 - t) + 0.05, 12, 5), vine);
    for (let k = 0; k < 3; k++) {
      const p = pts[2 + Math.floor(rnd() * 5)]!;
      b.add(new THREE.SphereGeometry(0.09 + rnd() * 0.06, 8, 6), rnd() < 0.5 ? bio : bioBlue, { p: [p[0], p[1], p[2] + 0.12] });
    }
  }
  for (let x = x0 + 3; x < throneStart; x += 5 + rnd() * 4) {
    for (let k = 0; k < 4; k++) b.add(cone(0.05, 0.4 + rnd() * 0.5, 5), bio, { p: [x + rnd(), -5.7, -9 - rnd() * 1.5], r: [(rnd() - 0.5) * 30, 0, (rnd() - 0.5) * 30] });
  }

  // --- Throne room --------------------------------------------------------------
  // Composed for the belt camera: at this depth the top of the frame sits
  // about 4 m up, so the throne, sun disc and cobra guardians stay below that.
  const tx0 = throneStart;
  const throneX = bossX + 4.5;
  const midX = (tx0 + x1) / 2;
  // low dais with a glowing glyph band on its front step
  b.add(new THREE.BoxGeometry(x1 - tx0, 0.45, 5.2), stoneDark, { p: [midX, 0.225, -6.5] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(x1 - tx0, 0.22, 0.45), stoneDark, { p: [midX, 0.11, -3.72] }, { uvScale: 1.5 });
  b.add(new THREE.BoxGeometry(x1 - tx0, 0.04, 0.08), gold, { p: [midX, 0.46, -3.92] });
  signs.push(neonSign(group, b, backing, 'apep-band', [10, 1, 28, 4, 10], '#b45cff', throneX, 0.3, -3.88, 0.24, 0.1));
  // back wall: gold reliefs, banners
  b.add(new THREE.BoxGeometry(x1 - tx0, 14, 1), stone, { p: [midX, 6, -9.7] }, { uvScale: 3 });
  for (let x = tx0 + 2; x < x1; x += 5.5) {
    if (Math.abs(x - throneX) < 3.2) continue;
    b.add(new THREE.PlaneGeometry(3.6, 3.2), goldRelief, { p: [x, 2.05, -9.19] });
    b.add(new THREE.PlaneGeometry(1.1, 2.8), bannerMat, { p: [x + 2.7, 2.4, -9.15] });
    b.add(cyl(0.04, 0.04, 1.4, 6), gold, { p: [x + 2.7, 3.85, -9.12], r: [0, 0, 90] });
  }
  // the great sun disc behind the throne, with outstretched wings
  b.add(new THREE.CylinderGeometry(1.35, 1.35, 0.25, 48), gold, { p: [throneX, 2.7, -9.1], r: [90, 0, 0] });
  b.add(new THREE.CircleGeometry(1.08, 48), violet, { p: [throneX, 2.7, -8.96] });
  b.add(new THREE.TorusGeometry(1.2, 0.05, 6, 48), gold, { p: [throneX, 2.7, -8.93] });
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      b.add(new THREE.BoxGeometry(2.4 - k * 0.35, 0.16, 0.12), gold, { p: [throneX + sd * (2.3 - k * 0.12), 2.95 - k * 0.24, -9.05], r: [0, 0, sd * (6 + k * 7)] });
    }
  }
  // the throne: gold seat, dark stone back with a gold relief, cobra armrests
  b.add(rbox(2.1, 0.55, 1.3, 0.06), gold, { p: [throneX, 0.72, -7.3] });
  b.add(taperedBox(1.9, 2.5, 0.35, 0.78, 1), stoneDark, { p: [throneX, 1.95, -7.95] }, { uvScale: 2 });
  b.add(new THREE.PlaneGeometry(1.2, 1.6), goldRelief, { p: [throneX, 1.95, -7.76] });
  b.add(new THREE.BoxGeometry(2.0, 0.12, 0.45), gold, { p: [throneX, 3.24, -7.95] });
  for (const sd of [-1, 1]) {
    b.add(rbox(0.32, 0.7, 1.2, 0.05), gold, { p: [throneX + sd * 1.05, 1.3, -7.3] });
    b.add(sweep([[0, 0, 0], [0, 0.35, 0.18], [0, 0.62, 0.1]], (t) => 0.1 * (1 - t) + 0.07, 12, 8), gold, { p: [throneX + sd * 1.05, 1.62, -6.85] });
    b.add(new THREE.SphereGeometry(0.16, 12, 8), gold, { p: [throneX + sd * 1.05, 2.3, -6.78], s: [1.5, 0.8, 1] });
    b.add(new THREE.SphereGeometry(0.045, 6, 4), violet, { p: [throneX + sd * 1.05 + 0.08, 2.34, -6.66] });
  }
  // cobra guardians flanking the throne
  for (const sd of [-1, 1]) {
    const cx = throneX + sd * 5.2;
    b.add(new THREE.BoxGeometry(1.3, 0.9, 1.3), stoneDark, { p: [cx, 0.9, -7.8] }, { uvScale: 1.5 });
    b.add(new THREE.BoxGeometry(1.4, 0.08, 1.4), gold, { p: [cx, 1.36, -7.8] });
    b.add(sweep([[0, 0, 0], [0.2 * sd, 0.7, 0.2], [-0.15 * sd, 1.4, 0.15], [0, 1.9, 0.35]], (t) => 0.3 * (1 - t * 0.55), 24, 12), stoneDark, { p: [cx, 1.4, -7.8] });
    const hood = new THREE.Shape();
    hood.moveTo(0, -0.45);
    hood.bezierCurveTo(0.85, -0.2, 0.95, 0.7, 0.3, 1.1);
    hood.lineTo(-0.3, 1.1);
    hood.bezierCurveTo(-0.95, 0.7, -0.85, -0.2, 0, -0.45);
    b.add(new THREE.ExtrudeGeometry(hood, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, curveSegments: 8 }), stoneDark, { p: [cx, 3.0, -7.55] });
    b.add(new THREE.ExtrudeGeometry(hood, { depth: 0.04, bevelEnabled: false, curveSegments: 8 }), gold, { p: [cx, 2.98, -7.62], s: [1.1, 1.08, 1] });
    b.add(new THREE.CircleGeometry(0.11, 12), violet, { p: [cx - 0.22, 3.55, -7.34] });
    b.add(new THREE.CircleGeometry(0.11, 12), violet, { p: [cx + 0.22, 3.55, -7.34] });
  }
  lamps.push({ x: throneX, y: 2.8, z: -5, color: 0xc070ff, intensity: 24, distance: 10 });
  lamps.push({ x: throneX, y: 3.2, z: -8.2, color: 0xffc070, intensity: 12, distance: 7 });
  // throne-room pillars and braziers (kept clear of the throne)
  for (let x = tx0 + 1; x < x1; x += 8) {
    if (Math.abs(x - throneX) < 7) continue;
    lotusColumn(b, { stone, gold, paint }, x, -5.2, 12, 0.7);
  }
  for (const sd of [-1, 1]) {
    const [fx, fy, fz] = brazier(b, { stone: stoneDark, gold }, bossX + sd * 8.5, -3.45);
    flames.push([fx, fy, fz, 1.3]);
    lamps.push({ x: fx, y: fy + 0.5, z: fz + 0.8, color: 0xffa040, intensity: 14, distance: 9, flicker: 0.2 });
  }
  obelisk(b, { stone: stoneDark, gold, relief: goldRelief }, tx0 - 1, -3.8, 5.5, 0.7);

  // Temple light shafts falling through the ceiling vents
  const rays = godRays(
    Array.from({ length: 10 }, (_, i) => ({ x: x0 + 5 + i * (len / 10), y: 4, z: -8 - (i % 2) * 5, w: 2.5 + (i % 3), h: 20, tilt: 0.18 })),
    0xffd8a0,
    0.3,
  );
  group.add(rays);
  // hanging lamps over the gallery
  for (let x = x0 + 4; x < x1; x += 12) {
    b.add(lathe([[0.001, 0], [0.22, 0.08], [0.3, 0.2], [0.001, 0.22]], 12), gold, { p: [x, 4.4, -2.8] });
    b.add(new THREE.SphereGeometry(0.12, 8, 6), ember, { p: [x, 4.45, -2.8] });
    b.add(torus(0.3, 0.015, 4, 16), gold, { p: [x, 4.62, -2.8], r: [90, 0, 0] });
  }

  group.add(b.build('static'));
  const look: EnvLook = { ...TEMPLE_LOOK, lamps };
  return {
    group,
    look,
    update(u: EnvUpdate): void {
      updateSigns(signs, u.time);
      for (const [x, y, z, s] of flames) {
        if (Math.abs(x - u.camX) < 12) emitFlame(u.fx, x, y, z, u.dt, s);
      }
      // floating bioluminescent motes
      if (Math.random() < u.dt * 6) {
        u.fx.sparks.spawn({ x: u.camX + (Math.random() - 0.5) * 20, y: -2 + Math.random() * 2, z: -6 - Math.random() * 8, vy: 0.3, vx: (Math.random() - 0.5) * 0.2, life: 3, size: 0.06, color: 0x30ffd0, intensity: 2.5, cell: 0, alpha: 1, alphaEnd: 0 });
      }
    },
    onEvent(_e: SimEvent, _w: World): void {},
    dispose(): void {
      disposeObject(group);
    },
  };
}
