/**
 * Code-built character models. Each builder dresses a joint rig with shaped
 * geometry (lathes, tapered limbs, bevelled plates, extrusions, swept tubes)
 * and layered Egyptian-futurist costume pieces, plus spring chains for cloth.
 *
 * Every type has its own silhouette: build, height, headgear and colour.
 */
import * as THREE from 'three';
import { RigBuilder, type Proportions } from './rig';
import { body, belt, bracer, broadCollar, chestPlate, greave, kiltPanels, kneePad, pauldron } from './parts';
import { cone, dome, ellipsoid, extrude, lathe, plate, rbox, sweep, torus, wedge, xf } from './shapes';

type C = THREE.ColorRepresentation;

export interface Palette {
  suit: C;
  skin: C;
  armor: C;
  armor2: C;
  metal: C;
  cloth: C;
  cloth2: C;
  accent: C;
  glow: C;
  mask: C;
}

export const PALETTES: Record<string, Record<string, Palette>> = {
  heru: {
    default: {
      suit: 0x1b2438,
      skin: 0xb07850,
      armor: 0xece6d8,
      armor2: 0x2c5fa8,
      metal: 0xe0b04c,
      cloth: 0xf0ead8,
      cloth2: 0xc8342c,
      accent: 0x2aa6a0,
      glow: 0x5ff2ff,
      mask: 0xf2eee4,
    },
  },
  grunt: {
    default: {
      suit: 0x2a2c31,
      skin: 0x6a5446,
      armor: 0x1f7d78,
      armor2: 0x14524e,
      metal: 0xa87a36,
      cloth: 0x3c3f46,
      cloth2: 0x1f7d78,
      accent: 0x86c0a0,
      glow: 0x58f5cf,
      mask: 0x1f7d78,
    },
    elite: {
      suit: 0x2b1f22,
      skin: 0x6a5446,
      armor: 0x9a1f26,
      armor2: 0x5e1116,
      metal: 0xdcaa44,
      cloth: 0x362426,
      cloth2: 0x9a1f26,
      accent: 0xe0c070,
      glow: 0xff8a3a,
      mask: 0x9a1f26,
    },
  },
  bladeRunner: {
    default: {
      suit: 0x221a2e,
      skin: 0x6a5040,
      armor: 0x5a3585,
      armor2: 0x341f4e,
      metal: 0xa08040,
      cloth: 0x2a2030,
      cloth2: 0xa11a2c,
      accent: 0x6b4a90,
      glow: 0xff3350,
      mask: 0x121016,
    },
  },
  bruiser: {
    default: {
      suit: 0x2c221c,
      skin: 0x70594a,
      armor: 0xbb672a,
      armor2: 0x3b3b42,
      metal: 0xc98a3a,
      cloth: 0x4a3326,
      cloth2: 0x7a2e1c,
      accent: 0xe0b060,
      glow: 0xffb040,
      mask: 0x3b3b42,
    },
  },
  thrower: {
    default: {
      suit: 0x2d2a26,
      skin: 0x3d3128,
      armor: 0xe6decc,
      armor2: 0x2f8a5e,
      metal: 0xcbb27a,
      cloth: 0xe6decc,
      cloth2: 0x2f8a5e,
      accent: 0x1b1b20,
      glow: 0x7cff9c,
      mask: 0x16161a,
    },
  },
  acrobat: {
    default: {
      suit: 0x5a1446,
      skin: 0xb8845c,
      armor: 0x2a0c22,
      armor2: 0x8c1f6a,
      metal: 0xe2b14a,
      cloth: 0x8c1f6a,
      cloth2: 0xff4fa8,
      accent: 0x3a0a2c,
      glow: 0xff5cb4,
      mask: 0x141016,
    },
  },
  sobekhan: {
    default: {
      suit: 0x151a17,
      skin: 0x3e5a3a,
      armor: 0x25392d,
      armor2: 0x17231c,
      metal: 0xd4a24a,
      cloth: 0x2b2a22,
      cloth2: 0x7a2418,
      accent: 0xefe6cf,
      glow: 0xff8a2a,
      mask: 0x2e4a38,
    },
  },
  apep: {
    default: {
      suit: 0x121019,
      skin: 0x4a3a30,
      armor: 0x18141f,
      armor2: 0x2a0f3a,
      metal: 0xe6b64e,
      cloth: 0x2a0f3a,
      cloth2: 0x1c2f6a,
      accent: 0x44e8ff,
      glow: 0xb45cff,
      mask: 0xe8b850,
    },
  },
};

export function getPalette(model: string, variant: string): Palette {
  const set = PALETTES[model];
  if (!set) throw new Error(`No palette for ${model}`);
  return set[variant] ?? set.default!;
}

const SPRING_CLOTH = { stiffness: 0.16, damping: 0.86, gravity: 9 };
const SPRING_HEAVY = { stiffness: 0.22, damping: 0.8, gravity: 12 };
const SPRING_TAIL = { stiffness: 0.12, damping: 0.88, gravity: 4 };

