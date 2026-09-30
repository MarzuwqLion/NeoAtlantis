/**
 * 3. TRANSIT TUBE — a glass tunnel across the seabed: gold ribs, glass
 * panels, kelp, glowing coral, fish, a manta and the city skyline below.
 * A tram carries the fight across the seabed: while it runs, everything
 * outside the car scrolls past (the outside layers are periodic so the
 * scroll never shows a seam).
 */
import * as THREE from 'three';
import type { EnvDef } from '../../data/defs';
import type { EnvironmentView, EnvLook, EnvUpdate, Lamp } from './types';
import type { SimEvent, World } from '../../sim/types';
import { Batcher, srand } from './batch';
import { coral, doorway, obelisk, pylon, rock } from './pieces';
import { backdrop, FishSchools, glassMaterial, godRays, kelpField } from './nature';
import { disposeObject, emitBubbles, flatMaterial, goldMaterial, glowMaterial, neonSign, skyline, SubmarinePassers, surfaceMaterial, updateSigns, windowMaterial, type Sign } from './common';
import { floorSet, metalSet, reliefSet, stoneSet, woodSet } from '../textures';
import { cyl, sweep } from '../characters/shapes';

export const TUBE_LOOK: EnvLook = {
  background: 0x021826,
  fog: { color: 0x0a4458, density: 0.012 },
  hemi: { sky: 0x70c8f0, ground: 0x10242a, intensity: 1.35 },
  key: { color: 0xd8f0ff, intensity: 2.2, dir: [0.2, 1, 0.5] },
  fill: { color: 0x30ffd0, intensity: 0.55, dir: [-0.5, 0.2, -0.8] },
  rim: { color: 0x80f8ff, strength: 0.55 },
  caustics: { color: 0x70e8ff, strength: 0.7, scale: 0.24, speed: 0.6 },
  grade: { exposure: 1.06, bloomStrength: 0.75, bloomRadius: 0.6, bloomThreshold: 0.8, saturation: 1.1, contrast: 1.08, vignette: 0.36, lift: 0x000a10, gamma: 0xffffff, gain: 0xeef8ff, tint: 0xf0fcff },
  envMap: {
    top: 0x4ab0d8,
    horizon: 0x0c3a52,
    bottom: 0x02080c,
    panels: [
      { color: 0xd8f4ff, intensity: 5, pos: [0, 12, 6], size: [16, 3] },
      { color: 0x30ffd0, intensity: 3, pos: [-12, 2, -10], size: [8, 4] },
    ],
  },
  dust: 0x8ab8c8,
  accent: 0x40ffd0,
  lamps: [],
  shadowStrength: 0.85,
};

const PERIOD = 20;

