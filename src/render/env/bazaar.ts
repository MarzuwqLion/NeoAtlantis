/**
 * 2. BAZAAR AVENUE — market stalls under striped awnings, hanging lanterns,
 * flickering neon hieroglyph signs, busy crowds behind the stalls and
 * sandstone townhouses. Ends at the Warden Gate (mid-boss arena).
 */
import * as THREE from 'three';
import type { EnvDef } from '../../data/defs';
import type { EnvironmentView, EnvLook, EnvUpdate, Lamp } from './types';
import type { SimEvent, World } from '../../sim/types';
import { Batcher, srand } from './batch';
import { amphora, crate, doorway, lotusColumn, planter, pylon, stall, taperedBox, obelisk } from './pieces';
import { crowd, godRays } from './nature';
import { disposeObject, emitBubbles, flatMaterial, goldMaterial, glowMaterial, neonSign, surfaceMaterial, updateSigns, type Sign } from './common';
import { clothTexture, floorSet, reliefSet, stoneSet, woodSet } from '../textures';
import { cyl, sweep, torus, lathe } from '../characters/shapes';

export const BAZAAR_LOOK: EnvLook = {
  background: 0x1a0c26,
  fog: { color: 0x221638, density: 0.016 },
  hemi: { sky: 0x7a78d0, ground: 0x2a1c18, intensity: 1.05 },
  key: { color: 0xe8dcff, intensity: 2.0, dir: [0.35, 1, 0.6] },
  fill: { color: 0xc060c0, intensity: 0.4, dir: [-0.5, 0.3, -0.6] },
  rim: { color: 0xd8a0ff, strength: 0.42 },
  caustics: { color: 0x9ad8ff, strength: 0.28, scale: 0.18, speed: 0.45 },
  grade: { exposure: 1.08, bloomStrength: 0.8, bloomRadius: 0.6, bloomThreshold: 0.8, saturation: 1.18, contrast: 1.05, vignette: 0.36, lift: 0x0a020c, gamma: 0xffffff, gain: 0xfff0f6, tint: 0xfff4fa },
  envMap: {
    top: 0x6a3a9a,
    horizon: 0x3a1a3a,
    bottom: 0x100808,
    panels: [
      { color: 0xffa060, intensity: 5, pos: [10, 6, 10], size: [8, 4] },
      { color: 0xff50c0, intensity: 4, pos: [-12, 8, -8], size: [6, 6] },
      { color: 0x50e0ff, intensity: 3, pos: [0, 12, -12], size: [8, 3] },
    ],
  },
  dust: 0xb08a78,
  accent: 0xff6ad8,
  lamps: [],
  shadowStrength: 0.8,
};

const AWNINGS: [string, 'stripes' | 'diamond' | 'zigzag', string[]][] = [
  ['aw1', 'stripes', ['#c8342c', '#f0e0c0', '#c8342c', '#2a6aa8']],
  ['aw2', 'stripes', ['#1f7d78', '#f2d890', '#1f7d78', '#f2d890']],
  ['aw3', 'diamond', ['#6a1a6a', '#f0b040', '#1a1030']],
  ['aw4', 'zigzag', ['#f0e2c0', '#2a5aa8', '#c83a2a', '#e0a030']],
  ['aw5', 'stripes', ['#e0a030', '#5a1446', '#e0a030', '#f0e2c0']],
];