// ---------------------------------------------------------------------------
// HERU — the falcon. Hero proportions, white & gold, cyan glow, red sash.
// ---------------------------------------------------------------------------
function heru(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.44,
    lowerLeg: 0.42,
    ankle: 0.08,
    hipW: 0.1,
    pelvis: 0.1,
    spine: 0.2,
    chest: 0.25,
    neck: 0.07,
    shoulderW: 0.23,
    shoulderDrop: 0.07,
    upperArm: 0.3,
    lowerArm: 0.27,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.17, 0.12, 0.13],
    waist: 0.14,
    chest: [0.2, 0.17, 0.14],
    neck: 0.06,
    upperArm: [0.07, 0.055],
    lowerArm: [0.058, 0.048],
    thigh: [0.095, 0.065],
    shin: [0.07, 0.05],
    fist: 0.135,
    fistColor: 0x1a2130,
    foot: { len: 0.25, w: 0.1, h: 0.09, color: 0x3a2a1e },
  });
  // Chest armour: white plate with gold trim and glowing eye-of-Horus line
  chestPlate(rb, 0.3, 0.2, P.chest * 0.45, 0.13, pal.armor);
  rb.add('chest', plate(0.32, 0.03, 0.03, 0.01), 'metal', pal.metal, { p: [0, P.chest * 0.45 - 0.11, 0.14], r: [-8, 0, 0] });
  rb.add('chest', plate(0.16, 0.012, 0.01, 0.005, 0), 'glow', pal.glow, { p: [0, P.chest * 0.45 + 0.02, 0.163], r: [-8, 0, 0] });
  rb.add('chest', ellipsoid(0.028, 0.028, 0.01), 'glow', pal.glow, { p: [0, P.chest * 0.45 - 0.035, 0.162] });
  // Broad collar (gold, lapis, turquoise, gold)
  broadCollar(rb, 0.085, [0.04, 0.035, 0.035, 0.03], [pal.metal, pal.armor2, pal.accent, pal.metal], ['metal', 'gloss', 'gloss', 'metal'], 0.78);
  // Back plate
  rb.add('chest', plate(0.28, 0.24, 0.03, 0.05), 'gloss', pal.armor, { p: [0, P.chest * 0.42, -0.12], r: [8, 0, 0] });
  // Shoulder caps
  pauldron(rb, 0.095, 2, pal.armor, pal.metal);
  // Bracers
  bracer(rb, 0.16, 0.062, 0.058, pal.metal, 'metal', pal.glow);
  // Belt, kilt, knee guards, greaves
  belt(rb, 0.02, [0.18, 0.1, 0.14], pal.metal, pal.metal, pal.glow);
  kiltPanels(rb, 0.24, 0.105, pal.cloth, pal.metal);
  kneePad(rb, 0.058, pal.metal);
  greave(rb, 0.2, 0.066, 0.056, pal.armor, 'gloss');
  // Sandal straps
  rb.addPair('foot', () => torus(0.05, 0.01, 6, 14), 'metal', pal.metal, { p: [0, -0.02, 0.02], r: [90, 0, 0], s: [1, 1.3, 1] });
  // Front apron (spring) with blue and gold stripes, red sash tails
  rb.chain('apron', 'hips', [0, -0.02, 0.15], 4, 0.07, [0, -1, 0.12], SPRING_CLOTH);
  rb.strip('apron', (t) => 0.13 - t * 0.03, 0.012, 'matte', pal.cloth, { bottom: pal.armor2 });
  rb.chain('sashA', 'hips', [-0.14, 0.0, -0.08], 5, 0.08, [-0.25, -1, -0.35], SPRING_CLOTH);
  rb.strip('sashA', (t) => 0.07 - t * 0.02, 0.01, 'matte', pal.cloth2, { across: [0, 0, 1] });
  rb.chain('sashB', 'hips', [0.14, 0.0, -0.08], 5, 0.08, [0.25, -1, -0.35], SPRING_CLOTH);
  rb.strip('sashB', (t) => 0.07 - t * 0.02, 0.01, 'matte', pal.cloth2, { across: [0, 0, 1] });

  // Falcon helmet
  const H = 0.13;
  rb.add('head', ellipsoid(0.115, 0.13, 0.13, 20, 14), 'gloss', pal.mask, { p: [0, H * 0.9, 0.0] });
  // Blue crown cap
  rb.add('head', dome(0.122, 70, 20, 8), 'gloss', pal.armor2, { p: [0, H * 1.0, -0.01], s: [0.98, 0.95, 1.06] });
  // Beak: swept downward hook in gold
  rb.add(
    'head',
    sweep(
      [
        [0, 0.15, 0.1],
        [0, 0.14, 0.17],
        [0, 0.11, 0.22],
        [0, 0.06, 0.24],
      ],
      (u) => 0.058 * (1 - u) + 0.01,
      20,
      10,
    ),
    'metal',
    pal.metal,
  );
  // Visor slit with glowing eyes
  rb.add('head', rbox(0.2, 0.035, 0.06, 0.012), 'gloss', 0x10141c, { p: [0, H * 1.05, 0.085] });
  rb.addPair('head', () => ellipsoid(0.028, 0.012, 0.01), 'glow', pal.glow, { p: [0.052, H * 1.06, 0.115], r: [0, 20, -10] });
  // Horus eye markings (teardrop line)
  rb.addPair('head', () => rbox(0.008, 0.06, 0.01, 0.003), 'glow', pal.glow, { p: [0.07, H * 0.72, 0.1], r: [0, 25, 15] });
  // Crest fin
  rb.add('head', wedge([[-0.12, 0], [0.06, 0], [0.02, 0.06], [-0.1, 0.09]], 0.018), 'metal', pal.metal, { p: [0, H * 1.75, -0.02], r: [0, 90, 0] });
  // Lappets (short cloth tails behind the head)
  rb.chain('lapL', 'head', [0.07, 0.07, -0.08], 3, 0.07, [0.1, -1, -0.3], SPRING_HEAVY);
  rb.strip('lapL', () => 0.05, 0.012, 'gloss', pal.armor2, { across: [0, 0, 1], bottom: pal.metal });
  rb.chain('lapR', 'head', [-0.07, 0.07, -0.08], 3, 0.07, [-0.1, -1, -0.3], SPRING_HEAVY);
  rb.strip('lapR', () => 0.05, 0.012, 'gloss', pal.armor2, { across: [0, 0, 1], bottom: pal.metal });
  // Gold knuckle plates
  rb.addPair('hand', () => rbox(0.12, 0.04, 0.05, 0.012), 'metal', pal.metal, { p: [0, -0.085, 0.07] });
  return rb;
}