export function buildTube(env: EnvDef): EnvironmentView {
  const group = new THREE.Group();
  group.name = 'env:tube';
  const b = new Batcher();
  const rnd = srand(303);
  const x0 = -16;
  const x1 = env.length + 16;
  const mid = (x0 + x1) / 2;
  const len = x1 - x0;
  const tram = env.encounters.find((e) => e.tram);
  const tramX = tram ? tram.lockX : 42;
  const carHalf = 13;

  const floor = surfaceMaterial(floorSet('grate'), {}, 1);
  const hullMetal = surfaceMaterial(metalSet('tube-metal', [70, 90, 104], 128, true), {}, 0.8);
  const tramMetal = surfaceMaterial(metalSet('tram-metal', [196, 176, 120], 256, false), {}, 0.6);
  const stone = surfaceMaterial(stoneSet('tube-stone', { base: [180, 170, 150], blocks: { w: 128, h: 96, mortar: 3 }, seed: 44 }), {}, 0.8);
  const relief = surfaceMaterial(reliefSet('tube-relief', { base: [180, 170, 150], painted: true, cols: 4, rows: 4, seed: 55, gold: true }), {}, 0.7);
  const sand = surfaceMaterial(stoneSet('seabed', { base: [150, 140, 110], seed: 66, variation: 0.1 }), {}, 1.4);
  const rockMat = surfaceMaterial(stoneSet('rock', { base: [80, 88, 90], seed: 77, variation: 0.3 }), {}, 1.2);
  const wood = surfaceMaterial(woodSet('tram-wood', [140, 96, 60]), {}, 0.4);
  const gold = goldMaterial(0.6);
  const dark = new THREE.MeshBasicMaterial({ color: 0x02060a, fog: true });
  const backing = flatMaterial(0x0c1418, 0.4, 0.7, 0.2);
  const strip = glowMaterial(0x9ff4ff, 2.6);
  const bio = glowMaterial(0x30ffc0, 2.2);
  const bioPink = glowMaterial(0xff60c0, 2.0);
  const glass = glassMaterial(0x9ae8ff, 0.12);

  // --- Floor (static) -----------------------------------------------------------
  b.add(new THREE.BoxGeometry(len, 3.2, 12), floor, { p: [mid, -1.6, 2.2] }, { uvScale: 4 });
  // glowing edge strips
  b.add(new THREE.BoxGeometry(len, 0.03, 0.06), strip, { p: [mid, 0.015, -2.95] });
  b.add(new THREE.BoxGeometry(len, 0.03, 0.06), strip, { p: [mid, 0.015, 3.05] });
  // front parapet (bottom of screen)
  b.add(new THREE.BoxGeometry(len, 0.5, 0.4), hullMetal, { p: [mid, 0.25, 4.3] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(len, 0.05, 0.42), gold, { p: [mid, 0.52, 4.3] });

  // --- Stations -------------------------------------------------------------------
  const lamps: Lamp[] = [];
  const signs: Sign[] = [];
  const stations = [
    [x0, tramX - carHalf - 2],
    [tramX + carHalf + 2, x1],
  ] as const;
  for (const [a, c] of stations) {
    b.add(new THREE.BoxGeometry(c - a, 1.0, 0.8), stone, { p: [(a + c) / 2, 0.5, -3.6] }, { uvScale: 2 });
    b.add(new THREE.BoxGeometry(c - a, 0.06, 0.82), gold, { p: [(a + c) / 2, 1.03, -3.6] });
    for (let x = a + 6; x < c - 3; x += 12) {
      pylon(b, { stone, relief, gold, glow: strip }, x, -4.4, 3.2, 5.4, 1.6);
      lamps.push({ x, y: 4, z: -2.5, color: 0xc8f0ff, intensity: 14, distance: 10 });
    }
    for (let x = a + 12; x < c - 3; x += 12) {
      signs.push(neonSign(group, b, backing, `tube-${x}`, [Math.floor(rnd() * 30), 5, Math.floor(rnd() * 30)], '#8ff4ff', x, 2.5, -3.95, 0.7, 0.05));
      // bench
      b.add(new THREE.BoxGeometry(2.2, 0.1, 0.5), wood, { p: [x + 3, 0.5, -2.8] });
      for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.08, 0.5, 0.45), gold, { p: [x + 3 + s * 1.0, 0.25, -2.8] });
    }
  }
  for (const d of env.doors) doorway(b, { stone, gold, dark, relief, glow: strip }, d.x, -3.8, 2.0, 2.9);
  obelisk(b, { stone, gold, relief }, x0 + 8, -3.5, 3.4, 0.5);
  obelisk(b, { stone, gold, relief }, x1 - 10, -3.5, 3.4, 0.5);

  // --- Tram car (static: the world outside moves) -------------------------------
  const ta = tramX - carHalf;
  const tb = tramX + carHalf;
  b.add(new THREE.BoxGeometry(tb - ta, 0.08, 6.3), wood, { p: [tramX, 0.02, 0.1] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(tb - ta, 1.0, 0.3), tramMetal, { p: [tramX, 0.5, -3.3] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(tb - ta, 0.08, 0.34), gold, { p: [tramX, 1.02, -3.3] });
  b.add(new THREE.BoxGeometry(tb - ta, 0.35, 0.3), tramMetal, { p: [tramX, 4.3, -3.3] }, { uvScale: 2 });
  for (let x = ta; x <= tb + 0.01; x += 3.25) {
    b.add(new THREE.BoxGeometry(0.18, 3.4, 0.3), tramMetal, { p: [x, 2.7, -3.3] });
  }
  for (let x = ta + 1.6; x < tb; x += 3.25) {
    const pane = new THREE.PlaneGeometry(3.05, 3.2);
    const m = new THREE.Mesh(pane, glass);
    m.position.set(x, 2.7, -3.3);
    m.renderOrder = 6;
    group.add(m);
  }
  b.add(new THREE.BoxGeometry(tb - ta, 0.05, 0.08), strip, { p: [tramX, 4.1, -3.12] });
  // grab bars along the front
  b.add(sweep([[ta, 0.35, 3.45], [tramX, 0.35, 3.45], [tb, 0.35, 3.45]], () => 0.03, 20, 6), gold);
  for (let x = ta + 1.6; x < tb; x += 3.25) b.add(cyl(0.03, 0.03, 3.4, 8), gold, { p: [x, 2.7, -2.9] });
  // end frames
  for (const x of [ta, tb]) {
    b.add(new THREE.BoxGeometry(0.4, 4.6, 0.4), tramMetal, { p: [x, 2.3, -3.1] });
    b.add(new THREE.BoxGeometry(0.4, 1.2, 0.4), tramMetal, { p: [x, 0.6, 3.2] });
  }
  lamps.push({ x: tramX - 7, y: 3.8, z: 0, color: 0xe8f8ff, intensity: 16, distance: 12 });
  lamps.push({ x: tramX + 7, y: 3.8, z: 0, color: 0xe8f8ff, intensity: 16, distance: 12 });
  signs.push(neonSign(group, b, backing, 'tram', [3, 19, 25], '#40ffd0', tramX, 3.75, -3.12, 0.45, 0));

  // --- Outside the tube (scrolls with the tram, periodic) ------------------------
  const outside = new Batcher();
  const ox0 = x0 - PERIOD * 2;
  const ox1 = x1 + PERIOD * 2;
  const kelp: [number, number, number, number][] = [];
  for (let k = ox0; k < ox1; k += PERIOD) {
    const r = srand(909);
    for (let i = 0; i < 4; i++) {
      const x = k + i * 5;
      // rib: quarter-arc from the back floor up over the lane
      outside.add(new THREE.TorusGeometry(6.2, 0.14, 6, 18, Math.PI / 2), gold, { p: [x, 0, 2.8], r: [0, -90, 90] });
      outside.add(new THREE.TorusGeometry(6.2, 0.04, 4, 18, Math.PI / 2), strip, { p: [x, 0, 2.62], r: [0, -90, 90] });
    }
    // seabed: rocks, coral, kelp
    for (let i = 0; i < 6; i++) rock(outside, rockMat, k + r() * PERIOD, -1.2 + r() * 0.4, -5 - r() * 12, 0.6 + r() * 1.6, 11 + i);
    for (let i = 0; i < 5; i++) coral(outside, r() < 0.5 ? bio : bioPink, k + r() * PERIOD, -1.0, -4.8 - r() * 5, 0.9 + r() * 0.8, 23 + i);
    for (let i = 0; i < 14; i++) kelp.push([k + r() * PERIOD, -1.3, -4.6 - r() * 9, 2.5 + r() * 4]);
  }
  // Tube base wall and sand
  outside.add(new THREE.BoxGeometry(ox1 - ox0, 0.9, 0.5), hullMetal, { p: [(ox0 + ox1) / 2, -0.4, -3.6] }, { uvScale: 2 });
  const sandGeo = new THREE.PlaneGeometry(ox1 - ox0, 70, 1, 1);
  outside.add(sandGeo, sand, { p: [(ox0 + ox1) / 2, -3, -38], r: [-84, 0, 0] }, { uvScale: 6 });
  const outsideGroup = outside.build('outside');
  const kelpMesh = kelpField(kelp, 0x1a5a3a, 0x0a3a20);
  outsideGroup.add(kelpMesh);
  // glass panels (curved) along the tube
  const tubeGlass = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, ox1 - ox0, 24, 1, true, Math.PI / 2, Math.PI / 2), glass);
  tubeGlass.rotation.z = Math.PI / 2;
  tubeGlass.position.set((ox0 + ox1) / 2, 0, 2.8);
  tubeGlass.renderOrder = 6;
  outsideGroup.add(tubeGlass);
  group.add(outsideGroup);

  // --- Far layers (slow parallax) --------------------------------------------------
  const far = new Batcher();
  const cityStone = flatMaterial(0x28485a, 0.7, 0.2, 0.2);
  const cityWin = windowMaterial('tube-city', '#ffd080', '#80f8ff', 0x162834);
  skyline(far, x0 - 200, x1 + 200, -55, -100, -30, 33, cityStone, cityWin, gold, strip);
  for (let x = x0 - 150; x < x1 + 150; x += 22) rock(far, rockMat, x + rnd() * 10, -12 - rnd() * 4, -25 - rnd() * 15, 4 + rnd() * 5, 99 + x);
  const farGroup = far.build('far');
  group.add(farGroup);
  const bd = backdrop(1200, 260, 0x0a4a66, 0x01060c, 0x30c0e0);
  bd.position.set(mid, -40, -170);
  group.add(bd);
  const rays = godRays(
    Array.from({ length: 10 }, (_, i) => ({ x: x0 - 20 + i * ((len + 40) / 9), y: 6, z: -14 - (i % 3) * 8, w: 4 + (i % 2) * 3, h: 36, tilt: 0.2 })),
    0x9af0ff,
    0.4,
  );
  group.add(rays);
  const fish = new FishSchools(
    [
      { cx: 30, cy: 1.5, cz: -12, range: 50, speed: 1.6, count: 44, size: 0.45, spread: [7, 2.5, 4] },
      { cx: 80, cy: 3, cz: -20, range: 60, speed: 1.2, count: 40, size: 0.55, spread: [8, 3, 5] },
      { cx: 50, cy: -3, cz: -30, range: 80, speed: 0.9, count: 30, size: 0.8, spread: [10, 3, 6] },
    ],
    0x9ac8d8,
    0x0a3040,
  );
  group.add(fish.mesh);
  // Manta ray gliding
  const manta = new THREE.Group();
  const mantaMat = flatMaterial(0x1a2a3a, 0.5, 0.2, 0.5);
  const wing = new THREE.Shape();
  wing.moveTo(0, 0.6);
  wing.quadraticCurveTo(1.6, 0.2, 2.6, -0.4);
  wing.quadraticCurveTo(1.2, -0.3, 0, -0.9);
  wing.quadraticCurveTo(-1.2, -0.3, -2.6, -0.4);
  wing.quadraticCurveTo(-1.6, 0.2, 0, 0.6);
  const mantaBody = new THREE.Mesh(new THREE.ShapeGeometry(wing, 12), mantaMat);
  mantaBody.rotation.x = -Math.PI / 2;
  manta.add(mantaBody);
  const tail = new THREE.Mesh(cyl(0.02, 0.05, 2.2, 5), mantaMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -1.8;
  manta.add(tail);
  manta.scale.setScalar(1.6);
  group.add(manta);
  const subs = new SubmarinePassers(tramMetal, strip, [
    { y: -4, z: -45, len: 22, speed: 2.5, x0: x0 - 80, range: len + 160 },
    { y: -12, z: -80, len: 34, speed: -1.6, x0: x1 + 80, range: len + 160 },
  ]);
  group.add(subs.group);

  group.add(b.build('static'));
  const look: EnvLook = { ...TUBE_LOOK, lamps };
  let tramDist = 0;

  return {
    group,
    look,
    update(u: EnvUpdate): void {
      const speed = u.world.level.tramSpeed * 17;
      tramDist += speed * u.dt;
      outsideGroup.position.x = -(tramDist % PERIOD);
      farGroup.position.x = -tramDist * 0.08;
      fish.update(u.time, -tramDist * 0.3);
      subs.update(u.time);
      subs.group.position.x = -tramDist * 0.15;
      updateSigns(signs, u.time);
      const mt = u.time * 0.05;
      manta.position.set(u.camX + Math.sin(mt) * 30 - tramDist * 0.3 % 60, 2 + Math.sin(u.time * 0.4) * 0.8, -18);
      manta.rotation.y = Math.cos(mt) > 0 ? -Math.PI / 2 : Math.PI / 2;
      mantaBody.rotation.y = Math.sin(u.time * 1.3) * 0.25;
      emitBubbles(u.fx, u.camX, u.dt, 3 + speed * 0.6, -9, -3.9, -1, 0xa0f0ff);
      if (speed > 1) {
        // streaking light motes outside the glass while the tram runs
        if (Math.random() < u.dt * speed * 2) {
          u.fx.sparks.spawn({ x: u.camX + 10, y: 0.5 + Math.random() * 4, z: -3.8 - Math.random() * 3, vx: -speed * 1.4, life: 0.8, size: 0.06, color: 0x9ff4ff, intensity: 2.5, stretch: 0.02, cell: 0 });
        }
      }
    },
    onEvent(_e: SimEvent, _w: World): void {},
    dispose(): void {
      disposeObject(group);
    },
  };
}