export function buildBazaar(env: EnvDef): EnvironmentView {
  const group = new THREE.Group();
  group.name = 'env:bazaar';
  const b = new Batcher();
  const rnd = srand(202);
  const x0 = -16;
  const x1 = env.length + 16;
  const mid = (x0 + x1) / 2;
  const len = x1 - x0;

  const floor = surfaceMaterial(stoneSet('bazaar-paving', { base: [150, 136, 128], blocks: { w: 256, h: 128, mortar: 5 }, seed: 17, variation: 0.22, roughness: 0.75 }), {}, 0.6);
  const mosaic = surfaceMaterial(floorSet('mosaic'), {}, 0.5);
  const stone = surfaceMaterial(stoneSet('bazaar-sand', { base: [206, 170, 128], blocks: { w: 160, h: 64, mortar: 3 }, seed: 9 }), {}, 0.5);
  const plaster = surfaceMaterial(stoneSet('bazaar-plaster', { base: [214, 186, 150], seed: 14, variation: 0.08 }), {}, 0.4);
  const stoneDark = surfaceMaterial(stoneSet('bazaar-dark', { base: [120, 92, 80], blocks: { w: 96, h: 96, mortar: 3 }, seed: 15 }), {}, 0.4);
  const relief = surfaceMaterial(reliefSet('bazaar-relief', { base: [206, 170, 128], painted: true, cols: 5, rows: 4, seed: 33 }), {}, 0.4);
  const wood = surfaceMaterial(woodSet('bazaar-wood', [128, 84, 50]), {}, 0.3);
  const gold = goldMaterial(0.3);
  const dark = new THREE.MeshBasicMaterial({ color: 0x06030a, fog: true });
  const backing = flatMaterial(0x140c18, 0.5, 0.6, 0.1);
  const lantern = glowMaterial(0xffb060, 3);
  const pinkGlow = glowMaterial(0xff5ab8, 2.6);
  const cyanGlow = glowMaterial(0x5ff2ff, 2.4);
  const windowGlow = glowMaterial(0xffb070, 0.85);
  const leaf = flatMaterial(0x2e6a3a, 0.7, 0, 0.2);
  const goods = [flatMaterial(0xd84a2a, 0.6, 0, 0.2), flatMaterial(0xe8b030, 0.6, 0, 0.2), flatMaterial(0x6aa83a, 0.6, 0, 0.2), flatMaterial(0x8a4ab0, 0.5, 0.1, 0.2), flatMaterial(0xb2683e, 0.8, 0, 0.2)];
  const awnings = AWNINGS.map(([k, s, c]) => flatMaterial(0xffffff, 0.85, 0, 0.3, { map: clothTexture(k, s, c), side: THREE.DoubleSide }));
  const rugs = [
    flatMaterial(0xffffff, 0.9, 0, 0.4, { map: clothTexture('rug1', 'rug', ['#5a1a1a', '#c83a2a', '#1a2a5a', '#e0a030']) }),
    flatMaterial(0xffffff, 0.9, 0, 0.4, { map: clothTexture('rug2', 'rug', ['#1a3a3a', '#2a8a7a', '#5a1446', '#f0d890']) }),
  ];

  // --- Ground ---------------------------------------------------------------
  b.add(new THREE.BoxGeometry(len, 0.6, 12), floor, { p: [mid, -0.3, 1.85] }, { uvScale: 3.2 });
  // mosaic inlay strip along the back of the lane
  b.add(new THREE.BoxGeometry(len, 0.02, 1.1), mosaic, { p: [mid, 0.005, -2.6] }, { uvScale: 5 });
  for (let x = x0 + 8; x < x1; x += 14 + rnd() * 8) {
    b.add(new THREE.PlaneGeometry(2.6, 1.6), rugs[Math.floor(rnd() * rugs.length)]!, { p: [x, 0.012, rnd() < 0.5 ? -2.2 : 2.4], r: [-90, 0, rnd() * 20 - 10] });
  }
  // Front dressing: planters, crates of fruit, jars (bottom of the screen)
  for (let x = x0 + 4; x < x1; x += 9 + rnd() * 5) {
    const r = rnd();
    if (r < 0.4) planter(b, { stone: stoneDark, leaf }, x, 4.9);
    else if (r < 0.7) {
      crate(b, wood, stoneDark, x, 0, 4.7, 0.7, rnd() * 20);
      for (let i = 0; i < 4; i++) b.add(new THREE.SphereGeometry(0.12, 8, 6), goods[Math.floor(rnd() * 3)]!, { p: [x - 0.2 + (i % 2) * 0.35, 0.78, 4.6 + Math.floor(i / 2) * 0.25] });
    } else {
      amphora(b, stoneDark, x, 0, 4.8, 1.2);
      amphora(b, goods[4]!, x + 0.5, 0, 4.6, 0.8);
    }
  }

  // --- Back: stalls, crowd, townhouses ---------------------------------------
  const lamps: Lamp[] = [];
  const signs: Sign[] = [];
  const doorXs = env.doors.map((d) => d.x);
  const bossX = env.encounters[env.encounters.length - 1]!.lockX;
  const stallZ = -3.75;
  const houseZ = -6.2;
  const crowdPos: [number, number, number][] = [];
  for (let x = x0 + 2; x < x1 - 2; ) {
    const w = 3 + rnd() * 1.4;
    const cx = x + w / 2;
    const nearDoor = doorXs.some((d) => Math.abs(d - cx) < 2.6 + w / 2);
    const nearBoss = cx > bossX - 12;
    if (!nearDoor && !nearBoss) {
      stall(b, { wood, cloth: awnings[Math.floor(rnd() * awnings.length)]!, goods, counter: wood }, cx, stallZ, w, 2.4);
      b.add(new THREE.SphereGeometry(0.13, 10, 8), lantern, { p: [cx - w * 0.25, 2.25, stallZ + 0.1] });
      b.add(new THREE.SphereGeometry(0.13, 10, 8), lantern, { p: [cx + w * 0.25, 2.25, stallZ + 0.1] });
      lamps.push({ x: cx, y: 2.1, z: stallZ + 0.4, color: 0xffa860, intensity: 6, distance: 6 });
      for (let i = 0; i < 3; i++) crowdPos.push([x + rnd() * w, 0, -4.9 - rnd() * 0.6]);
    }
    x += w + 0.4 + (rnd() < 0.3 ? 2 : 0);
  }
  group.add(
    crowd(crowdPos, ['#3a2a4a', '#5a3a2a', '#2a3a4a', '#4a2a3a', '#6a5040', '#2a2a2a', '#503060']),
  );
  // Townhouses: sandstone facades with windows, balconies and signage
  for (let x = x0; x < x1; ) {
    const w = 6 + rnd() * 4;
    const h = 6.5 + rnd() * 2.5;
    const cx = x + w / 2;
    const mat = rnd() < 0.5 ? stone : plaster;
    b.add(taperedBox(w, h, 3, 0.97, 1), mat, { p: [cx, h / 2, houseZ - 1.5] }, { uvScale: 3 });
    b.add(new THREE.BoxGeometry(w + 0.2, 0.35, 3.3), stoneDark, { p: [cx, h + 0.1, houseZ - 1.5] }, { uvScale: 2 });
    b.add(new THREE.BoxGeometry(w + 0.25, 0.06, 3.35), gold, { p: [cx, h + 0.3, houseZ - 1.5] });
    // windows (two rows)
    for (let row = 0; row < 2; row++) {
      for (let wx = cx - w / 2 + 1.2; wx < cx + w / 2 - 0.8; wx += 1.8) {
        const lit = rnd() < 0.6;
        b.add(new THREE.BoxGeometry(1.0, 1.32, 0.12), stoneDark, { p: [wx, 3.4 + row * 2.3, houseZ + 0.02] }, { uvScale: 1 });
        b.add(new THREE.PlaneGeometry(0.72, 1.02), lit ? windowGlow : dark, { p: [wx, 3.4 + row * 2.3, houseZ + 0.085] });
        b.add(new THREE.BoxGeometry(0.06, 1.02, 0.04), stoneDark, { p: [wx, 3.4 + row * 2.3, houseZ + 0.1] });
        b.add(new THREE.BoxGeometry(1.0, 0.12, 0.2), stoneDark, { p: [wx, 3.4 + row * 2.3 - 0.62, houseZ + 0.08] });
      }
    }
    // balcony with railing
    if (rnd() < 0.5) {
      b.add(new THREE.BoxGeometry(w * 0.6, 0.15, 0.9), stoneDark, { p: [cx, 4.4, houseZ + 0.45] });
      for (let bx = cx - w * 0.28; bx < cx + w * 0.3; bx += 0.3) b.add(cyl(0.03, 0.03, 0.7, 6), gold, { p: [bx, 4.8, houseZ + 0.85] });
      b.add(new THREE.BoxGeometry(w * 0.6, 0.05, 0.06), gold, { p: [cx, 5.15, houseZ + 0.85] });
    }
    // relief band
    b.add(new THREE.PlaneGeometry(w * 0.8, 1.0), relief, { p: [cx, 2.1, houseZ + 0.01] });
    // neon sign
    if (rnd() < 0.75) {
      const glyphs = [Math.floor(rnd() * 30), Math.floor(rnd() * 30)];
      if (rnd() < 0.5) glyphs.push(Math.floor(rnd() * 30));
      const col = ['#ff5ab8', '#5ff2ff', '#ffc040', '#b070ff'][Math.floor(rnd() * 4)]!;
      signs.push(neonSign(group, b, backing, `baz-${x.toFixed(1)}`, glyphs, col, cx + (rnd() - 0.5) * 2, 4.3 + rnd() * 1.4, houseZ + 0.08, 0.7 + rnd() * 0.3, rnd() < 0.5 ? 0.8 : 0.1));
      lamps.push({ x: cx, y: 4.5, z: houseZ + 1.5, color: col === '#ff5ab8' ? 0xff5ab8 : col === '#5ff2ff' ? 0x5ff2ff : col === '#ffc040' ? 0xffc040 : 0xb070ff, intensity: 7, distance: 8 });
    }
    x += w;
  }
  // Doorways into the townhouses (enemy entrances)
  for (const dx of doorXs) doorway(b, { stone: stoneDark, gold, dark, relief, glow: pinkGlow }, dx, houseZ + 0.35, 2.1, 3.0);
  // String lights across the avenue
  for (let x = x0; x < x1; x += 7) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([x + t * 7, 4.6 - Math.sin(t * Math.PI) * 0.6, -3.2]);
    }
    b.add(sweep(pts, () => 0.012, 16, 4), gold, undefined);
    for (let i = 1; i < 8; i++) {
      const p = pts[i]!;
      b.add(new THREE.SphereGeometry(0.06, 6, 4), i % 3 === 0 ? pinkGlow : i % 3 === 1 ? lantern : cyanGlow, { p: [p[0], p[1] - 0.06, p[2]] });
    }
  }
  // Lotus columns holding up the avenue canopy at intervals
  for (let x = x0 + 10; x < x1 - 8; x += 24) {
    if (Math.abs(x - bossX) < 12) continue;
    lotusColumn(b, { stone, gold, paint: relief }, x, -3.3, 6.5, 0.45);
  }

  // --- Warden Gate (mid-boss arena) -----------------------------------------
  const gx = bossX + 8.5;
  for (const s of [-1, 1]) pylon(b, { stone, relief, gold, glow: pinkGlow }, bossX + s * 7.5, -5, 5, 8.5, 2.6);
  b.add(new THREE.BoxGeometry(8, 1.2, 1.6), relief, { p: [bossX, 6.5, -5.2] }, { uvScale: 2 });
  b.add(new THREE.BoxGeometry(8.2, 0.12, 1.7), gold, { p: [bossX, 7.15, -5.2] });
  signs.push(neonSign(group, b, backing, 'warden', [10, 4, 10], '#ff3a3a', bossX, 5.2, -4.35, 1.1, 0.25));
  lamps.push({ x: bossX, y: 5, z: -3, color: 0xff4040, intensity: 16, distance: 12 });
  obelisk(b, { stone: stoneDark, gold, relief }, gx, -3.6, 5, 0.7);
  obelisk(b, { stone: stoneDark, gold, relief }, bossX - 8.5, -3.6, 5, 0.7);
  // Chains hanging from the gate
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 7; k++) b.add(torus(0.08, 0.02, 4, 8), gold, { p: [bossX - 3 + i * 1.2, 6 - k * 0.14, -4.35], r: [0, k % 2 ? 90 : 0, 0] });
  }
  // Crate barricades inside the arena
  crate(b, wood, stoneDark, bossX - 6, 0, -3.2, 0.9, 12);
  crate(b, wood, stoneDark, bossX - 5.1, 0, -3.3, 0.7, 40);
  crate(b, wood, stoneDark, bossX + 6.2, 0, -3.25, 0.8, -15);

  // Upper-canopy glow and soft light shafts from the dome
  const rays = godRays(
    Array.from({ length: 8 }, (_, i) => ({ x: x0 + 6 + i * (len / 8), y: 8, z: -2.8, w: 3 + (i % 3), h: 14, tilt: 0.28 })),
    0xffb0e0,
    0.22,
  );
  group.add(rays);
  // Hanging lanterns (lathe) over the lane edge
  for (let x = x0 + 5; x < x1; x += 8.5) {
    b.add(lathe([[0.001, 0], [0.12, 0.05], [0.16, 0.2], [0.1, 0.36], [0.001, 0.4]], 10), gold, { p: [x, 3.6, -2.9] });
    b.add(new THREE.SphereGeometry(0.1, 8, 6), lantern, { p: [x, 3.76, -2.9] });
  }

  group.add(b.build('static'));
  const look: EnvLook = { ...BAZAAR_LOOK, lamps };
  return {
    group,
    look,
    update(u: EnvUpdate): void {
      updateSigns(signs, u.time);
      emitBubbles(u.fx, u.camX, u.dt, 1.2, -6, -3.5, 2, 0xffc8f0);
    },
    onEvent(_e: SimEvent, _w: World): void {},
    dispose(): void {
      disposeObject(group);
    },
  };
}