// ---------------------------------------------------------------------------
// SCARAB — grunt. Stocky, beetle carapace helmet with horn and mandibles.
// ---------------------------------------------------------------------------
function grunt(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.4,
    lowerLeg: 0.38,
    ankle: 0.08,
    hipW: 0.12,
    pelvis: 0.1,
    spine: 0.19,
    chest: 0.26,
    neck: 0.05,
    shoulderW: 0.27,
    shoulderDrop: 0.08,
    upperArm: 0.29,
    lowerArm: 0.27,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.2, 0.13, 0.15],
    waist: 0.17,
    chest: [0.24, 0.19, 0.17],
    neck: 0.075,
    upperArm: [0.085, 0.07],
    lowerArm: [0.072, 0.06],
    thigh: [0.11, 0.08],
    shin: [0.085, 0.065],
    fist: 0.13,
    fistColor: pal.suit,
    foot: { len: 0.27, w: 0.12, h: 0.1, color: 0x2a221c },
  });
  // Carapace chest plate with split line
  chestPlate(rb, 0.36, 0.24, P.chest * 0.45, 0.15, pal.armor, 'gloss', -6);
  rb.add('chest', rbox(0.012, 0.22, 0.03, 0.004), 'gloss', pal.armor2, { p: [0, P.chest * 0.45, 0.19] });
  rb.add('chest', plate(0.3, 0.04, 0.03, 0.01), 'metal', pal.metal, { p: [0, P.chest * 0.45 + 0.13, 0.16], r: [-6, 0, 0] });
  broadCollar(rb, 0.09, [0.04, 0.035], [pal.metal, pal.armor2], ['metal', 'gloss'], 0.8);
  // Big beetle-shell pauldrons
  rb.addPair('upperArm', () => dome(0.14, 80, 16, 8), 'gloss', pal.armor, { p: [0.02, 0.02, 0], s: [1, 0.8, 1.1] });
  rb.addPair('upperArm', () => torus(0.13, 0.012, 6, 20), 'metal', pal.metal, { p: [0.02, -0.005, 0], r: [90, 0, 0], s: [1, 1.1, 1] });
  bracer(rb, 0.17, 0.08, 0.072, pal.armor, 'gloss', pal.glow);
  belt(rb, 0.03, [0.21, 0.1, 0.16], pal.metal, pal.metal, pal.glow);
  kiltPanels(rb, 0.2, 0.125, pal.cloth, pal.metal, 1.2);
  kneePad(rb, 0.07, pal.armor);
  greave(rb, 0.16, 0.08, 0.07, pal.armor2, 'gloss');
  rb.chain('apron', 'hips', [0, -0.02, 0.17], 3, 0.07, [0, -1, 0.1], SPRING_CLOTH);
  rb.strip('apron', () => 0.12, 0.014, 'matte', pal.cloth2, { bottom: pal.metal });

  // Scarab helmet: wide shell dome, split, horn, mandibles, visor
  rb.add('head', ellipsoid(0.13, 0.12, 0.13, 18, 12), 'matte', pal.suit, { p: [0, 0.1, 0] });
  rb.add('head', dome(0.16, 95, 22, 10), 'gloss', pal.mask, { p: [0, 0.11, -0.01], s: [1.02, 0.95, 1.12] });
  rb.add('head', torus(0.158, 0.009, 6, 24, 180), 'gloss', pal.armor2, { p: [0, 0.11, -0.01], r: [0, 90, 0], s: [1.12, 0.95, 1.02] });
  rb.add('head', torus(0.16, 0.012, 6, 24), 'metal', pal.metal, { p: [0, 0.1, -0.01], r: [90, 0, 0], s: [1.02, 1.12, 1] });
  // Horn curving up at the front
  rb.add(
    'head',
    sweep(
      [
        [0, 0.2, 0.13],
        [0, 0.27, 0.18],
        [0, 0.35, 0.17],
      ],
      (u) => 0.03 * (1 - u) + 0.006,
      16,
      8,
    ),
    'metal',
    pal.metal,
  );
  // Mandibles
  rb.addPair('head', () => sweep([[0.06, 0.03, 0.12], [0.05, 0.0, 0.17], [0.015, -0.02, 0.18]], (u) => 0.016 * (1 - u) + 0.004, 12, 6), 'metal', pal.metal);
  rb.add('head', rbox(0.2, 0.03, 0.05, 0.01), 'gloss', 0x0e1012, { p: [0, 0.1, 0.105] });
  rb.addPair('head', () => ellipsoid(0.03, 0.01, 0.01), 'glow', pal.glow, { p: [0.05, 0.1, 0.13] });
  return rb;
}

// ---------------------------------------------------------------------------
// JACKAL — blade runner. Tall, lean, long-snouted mask with tall ears.
// ---------------------------------------------------------------------------
function bladeRunner(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.47,
    lowerLeg: 0.46,
    ankle: 0.08,
    hipW: 0.095,
    pelvis: 0.1,
    spine: 0.2,
    chest: 0.22,
    neck: 0.09,
    shoulderW: 0.2,
    shoulderDrop: 0.06,
    upperArm: 0.31,
    lowerArm: 0.29,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.15, 0.11, 0.12],
    waist: 0.12,
    chest: [0.17, 0.15, 0.12],
    neck: 0.05,
    upperArm: [0.066, 0.054],
    lowerArm: [0.056, 0.047],
    thigh: [0.092, 0.064],
    shin: [0.068, 0.05],
    fist: 0.105,
    fistColor: 0x141018,
    foot: { len: 0.26, w: 0.09, h: 0.085, color: 0x141018 },
  });
  // Segmented chest guard under a cross-strap harness
  chestPlate(rb, 0.26, 0.17, P.chest * 0.45, 0.1, pal.armor, 'gloss', -8);
  rb.add('spine', plate(0.2, 0.14, 0.025, 0.04), 'gloss', pal.armor2, { p: [0, P.spine * 0.5, 0.11] });
  rb.add('chest', rbox(0.04, 0.34, 0.02, 0.008), 'gloss', pal.armor, { p: [0, P.chest * 0.45, 0.12], r: [0, 0, 30] });
  rb.add('chest', rbox(0.04, 0.34, 0.02, 0.008), 'gloss', pal.armor, { p: [0, P.chest * 0.45, 0.12], r: [0, 0, -30] });
  rb.add('chest', ellipsoid(0.03, 0.03, 0.012), 'metal', pal.metal, { p: [0, P.chest * 0.45, 0.135] });
  rb.add('chest', ellipsoid(0.012, 0.012, 0.006), 'glow', pal.glow, { p: [0, P.chest * 0.45, 0.147] });
  // Lean armoured shoulders
  pauldron(rb, 0.08, 2, pal.armor, pal.metal);
  // Forearm wraps
  for (let i = 0; i < 4; i++) rb.addPair('lowerArm', () => torus(0.05 - i * 0.002, 0.009, 6, 14), 'matte', pal.cloth, { p: [0, -0.07 - i * 0.045, 0], r: [90, 0, 12] });
  bracer(rb, 0.07, 0.052, 0.05, pal.armor, 'gloss', pal.glow);
  belt(rb, 0.02, [0.16, 0.08, 0.13], pal.armor, pal.metal);
  kiltPanels(rb, 0.18, 0.095, pal.cloth, pal.metal, 1.15);
  // Shin wraps
  for (let i = 0; i < 5; i++) rb.addPair('lowerLeg', () => torus(0.058 - i * 0.003, 0.008, 6, 14), 'matte', pal.cloth, { p: [0, -0.12 - i * 0.05, 0], r: [90, 0, -10] });
  // Long red scarf tails from the neck
  rb.chain('scarfA', 'chest', [0.06, P.chest * 0.95, -0.1], 6, 0.08, [0.15, -1, -0.5], SPRING_CLOTH);
  rb.strip('scarfA', (t) => 0.08 - t * 0.03, 0.01, 'matte', pal.cloth2, { across: [0, 0, 1] });
  rb.chain('scarfB', 'chest', [-0.04, P.chest * 0.95, -0.11], 5, 0.08, [-0.1, -1, -0.55], SPRING_CLOTH);
  rb.strip('scarfB', (t) => 0.07 - t * 0.03, 0.01, 'matte', pal.cloth2, { across: [0, 0, 1] });
  rb.add('chest', torus(0.075, 0.03, 8, 18), 'matte', pal.cloth2, { p: [0, P.chest * 0.98, 0], r: [90, 0, 0], s: [1, 1.1, 1] });

  // Jackal mask
  rb.add('head', ellipsoid(0.1, 0.115, 0.12, 18, 12), 'gloss', pal.mask, { p: [0, 0.1, 0] });
  const snout = extrude(
    [
      [0, -0.04],
      [0.19, -0.03],
      [0.2, 0.0],
      [0.02, 0.06],
    ],
    0.07,
    0.012,
  );
  snout.rotateY(-Math.PI / 2);
  rb.add('head', snout, 'gloss', pal.mask, { p: [0, 0.08, 0.06] });
  rb.add('head', rbox(0.06, 0.012, 0.16, 0.004), 'metal', pal.metal, { p: [0, 0.13, 0.12], r: [18, 0, 0] });
  // Tall ears
  rb.addPair(
    'head',
    () => xf(cone(0.055, 0.24, 4), { s: [1, 1, 0.55], p: [0, 0.12, 0] }),
    'gloss',
    pal.mask,
    { p: [0.06, 0.19, -0.03], r: [-8, 20, -12] },
  );
  rb.addPair('head', () => xf(cone(0.032, 0.17, 4), { s: [1, 1, 0.3], p: [0, 0.1, 0] }), 'metal', pal.metal, { p: [0.062, 0.2, -0.004], r: [-8, 20, -12] });
  rb.addPair('head', () => ellipsoid(0.026, 0.009, 0.01), 'glow', pal.glow, { p: [0.045, 0.14, 0.1], r: [0, 25, -18] });
  // Gold nemes band
  rb.add('head', torus(0.105, 0.01, 6, 20), 'metal', pal.metal, { p: [0, 0.1, -0.005], r: [90, 0, 0], s: [1, 1.15, 1] });
  return rb;
}

