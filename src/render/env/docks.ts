/**
 * 1. HARBOR DOCKS — submarine pens, cargo stacks, cranes and a sodium-lit
 * quay over dark water, under the dome. Teal ocean fog, warm work lights,
 * cyan glyph signage.
 */
import * as THREE from 'three';
import type { EnvDef } from '../../data/defs';
import type { EnvironmentView, EnvLook, EnvUpdate, Lamp } from './types';
import type { SimEvent, World } from '../../sim/types';
import { Batcher, srand } from './batch';
import { amphora, container, crane, crate, doorway, lampPost, pylon, rock, submarine, obelisk } from './pieces';
import { backdrop, FishSchools, godRays, glassMaterial, water } from './nature';
import { disposeObject, emitBubbles, flatMaterial, goldMaterial, glowMaterial, neonSign, skyline, SubmarinePassers, surfaceMaterial, updateSigns, windowMaterial, type Sign } from './common';
import { containerSet, floorSet, metalSet, reliefSet, stoneSet } from '../textures';
import { cyl, torus } from '../characters/shapes';

export const DOCKS_LOOK: EnvLook = {
  background: 0x06202c,
  fog: { color: 0x0b3646, density: 0.014 },
  hemi: { sky: 0x6ab8d0, ground: 0x3a2a1a, intensity: 1.3 },
  key: { color: 0xffe6c0, intensity: 2.5, dir: [0.4, 1, 0.55] },
  fill: { color: 0x3aa0c8, intensity: 0.7, dir: [-0.6, 0.4, -0.5] },
  rim: { color: 0x7fe0ff, strength: 0.5 },
  caustics: { color: 0x6fd8ff, strength: 0.55, scale: 0.2, speed: 0.55 },
  grade: { exposure: 1.05, bloomStrength: 0.62, bloomRadius: 0.55, bloomThreshold: 0.85, saturation: 1.1, contrast: 1.06, vignette: 0.34, lift: 0x02080c, gamma: 0xffffff, gain: 0xfff4ea, tint: 0xf4fbff },
  envMap: {
    top: 0x3a8aa8,
    horizon: 0x164a5c,
    bottom: 0x0a0806,
    panels: [
      { color: 0xffc070, intensity: 5, pos: [12, 8, 10], size: [8, 4] },
      { color: 0x80e0ff, intensity: 3, pos: [-14, 10, -6], size: [10, 6] },
    ],
  },
  dust: 0x9aa8a0,
  accent: 0x6ff4ff,
  lamps: [],
  shadowStrength: 0.8,
};