// ---------------------------------------------------------------------------
// KHNUM — bruiser. Massive, ram horns, bronze armour, huge fists.
// ---------------------------------------------------------------------------
function bruiser(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.5,
    lowerLeg: 0.46,
    ankle: 0.1,
    hipW: 0.17,
    pelvis: 0.12,
    spine: 0.26,
    chest: 0.34,
    neck: 0.06,
    shoulderW: 0.42,
    shoulderDrop: 0.12,
    upperArm: 0.38,
    lowerArm: 0.36,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.28, 0.17, 0.21],
    waist: 0.26,
    chest: [0.36, 0.26, 0.25],
    chestZ: 0.03,
    neck: 0.12,
    upperArm: [0.13, 0.11],
    lowerArm: [0.12, 0.1],
    thigh: [0.16, 0.12],
    shin: [0.13, 0.1],
    fist: 0.2,
    fistColor: pal.armor2,
    foot: { len: 0.34, w: 0.17, h: 0.13, color: pal.armor2 },
  });
  // Belly plate and chest plates
  rb.add('spine', plate(0.34, 0.26, 0.05, 0.08, 0.015), 'metal', pal.armor, { p: [0, P.spine * 0.5, 0.24], r: [-4, 0, 0] });
  chestPlate(rb, 0.5, 0.3, P.chest * 0.48, 0.25, pal.armor, 'metal', -10);
  rb.add('chest', plate(0.16, 0.16, 0.02, 0.08, 0.006), 'gloss', pal.armor2, { p: [0, P.chest * 0.48, 0.285], r: [-10, 0, 45] });
  rb.add('chest', ellipsoid(0.04, 0.04, 0.012), 'glow', pal.glow, { p: [0, P.chest * 0.48, 0.3] });
  broadCollar(rb, 0.14, [0.06, 0.05], [pal.metal, pal.armor2], ['metal', 'gloss'], 0.85);
  // Giant layered pauldrons
  pauldron(rb, 0.2, 3, pal.armor, pal.armor2, 'metal');
  rb.addPair('upperArm', () => cone(0.035, 0.12, 8), 'metal', pal.metal, { p: [0.1, 0.19, 0], r: [0, 0, -30] });
  // Gauntlets
  bracer(rb, 0.24, 0.135, 0.12, pal.armor, 'metal', pal.glow);
  rb.addPair('hand', () => rbox(0.21, 0.07, 0.08, 0.02), 'metal', pal.metal, { p: [0, -0.14, 0.12] });
  belt(rb, 0.04, [0.3, 0.14, 0.23], pal.armor2, pal.metal, pal.glow);
  // Belt chain links
  for (let i = 0; i < 7; i++) {
    const a = -0.8 + i * 0.27;
    rb.add('hips', torus(0.025, 0.007, 6, 12), 'metal', pal.metal, { p: [Math.sin(a) * 0.31, -0.03 - Math.cos(a * 2) * 0.02, Math.cos(a) * 0.24], r: [0, a * 57, 90] });
  }
  kiltPanels(rb, 0.26, 0.17, pal.cloth, pal.armor, 1.25);
  kneePad(rb, 0.11, pal.armor);
  greave(rb, 0.26, 0.135, 0.12, pal.armor, 'metal');
  rb.chain('apron', 'hips', [0, -0.03, 0.24], 3, 0.09, [0, -1, 0.12], SPRING_HEAVY);
  rb.strip('apron', () => 0.2, 0.02, 'matte', pal.cloth2, { bottom: pal.metal });

  // Ram helmet: dome, face guard, curled horns
  rb.add('head', ellipsoid(0.15, 0.14, 0.15, 18, 12), 'matte', pal.suit, { p: [0, 0.1, 0.01] });
  rb.add('head', dome(0.17, 88, 20, 10), 'metal', pal.mask, { p: [0, 0.1, 0], s: [1, 0.95, 1.08] });
  rb.add('head', plate(0.2, 0.14, 0.04, 0.04), 'metal', pal.mask, { p: [0, 0.07, 0.14] });
  rb.add('head', rbox(0.16, 0.025, 0.02, 0.008), 'glow', pal.glow, { p: [0, 0.1, 0.165] });
  rb.add('head', wedge([[-0.02, 0], [0.02, 0], [0, 0.1]], 0.03), 'metal', pal.metal, { p: [0, 0.2, 0.12], r: [30, 0, 0] });
  rb.addPair('head', () => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 1.6;
      const r = 0.11 - i * 0.004;
      pts.push([0.16 + Math.sin(a) * 0.02 + i * 0.012, 0.16 + Math.cos(a) * r - 0.02, -0.02 - Math.sin(a) * r + 0.03]);
    }
    return sweep(pts, (u) => 0.055 * (1 - u) + 0.014, 40, 10);
  }, 'gloss', pal.accent);
  return rb;
}

// ---------------------------------------------------------------------------
// IBIS — thrower. Tall and thin, long curved beak, long robe, jar satchel.
// ---------------------------------------------------------------------------
function thrower(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.48,
    lowerLeg: 0.47,
    ankle: 0.08,
    hipW: 0.09,
    pelvis: 0.1,
    spine: 0.22,
    chest: 0.22,
    neck: 0.12,
    shoulderW: 0.19,
    shoulderDrop: 0.05,
    upperArm: 0.3,
    lowerArm: 0.28,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.15, 0.11, 0.12],
    waist: 0.12,
    chest: [0.16, 0.15, 0.12],
    neck: 0.045,
    upperArm: [0.055, 0.045],
    lowerArm: [0.047, 0.04],
    thigh: [0.08, 0.055],
    shin: [0.058, 0.044],
    fist: 0.1,
    fistColor: pal.skin,
    foot: { len: 0.25, w: 0.085, h: 0.08, color: 0x2a2420 },
  });
  // Robe top (tunic) over the chest and abdomen
  rb.add('chest', lathe([[0.15, -0.02], [0.18, 0.1], [0.14, 0.22], [0.06, 0.25]], 16), 'matte', pal.cloth, { p: [0, 0, 0.005], s: [1, 1, 0.8] });
  rb.add('spine', lathe([[0.16, -0.05], [0.14, 0.12], [0.15, 0.23]], 16), 'matte', pal.cloth, { s: [1, 1, 0.82] });
  broadCollar(rb, 0.07, [0.035, 0.03, 0.03], [pal.metal, pal.armor2, pal.metal], ['metal', 'gloss', 'metal'], 0.8);
  // Long robe panels on the thighs (to mid shin)
  kiltPanels(rb, 0.46, 0.09, pal.cloth, pal.armor2, 1.5);
  belt(rb, 0.03, [0.16, 0.08, 0.13], pal.armor2, pal.metal, pal.glow);
  rb.chain('robeF', 'hips', [0, -0.02, 0.14], 5, 0.09, [0, -1, 0.08], SPRING_CLOTH);
  rb.strip('robeF', () => 0.15, 0.012, 'matte', pal.cloth, { bottom: pal.armor2 });
  rb.chain('robeB', 'hips', [0, -0.02, -0.13], 5, 0.09, [0, -1, -0.1], SPRING_CLOTH);
  rb.strip('robeB', () => 0.17, 0.012, 'matte', pal.cloth, { bottom: pal.armor2 });
  // Jar satchel on the left hip
  rb.add('hips', rbox(0.12, 0.13, 0.08, 0.02), 'matte', 0x6a4a2e, { p: [0.19, -0.1, -0.02], r: [0, 0, 8] });
  for (let i = 0; i < 3; i++) {
    rb.add('hips', lathe([[0.001, 0], [0.03, 0.01], [0.038, 0.05], [0.022, 0.09], [0.018, 0.11]], 10), 'matte', 0xb2683e, { p: [0.16 + i * 0.035, -0.06, -0.04 + (i % 2) * 0.03], r: [0, 0, 8 - i * 10] });
  }
  bracer(rb, 0.09, 0.05, 0.047, pal.metal, 'metal', pal.glow);
  // Shoulder wraps
  rb.addPair('upperArm', () => dome(0.07, 80, 12, 6), 'matte', pal.cloth, { p: [0, 0.01, 0] });

  // Ibis mask: black head, long down-curved beak, white crest
  rb.add('head', ellipsoid(0.09, 0.1, 0.105, 16, 12), 'gloss', pal.mask, { p: [0, 0.09, 0] });
  rb.add(
    'head',
    sweep(
      [
        [0, 0.1, 0.08],
        [0, 0.08, 0.2],
        [0, 0.03, 0.32],
        [0, -0.05, 0.4],
      ],
      (u) => 0.028 * (1 - u) + 0.006,
      30,
      10,
    ),
    'gloss',
    pal.mask,
  );
  rb.add('head', torus(0.03, 0.006, 6, 12), 'metal', pal.metal, { p: [0, 0.095, 0.12], r: [0, 90, 0] });
  rb.addPair('head', () => ellipsoid(0.02, 0.012, 0.008), 'glow', pal.glow, { p: [0.05, 0.12, 0.07], r: [0, 30, 0] });
  // Striped nemes headcloth
  rb.add('head', dome(0.105, 100, 18, 8), 'matte', pal.cloth, { p: [0, 0.1, -0.02], s: [1.05, 1, 1.1] });
  rb.chain('hcL', 'head', [0.08, 0.05, -0.04], 3, 0.07, [0.2, -1, 0.1], SPRING_HEAVY);
  rb.strip('hcL', () => 0.07, 0.012, 'matte', pal.cloth, { across: [0, 0, 1], bottom: pal.armor2 });
  rb.chain('hcR', 'head', [-0.08, 0.05, -0.04], 3, 0.07, [-0.2, -1, 0.1], SPRING_HEAVY);
  rb.strip('hcR', () => 0.07, 0.012, 'matte', pal.cloth, { across: [0, 0, 1], bottom: pal.armor2 });
  return rb;
}