export function buildDocks(env: EnvDef): EnvironmentView {
  const group = new THREE.Group();
  group.name = 'env:docks';
  const b = new Batcher();
  const rnd = srand(101);
  const x0 = -16;
  const x1 = env.length + 16;
  const mid = (x0 + x1) / 2;
  const len = x1 - x0;

  const floorSurf = floorSet('dock');
  const floor = surfaceMaterial(floorSurf, {}, 1);
  const stone = surfaceMaterial(stoneSet('docks-sand', { base: [196, 160, 116], blocks: { w: 128, h: 64, mortar: 3 }, seed: 3 }), {}, 0.9);
  const stoneDark = surfaceMaterial(stoneSet('docks-sand-dark', { base: [120, 100, 80], blocks: { w: 96, h: 96, mortar: 3 }, seed: 5 }), {}, 0.7);
  const relief = surfaceMaterial(reliefSet('docks-relief', { base: [196, 160, 116], painted: true, cols: 4, rows: 5, seed: 21 }), {}, 0.8);
  const metal = surfaceMaterial(metalSet('docks-metal', [60, 86, 96]), {}, 0.6);
  const hull = surfaceMaterial(metalSet('docks-hull', [150, 120, 70], 256, true), {}, 0.5);
  const gold = goldMaterial(0.5);
  const bronze = flatMaterial(0x9a6a36, 0.4, 0.9, 0.5);
  const rope = flatMaterial(0x8a7050, 0.9, 0, 0.3);
  const dark = new THREE.MeshBasicMaterial({ color: 0x020406, fog: true });
  const backing = flatMaterial(0x14181c, 0.5, 0.6, 0.2);
  const sodium = glowMaterial(0xffb050, 3.2);
  const cyan = glowMaterial(0x5ff2ff, 2.4);
  const redGlow = glowMaterial(0xff4030, 2.2);
  const containerMats = [
    surfaceMaterial(containerSet('red', [150, 52, 40], 18), {}, 0.6),
    surfaceMaterial(containerSet('teal', [36, 112, 112], 0), {}, 0.6),
    surfaceMaterial(containerSet('ochre', [176, 128, 52], 4), {}, 0.6),
    surfaceMaterial(containerSet('blue', [40, 70, 130], 16), {}, 0.6),
  ];

  // --- Ground: quay slab, coping, front wall, water -------------------------
  b.add(new THREE.BoxGeometry(len, 0.6, 8.2), floor, { p: [mid, -0.3, 0.3] }, { uvScale: 4 });
  b.add(new THREE.BoxGeometry(len, 0.22, 0.6), stoneDark, { p: [mid, 0.05, 4.6] }, { uvScale: 1.5 });
  b.add(new THREE.BoxGeometry(len, 0.04, 0.62), gold, { p: [mid, 0.17, 4.6] });
  b.add(new THREE.BoxGeometry(len, 1.4, 0.4), stoneDark, { p: [mid, -0.75, 4.75] }, { uvScale: 1.5 });
  // hazard stripes along the edge
  for (let x = x0; x < x1; x += 1.2) b.add(new THREE.BoxGeometry(0.5, 0.012, 0.18), gold, { p: [x, 0.006, 4.05], r: [0, 35, 0] });
  const sea = water(len + 60, 40, 0x03222c, 0x0c5a66, 0x40c0d8);
  sea.position.set(mid, -0.9, 25);
  group.add(sea);

  // Bollards, mooring rings and ropes on the front edge
  for (let x = x0 + 3; x < x1; x += 6.5) {
    b.add(cyl(0.2, 0.26, 0.55, 12), bronze, { p: [x, 0.28, 4.3] });
    b.add(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bronze, { p: [x, 0.55, 4.3] });
    b.add(torus(0.24, 0.05, 6, 16), rope, { p: [x, 0.2, 4.3], r: [90, 0, 0], s: [1, 1, 1] });
  }

  // --- Back: warehouse wall with pylons, pens, doors, container stacks ------
  const lamps: Lamp[] = [];
  const signs: Sign[] = [];
  const doorXs = env.doors.map((d) => d.x);
  const penXs = [26, 70];
  const wallZ = -4.3;
  // Wall segments (skip pen openings)
  let wx = x0;
  const segs: [number, number][] = [];
  for (const px of penXs) {
    segs.push([wx, px - 5]);
    wx = px + 5;
  }
  segs.push([wx, x1]);
  for (const [a, c] of segs) {
    b.add(new THREE.BoxGeometry(c - a, 5.2, 1.2), stone, { p: [(a + c) / 2, 2.6, wallZ - 0.6] }, { uvScale: 3 });
    b.add(new THREE.BoxGeometry(c - a, 0.25, 1.35), stoneDark, { p: [(a + c) / 2, 5.25, wallZ - 0.6] }, { uvScale: 2 });
    b.add(new THREE.BoxGeometry(c - a, 0.35, 1.3), stoneDark, { p: [(a + c) / 2, 0.17, wallZ - 0.55] }, { uvScale: 2 });
    b.add(new THREE.BoxGeometry(c - a, 0.05, 0.02), cyan, { p: [(a + c) / 2, 4.6, wallZ + 0.01] });
  }
  // Relief friezes on the wall between features
  for (let x = x0 + 4; x < x1 - 4; x += 9) {
    if (penXs.some((p) => Math.abs(p - x) < 7) || doorXs.some((d) => Math.abs(d - x) < 3)) continue;
    b.add(new THREE.PlaneGeometry(3.4, 2.6), relief, { p: [x, 2.7, wallZ + 0.01] });
  }
  // Doors
  for (const dx of doorXs) {
    doorway(b, { stone: stoneDark, gold, dark, relief, glow: cyan }, dx, wallZ + 0.1, 2.2, 3.1);
  }
  // Pylons flanking the pens
  for (const px of penXs) {
    for (const s of [-1, 1]) pylon(b, { stone, relief, gold, glow: sodium }, px + s * 6.2, wallZ - 0.8, 3.6, 7.2, 2.2);
    // pen interior: basin water, side walls, a docked submarine
    const pen = water(10, 14, 0x021a22, 0x0a4a55, 0x3ab8d0);
    pen.position.set(px, -0.95, wallZ - 7);
    group.add(pen);
    b.add(new THREE.BoxGeometry(10.5, 0.4, 0.6), stoneDark, { p: [px, -0.2, wallZ + 0.1] }, { uvScale: 1.5 });
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.8, 6, 14), stone, { p: [px + s * 5.3, 2, wallZ - 7] }, { uvScale: 3 });
    b.add(new THREE.BoxGeometry(11.4, 7, 0.8), stoneDark, { p: [px, 2.4, wallZ - 14] }, { uvScale: 3 });
    submarine(b, { hull, gold, glow: sodium, dark }, px + 0.5, -0.6, wallZ - 6.5, 9, px > 50);
    lamps.push({ x: px, y: 3.5, z: wallZ - 4, color: 0x60d8ff, intensity: 18, distance: 14 });
    signs.push(neonSign(group, b, backing, `pen-${px}`, [16, 27, 5], '#5ff2ff', px, 6.6, wallZ - 0.2, 0.9, 0.2));
  }
  // Container stacks in front of the wall (behind the lane)
  for (let x = x0 + 2; x < x1 - 2; x += 0) {
    const w = 6;
    if (penXs.some((p) => Math.abs(p - (x + w / 2)) < 8) || doorXs.some((d) => Math.abs(d - (x + w / 2)) < 5)) {
      x += 3;
      continue;
    }
    const tiers = 1 + Math.floor(rnd() * 2.2);
    for (let t = 0; t < tiers; t++) {
      const m = containerMats[Math.floor(rnd() * containerMats.length)]!;
      container(b, m, metal, x + w / 2 + (rnd() - 0.5) * 0.4, t * 2.6, wallZ + 1.0 - (t === 0 ? 0 : 0.2), w, 2.55, 2.4, (rnd() - 0.5) * 3);
    }
    x += w + 2 + rnd() * 6;
  }
  // Cranes rising behind the wall
  for (const cx of [14, 48, 84]) crane(b, { metal, gold, glow: redGlow }, cx, wallZ - 9, 10, 9);
  // Obelisk markers
  for (const ox of [4, 58, 97]) obelisk(b, { stone: stoneDark, gold, relief }, ox, wallZ + 0.3, 4.2, 0.6);

  // --- Lane dressing: crates, jars, rope coils ------------------------------
  for (let x = x0 + 5; x < x1 - 5; x += 7 + rnd() * 6) {
    const side = rnd() < 0.5 ? -3.25 : 3.6;
    if (side < 0) crate(b, stoneDark, bronze, x, 0, side, 0.8, rnd() * 30);
    else {
      amphora(b, stoneDark, x, 0, side, 1.1);
      amphora(b, stoneDark, x + 0.45, 0, side - 0.1, 0.9);
    }
    b.add(torus(0.25, 0.06, 6, 14), rope, { p: [x + 1.3, 0.06, side * 0.95], r: [90, 0, 0] });
  }
  // Lamp posts along the quay edge
  for (let x = x0 + 6; x < x1; x += 15) {
    if (penXs.some((p) => Math.abs(p - x) < 7) || doorXs.some((d) => Math.abs(d - x) < 2.5)) continue;
    const [lx, ly, lz] = lampPost(b, { metal, gold, glow: sodium }, x, -3.35, 4.3);
    lamps.push({ x: lx, y: ly, z: lz, color: 0xffb060, intensity: 22, distance: 11 });
  }
  // Neon glyph signs on the wall
  for (let x = x0 + 12; x < x1 - 8; x += 17) {
    if (penXs.some((p) => Math.abs(p - x) < 7)) continue;
    const glyphs = [Math.floor(rnd() * 30), Math.floor(rnd() * 30), Math.floor(rnd() * 30)];
    signs.push(neonSign(group, b, backing, `dock-${x}`, glyphs, rnd() < 0.5 ? '#5ff2ff' : '#ff9a40', x, 4.0, wallZ + 0.05, 0.75, rnd() < 0.4 ? 0.6 : 0));
  }

  // --- Far background: dome ribs, lower city, ocean -------------------------
  const far = new Batcher();
  const cityStone = flatMaterial(0x2a4a58, 0.7, 0.2, 0.2);
  const cityWin = windowMaterial('docks-city', '#ffc070', '#80f0ff', 0x1a2a34);
  skyline(far, x0 - 40, x1 + 40, -60, -110, -24, 11, cityStone, cityWin, gold, cyan);
  for (let x = x0 - 20; x < x1 + 20; x += 16) {
    far.add(new THREE.TorusGeometry(30, 0.35, 6, 40, Math.PI), bronze, { p: [x, -8, -40], r: [0, 0, 0] });
  }
  for (let x = x0; x < x1; x += 13) rock(far, stoneDark, x + rnd() * 6, -10 + rnd() * 2, -26 - rnd() * 10, 3 + rnd() * 3, 7 + x);
  group.add(far.build('far'));
  const domeGlass = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 60, 48, 1, true, Math.PI / 2, Math.PI), glassMaterial(0x6ad0e8, 0.08));
  domeGlass.position.set(mid, -10, -2);
  domeGlass.rotation.z = Math.PI / 2;
  domeGlass.renderOrder = 6;
  group.add(domeGlass);
  const bd = backdrop(900, 260, 0x0e5068, 0x010a10, 0x3ab8d0);
  bd.position.set(mid, -40, -160);
  group.add(bd);
  const rays = godRays(
    Array.from({ length: 9 }, (_, i) => ({ x: x0 + i * (len / 8), y: 4, z: -18 - (i % 3) * 6, w: 5 + (i % 2) * 3, h: 30, tilt: 0.22 })),
    0x8ae8ff,
    0.35,
  );
  group.add(rays);
  const fish = new FishSchools(
    [
      { cx: 20, cy: -2, cz: -30, range: 60, speed: 1.4, count: 40, size: 0.5, spread: [8, 3, 6] },
      { cx: 70, cy: 1, cz: -40, range: 70, speed: 1.1, count: 36, size: 0.6, spread: [9, 3, 6] },
      { cx: 45, cy: -6, cz: -22, range: 50, speed: 1.8, count: 26, size: 0.35, spread: [5, 2, 4] },
    ],
    0x8aa8b0,
    0x103040,
  );
  group.add(fish.mesh);
  const subs = new SubmarinePassers(hull, sodium, [
    { y: -6, z: -70, len: 26, speed: 2.2, x0: x0 - 60, range: len + 120 },
    { y: -14, z: -95, len: 38, speed: -1.4, x0: x1 + 60, range: len + 120 },
  ]);
  group.add(subs.group);

  group.add(b.build('static'));
  const look: EnvLook = { ...DOCKS_LOOK, lamps };

  return {
    group,
    look,
    update(u: EnvUpdate): void {
      fish.update(u.time);
      subs.update(u.time);
      updateSigns(signs, u.time);
      emitBubbles(u.fx, u.camX, u.dt, 2.5, -8, -3.6, -1, 0x9fe8ff);
    },
    onEvent(_e: SimEvent, _w: World): void {},
    dispose(): void {
      disposeObject(group);
    },
  };
}