// ---------------------------------------------------------------------------
// BASTET — acrobat. Short and lithe, cat mask with ears, long tail, ribbons.
// ---------------------------------------------------------------------------
function acrobat(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.38,
    lowerLeg: 0.37,
    ankle: 0.07,
    hipW: 0.09,
    pelvis: 0.09,
    spine: 0.17,
    chest: 0.2,
    neck: 0.07,
    shoulderW: 0.17,
    shoulderDrop: 0.05,
    upperArm: 0.26,
    lowerArm: 0.24,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.14, 0.1, 0.11],
    waist: 0.1,
    chest: [0.15, 0.13, 0.11],
    neck: 0.045,
    upperArm: [0.05, 0.04],
    lowerArm: [0.042, 0.036],
    thigh: [0.078, 0.052],
    shin: [0.056, 0.04],
    fist: 0.095,
    fistColor: pal.armor,
    foot: { len: 0.22, w: 0.08, h: 0.07, color: pal.armor },
  });
  chestPlate(rb, 0.22, 0.14, P.chest * 0.45, 0.1, pal.armor, 'gloss', -10);
  rb.add('chest', plate(0.1, 0.012, 0.01, 0.005, 0), 'glow', pal.glow, { p: [0, P.chest * 0.45 + 0.03, 0.125], r: [-10, 0, 0] });
  broadCollar(rb, 0.065, [0.03, 0.025], [pal.metal, pal.armor2], ['metal', 'gloss'], 0.8);
  for (let i = 0; i < 3; i++) rb.addPair('lowerArm', () => torus(0.044, 0.008, 6, 14), 'metal', pal.metal, { p: [0, -P.lowerArm + 0.05 + i * 0.03, 0], r: [90, 0, 0] });
  for (let i = 0; i < 2; i++) rb.addPair('upperArm', () => torus(0.052, 0.007, 6, 14), 'metal', pal.metal, { p: [0, -0.06 - i * 0.03, 0], r: [90, 0, 0] });
  belt(rb, 0.02, [0.145, 0.07, 0.115], pal.metal, pal.metal, pal.glow);
  kiltPanels(rb, 0.14, 0.085, pal.cloth, pal.metal, 1.3);
  for (let i = 0; i < 2; i++) rb.addPair('lowerLeg', () => torus(0.05, 0.007, 6, 14), 'metal', pal.metal, { p: [0, -P.lowerLeg + 0.06 + i * 0.03, 0], r: [90, 0, 0] });
  kneePad(rb, 0.045, pal.armor);
  // Cat tail (long, springy)
  rb.chain('tail', 'hips', [0, 0.0, -0.12], 7, 0.1, [0, -0.45, -1], SPRING_TAIL);
  rb.strip('tail', (t) => 0.05 - t * 0.03, 0.04, 'gloss', pal.armor, { across: [1, 0, 0], bottom: pal.glow });
  // Cat mask
  rb.add('head', ellipsoid(0.09, 0.1, 0.1, 18, 12), 'gloss', pal.mask, { p: [0, 0.09, 0] });
  rb.add('head', ellipsoid(0.05, 0.035, 0.05, 12, 8), 'gloss', pal.mask, { p: [0, 0.06, 0.08] });
  rb.addPair('head', () => wedge([[-0.035, 0], [0.035, 0], [0.005, 0.1]], 0.018), 'gloss', pal.mask, { p: [0.055, 0.16, -0.01], r: [-10, 15, -20] });
  rb.addPair('head', () => wedge([[-0.022, 0], [0.022, 0], [0.004, 0.07]], 0.006), 'metal', pal.metal, { p: [0.057, 0.165, 0.002], r: [-10, 15, -20] });
  rb.addPair('head', () => ellipsoid(0.024, 0.009, 0.008), 'glow', pal.glow, { p: [0.042, 0.105, 0.085], r: [0, 25, -20] });
  rb.add('head', torus(0.093, 0.009, 6, 20), 'metal', pal.metal, { p: [0, 0.08, 0], r: [90, 0, 0], s: [1, 1.12, 1] });
  // Ribbons from the back of the head
  rb.chain('ribA', 'head', [0.03, 0.12, -0.08], 5, 0.07, [0.2, -0.6, -1], SPRING_CLOTH);
  rb.strip('ribA', (t) => 0.035 - t * 0.01, 0.006, 'matte', pal.cloth2, { across: [0, 1, 0] });
  rb.chain('ribB', 'head', [-0.03, 0.12, -0.08], 5, 0.07, [-0.2, -0.6, -1], SPRING_CLOTH);
  rb.strip('ribB', (t) => 0.035 - t * 0.01, 0.006, 'matte', pal.cloth2, { across: [0, 1, 0] });
  return rb;
}

// ---------------------------------------------------------------------------
// SOBEKHAN — mid-boss. Huge crocodile warden: iron armour, toothy jaw, tail.
// ---------------------------------------------------------------------------
function sobekhan(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.6,
    lowerLeg: 0.55,
    ankle: 0.12,
    hipW: 0.22,
    pelvis: 0.14,
    spine: 0.3,
    chest: 0.42,
    neck: 0.1,
    shoulderW: 0.55,
    shoulderDrop: 0.16,
    upperArm: 0.48,
    lowerArm: 0.46,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.36, 0.22, 0.28],
    waist: 0.34,
    chest: [0.46, 0.34, 0.33],
    chestZ: 0.05,
    neck: 0.17,
    upperArm: [0.17, 0.14],
    lowerArm: [0.16, 0.13],
    thigh: [0.21, 0.16],
    shin: [0.17, 0.13],
    fist: 0.28,
    fistColor: pal.armor,
    foot: { len: 0.44, w: 0.22, h: 0.16, color: pal.armor2 },
  });
  // Iron cuirass with gold rivets and a glowing furnace core
  chestPlate(rb, 0.66, 0.42, P.chest * 0.47, 0.33, pal.armor, 'gloss', -12);
  rb.add('spine', plate(0.5, 0.3, 0.06, 0.1, 0.02), 'gloss', pal.armor, { p: [0, P.spine * 0.5, 0.32], r: [-5, 0, 0] });
  for (let i = 0; i < 3; i++) rb.add('spine', rbox(0.46 - i * 0.04, 0.03, 0.03, 0.01), 'metal', pal.metal, { p: [0, P.spine * 0.25 + i * 0.1, 0.36] });
  rb.add('chest', torus(0.08, 0.018, 8, 20), 'metal', pal.metal, { p: [0, P.chest * 0.47, 0.39], r: [-12, 0, 0] });
  rb.add('chest', ellipsoid(0.065, 0.065, 0.02, 14, 10), 'glow', pal.glow, { p: [0, P.chest * 0.47, 0.39], r: [-12, 0, 0] });
  for (let i = -2; i <= 2; i++) rb.add('chest', ellipsoid(0.02, 0.02, 0.012), 'metal', pal.metal, { p: [i * 0.12, P.chest * 0.47 + 0.17, 0.36] });
  broadCollar(rb, 0.2, [0.07, 0.06, 0.05], [pal.metal, pal.armor2, pal.metal], ['metal', 'gloss', 'metal'], 0.9);
  // Back scale ridge
  for (let i = 0; i < 6; i++) rb.add(i < 3 ? 'chest' : 'spine', cone(0.05, 0.14, 4), 'gloss', pal.armor, { p: [0, (i < 3 ? 0.35 - i * 0.12 : 0.28 - (i - 3) * 0.1), -0.34], r: [-60, 0, 0] });
  // Spiked pauldrons
  pauldron(rb, 0.28, 3, pal.armor, pal.metal, 'gloss');
  for (let i = 0; i < 3; i++) rb.addPair('upperArm', () => cone(0.045, 0.2, 6), 'metal', pal.metal, { p: [0.12 + i * 0.03, 0.26 - i * 0.05, -0.08 + i * 0.08], r: [-20 + i * 20, 0, -40] });
  // Massive gauntlets
  bracer(rb, 0.32, 0.18, 0.16, pal.armor, 'gloss', pal.glow);
  rb.addPair('hand', () => rbox(0.3, 0.1, 0.12, 0.03), 'metal', pal.metal, { p: [0, -0.2, 0.17] });
  for (let i = 0; i < 3; i++) rb.addPair('hand', () => cone(0.025, 0.08, 6), 'metal', pal.metal, { p: [-0.08 + i * 0.08, -0.2, 0.25], r: [90, 0, 0] });
  // Iron-plate kilt and belt
  belt(rb, 0.05, [0.38, 0.16, 0.3], pal.armor2, pal.metal, pal.glow);
  kiltPanels(rb, 0.34, 0.23, pal.armor, pal.metal, 1.2);
  kneePad(rb, 0.15, pal.armor);
  greave(rb, 0.34, 0.18, 0.16, pal.armor, 'gloss');
  rb.chain('apron', 'hips', [0, -0.04, 0.3], 3, 0.12, [0, -1, 0.1], SPRING_HEAVY);
  rb.strip('apron', () => 0.26, 0.025, 'matte', pal.cloth2, { bottom: pal.metal });
  // Crocodile tail
  rb.chain('tail', 'hips', [0, -0.05, -0.3], 6, 0.2, [0, -0.5, -1], { stiffness: 0.25, damping: 0.8, gravity: 6 });
  rb.strip('tail', (t) => 0.3 - t * 0.24, 0.16, 'gloss', pal.armor, { across: [1, 0, 0], bottom: pal.armor2, outline: true });

  // Crocodile helm: skull, long upper jaw with teeth, lower jaw, glowing eyes, ridge
  rb.add('head', ellipsoid(0.2, 0.17, 0.2, 18, 12), 'gloss', pal.mask, { p: [0, 0.12, 0] });
  const upperJaw = extrude([[0, -0.03], [0.42, -0.02], [0.46, 0.02], [0.3, 0.06], [0.02, 0.11]], 0.24, 0.02);
  upperJaw.rotateY(-Math.PI / 2);
  rb.add('head', upperJaw, 'gloss', pal.mask, { p: [0, 0.1, 0.1] });
  const lowerJaw = extrude([[0, 0], [0.4, 0.0], [0.38, -0.05], [0.02, -0.07]], 0.2, 0.015);
  lowerJaw.rotateY(-Math.PI / 2);
  rb.add('head', lowerJaw, 'gloss', pal.armor2, { p: [0, 0.03, 0.1] });
  for (let i = 0; i < 7; i++) {
    rb.addPair('head', () => cone(0.014, 0.05, 5), 'matte', pal.accent, { p: [0.1, 0.06, 0.16 + i * 0.05], r: [180, 0, 0] });
    rb.addPair('head', () => cone(0.012, 0.04, 5), 'matte', pal.accent, { p: [0.085, 0.045, 0.18 + i * 0.045] });
  }
  rb.addPair('head', () => ellipsoid(0.05, 0.035, 0.05), 'gloss', pal.mask, { p: [0.1, 0.24, 0.13] });
  rb.addPair('head', () => ellipsoid(0.03, 0.015, 0.012), 'glow', pal.glow, { p: [0.11, 0.24, 0.175], r: [0, 20, 0] });
  for (let i = 0; i < 5; i++) rb.add('head', cone(0.025, 0.07, 4), 'gloss', pal.armor, { p: [0, 0.28 - i * 0.015, 0.12 - i * 0.09], r: [-20, 0, 0] });
  rb.add('head', torus(0.2, 0.02, 6, 24), 'metal', pal.metal, { p: [0, 0.1, 0], r: [90, 0, 0], s: [1, 1.1, 1] });
  return rb;
}

// ---------------------------------------------------------------------------
// APEP — final boss. Serpent Pharaoh: cobra hood crown, gold mask, cape,
// twin khopeshes (built into the hands).
// ---------------------------------------------------------------------------
function apep(pal: Palette): RigBuilder {
  const P: Proportions = {
    upperLeg: 0.5,
    lowerLeg: 0.48,
    ankle: 0.08,
    hipW: 0.11,
    pelvis: 0.1,
    spine: 0.22,
    chest: 0.27,
    neck: 0.09,
    shoulderW: 0.25,
    shoulderDrop: 0.07,
    upperArm: 0.33,
    lowerArm: 0.3,
  };
  const rb = new RigBuilder(P);
  body(rb, {
    suit: pal.suit,
    skin: pal.skin,
    hip: [0.18, 0.12, 0.14],
    waist: 0.14,
    chest: [0.22, 0.18, 0.15],
    neck: 0.06,
    upperArm: [0.072, 0.058],
    lowerArm: [0.062, 0.05],
    thigh: [0.1, 0.07],
    shin: [0.075, 0.055],
    fist: 0.12,
    fistColor: pal.metal,
    foot: { len: 0.27, w: 0.1, h: 0.09, color: pal.armor },
  });
  // Black & gold cuirass with violet glyph lines
  chestPlate(rb, 0.34, 0.24, P.chest * 0.45, 0.14, pal.armor, 'gloss', -8);
  rb.add('chest', plate(0.2, 0.012, 0.01, 0.005, 0), 'glow', pal.glow, { p: [0, P.chest * 0.45 - 0.05, 0.172], r: [-8, 0, 0] });
  rb.add('chest', plate(0.012, 0.16, 0.01, 0.005, 0), 'glow', pal.glow, { p: [0, P.chest * 0.45, 0.172], r: [-8, 0, 0] });
  rb.add('spine', plate(0.26, 0.18, 0.03, 0.05), 'gloss', pal.armor, { p: [0, P.spine * 0.5, 0.15] });
  for (let i = 0; i < 3; i++) rb.add('spine', rbox(0.24, 0.018, 0.02, 0.005), 'metal', pal.metal, { p: [0, 0.05 + i * 0.06, 0.168] });
  broadCollar(rb, 0.09, [0.045, 0.04, 0.04, 0.035], [pal.metal, pal.cloth2, pal.metal, pal.glow], ['metal', 'gloss', 'metal', 'glow'], 0.8);
  pauldron(rb, 0.12, 3, pal.metal, pal.armor, 'metal');
  bracer(rb, 0.18, 0.068, 0.062, pal.metal, 'metal', pal.glow);
  belt(rb, 0.03, [0.19, 0.1, 0.15], pal.metal, pal.metal, pal.glow);
  kiltPanels(rb, 0.34, 0.11, pal.armor, pal.metal, 1.35);
  greave(rb, 0.24, 0.078, 0.066, pal.metal, 'metal');
  kneePad(rb, 0.06, pal.metal);
  // Front apron with serpent stripes
  rb.chain('apron', 'hips', [0, -0.02, 0.15], 5, 0.075, [0, -1, 0.1], SPRING_CLOTH);
  rb.strip('apron', () => 0.14, 0.012, 'gloss', pal.metal, { bottom: pal.cloth2 });
  // Cape: three wide strips from the shoulders
  rb.chain('capeL', 'chest', [0.14, P.chest * 0.85, -0.14], 6, 0.13, [0.15, -1, -0.25], SPRING_CLOTH);
  rb.strip('capeL', (t) => 0.2 + t * 0.06, 0.015, 'matte', pal.cloth, { across: [1, 0, 0], bottom: pal.cloth2, outline: true });
  rb.chain('capeC', 'chest', [0, P.chest * 0.85, -0.16], 6, 0.13, [0, -1, -0.3], SPRING_CLOTH);
  rb.strip('capeC', (t) => 0.2 + t * 0.06, 0.015, 'matte', pal.cloth, { across: [1, 0, 0], bottom: pal.cloth2, outline: true });
  rb.chain('capeR', 'chest', [-0.14, P.chest * 0.85, -0.14], 6, 0.13, [-0.15, -1, -0.25], SPRING_CLOTH);
  rb.strip('capeR', (t) => 0.2 + t * 0.06, 0.015, 'matte', pal.cloth, { across: [1, 0, 0], bottom: pal.cloth2, outline: true });

  // Golden pharaoh mask
  rb.add('head', ellipsoid(0.1, 0.125, 0.115, 20, 14), 'metal', pal.mask, { p: [0, 0.1, 0.01] });
  rb.addPair('head', () => ellipsoid(0.028, 0.01, 0.01), 'glow', pal.glow, { p: [0.042, 0.12, 0.11], r: [0, 20, -6] });
  rb.addPair('head', () => rbox(0.05, 0.008, 0.01, 0.003), 'gloss', 0x0a0a10, { p: [0.05, 0.14, 0.108], r: [0, 20, -10] });
  rb.add('head', rbox(0.024, 0.07, 0.024, 0.008), 'metal', pal.metal, { p: [0, -0.02, 0.1], r: [10, 0, 0] });
  // Nemes headdress (striped) + lappets
  rb.add('head', dome(0.14, 95, 22, 10), 'gloss', pal.metal, { p: [0, 0.11, -0.015], s: [1.1, 1.05, 1.05] });
  for (let i = 0; i < 4; i++) rb.add('head', torus(0.14 - i * 0.004, 0.006, 6, 24, 200), 'gloss', pal.cloth2, { p: [0, 0.2 - i * 0.04, -0.015], r: [90, 0, 170], s: [1.1, 1.05, 1] });
  rb.chain('nemL', 'head', [0.11, 0.06, 0.03], 4, 0.07, [0.1, -1, 0.15], SPRING_HEAVY);
  rb.strip('nemL', (t) => 0.09 - t * 0.02, 0.012, 'gloss', pal.metal, { across: [0, 0, 1], bottom: pal.cloth2 });
  rb.chain('nemR', 'head', [-0.11, 0.06, 0.03], 4, 0.07, [-0.1, -1, 0.15], SPRING_HEAVY);
  rb.strip('nemR', (t) => 0.09 - t * 0.02, 0.012, 'gloss', pal.metal, { across: [0, 0, 1], bottom: pal.cloth2 });
  // Uraeus on the brow
  rb.add('head', sweep([[0, 0.2, 0.1], [0, 0.26, 0.13], [0, 0.29, 0.12]], (u) => 0.018 * (1 - u) + 0.008, 12, 6), 'metal', pal.metal);
  rb.add('head', ellipsoid(0.015, 0.012, 0.008), 'glow', pal.glow, { p: [0, 0.285, 0.135] });
  // Cobra hood crown rising behind the head
  const hood = new THREE.Shape();
  hood.moveTo(0, -0.05);
  hood.bezierCurveTo(0.2, 0.0, 0.26, 0.2, 0.2, 0.36);
  hood.bezierCurveTo(0.14, 0.5, 0.05, 0.52, 0, 0.46);
  hood.bezierCurveTo(-0.05, 0.52, -0.14, 0.5, -0.2, 0.36);
  hood.bezierCurveTo(-0.26, 0.2, -0.2, 0.0, 0, -0.05);
  const hoodGeo = new THREE.ExtrudeGeometry(hood, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 14 });
  rb.add('head', hoodGeo, 'gloss', pal.armor, { p: [0, 0.14, -0.13], r: [-12, 0, 0] });
  const hoodTrim = new THREE.ExtrudeGeometry(hood, { depth: 0.012, bevelEnabled: false, curveSegments: 14 });
  rb.add('head', hoodTrim, 'metal', pal.metal, { p: [0, 0.135, -0.145], r: [-12, 0, 0], s: [1.08, 1.06, 1] });
  // Glowing eye spots on the hood (cobra markings)
  rb.addPair('head', () => ellipsoid(0.04, 0.05, 0.01), 'glow', pal.glow, { p: [0.1, 0.42, -0.112], r: [-12, 0, 0] });
  rb.addPair('head', () => ellipsoid(0.018, 0.024, 0.01), 'glow', pal.accent, { p: [0.1, 0.42, -0.105], r: [-12, 0, 0] });

  // Twin khopeshes fused to the gauntlets
  rb.addPair('hand', () => khopeshGeometry(0.62), 'metal', pal.metal, { p: [0, -0.07, 0.02], r: [0, 0, 0] });
  rb.addPair('hand', () => khopeshEdgeGeometry(0.62), 'glow', pal.glow, { p: [0, -0.07, 0.02] });
  return rb;
}

/** Curved khopesh blade authored in hand space: grip along -Y, blade sweeping forward (+Z) and up. */
export function khopeshGeometry(len: number): THREE.BufferGeometry {
  const s = len;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.03 * s, 0);
  shape.lineTo(0.035 * s, 0.35 * s);
  shape.bezierCurveTo(0.05 * s, 0.62 * s, 0.25 * s, 0.9 * s, 0.52 * s, 0.86 * s);
  shape.bezierCurveTo(0.4 * s, 0.8 * s, 0.2 * s, 0.62 * s, 0.1 * s, 0.4 * s);
  shape.lineTo(-0.02 * s, 0.35 * s);
  shape.lineTo(-0.02 * s, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, -0.008);
  // shape x -> forward (z), shape y -> up the blade; blade leaves the fist upward/forward
  g.rotateY(-Math.PI / 2);
  g.rotateX(Math.PI / 2 + 0.35);
  return g;
}

function khopeshEdgeGeometry(len: number): THREE.BufferGeometry {
  const s = len;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    // follow the outer curve of the blade
    const x = 0.035 * s + (0.52 * s - 0.035 * s) * t * t;
    const y = 0.35 * s + (0.86 * s - 0.35 * s) * Math.sin(t * Math.PI * 0.5);
    pts.push([0, y, x]);
  }
  const g = sweep(pts, () => 0.006, 20, 5);
  g.rotateX(Math.PI / 2 + 0.35);
  return g;
}

export const MODEL_BUILDERS: Record<string, (pal: Palette) => RigBuilder> = {
  heru,
  grunt,
  bladeRunner,
  bruiser,
  thrower,
  acrobat,
  sobekhan,
  apep,
};

export const MODEL_IDS = Object.keys(MODEL_BUILDERS);
