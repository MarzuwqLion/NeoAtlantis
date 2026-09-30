/**
 * Reusable body and costume parts for code-built characters.
 * Everything is authored in bone-local space (see rig.ts conventions).
 */
import * as THREE from 'three';
import type { RigBuilder, MatKey } from './rig';
import type { V3 } from './shapes';
import { collar, cyl, ellipsoid, extrude, lathe, limb, plate, rbox, sweep, torus, wedge } from './shapes';

type C = THREE.ColorRepresentation;

export interface BodySpec {
  suit: C;
  suitDark?: C;
  skin?: C;
  hip: V3;
  waist: number;
  chest: V3;
  chestZ?: number;
  neck: number;
  upperArm: [number, number];
  lowerArm: [number, number];
  thigh: [number, number];
  shin: [number, number];
  fist: number;
  fistColor: C;
  foot: { len: number; w: number; h: number; color: C };
}

/** Undersuit body: pelvis, abdomen, chest, neck, limbs, fists, feet. */
export function body(rb: RigBuilder, s: BodySpec): void {
  const p = rb.p;
  const dark = s.suitDark ?? new THREE.Color(s.suit).multiplyScalar(0.7);
  // Pelvis
  rb.add('hips', ellipsoid(s.hip[0], s.hip[1], s.hip[2], 16, 10), 'matte', s.suit, { p: [0, -0.02, 0] }, { bottom: dark });
  // Abdomen: lathe from pelvis to chest
  rb.add(
    'spine',
    lathe(
      [
        [s.hip[0] * 0.8, -0.04],
        [s.waist, p.spine * 0.35],
        [s.waist * 1.04, p.spine * 0.75],
        [s.chest[0] * 0.8, p.spine + 0.02],
      ],
      16,
    ),
    'matte',
    s.suit,
    { s: [1, 1, s.chest[2] / s.chest[0]] },
    { bottom: dark },
  );
  // Chest barrel
  rb.add('chest', ellipsoid(s.chest[0], s.chest[1], s.chest[2], 18, 12), 'matte', s.suit, { p: [0, p.chest * 0.42, s.chestZ ?? 0.01] }, { bottom: dark });
  // Trapezius slope to the neck
  rb.add('chest', ellipsoid(s.chest[0] * 0.75, s.chest[1] * 0.45, s.chest[2] * 0.7, 14, 8), 'matte', s.suit, { p: [0, p.chest * 0.85, -0.01] });
  // Neck
  rb.add('neck', cyl(s.neck, s.neck * 1.12, p.neck + 0.08, 12), 'matte', s.skin ?? s.suit, { p: [0, p.neck * 0.5 - 0.01, 0] });

  const armColor = s.skin ?? s.suit;
  rb.addPair('upperArm', () => limb(s.upperArm[0], s.upperArm[1], p.upperArm, 12), 'matte', armColor);
  rb.addPair('upperArm', () => ellipsoid(s.upperArm[0] * 1.15, s.upperArm[0] * 1.1, s.upperArm[0] * 1.15, 12, 8), 'matte', s.suit, { p: [0, -0.01, 0] });
  rb.addPair('lowerArm', () => limb(s.lowerArm[0], s.lowerArm[1], p.lowerArm, 12), 'matte', armColor);
  fists(rb, s.fist, s.fistColor);
  rb.addPair('upperLeg', () => limb(s.thigh[0], s.thigh[1], p.upperLeg, 14), 'matte', s.suit, undefined, { bottom: dark });
  rb.addPair('lowerLeg', () => limb(s.shin[0], s.shin[1], p.lowerLeg, 12), 'matte', s.suit, undefined, { bottom: dark });
  feet(rb, s.foot.len, s.foot.w, s.foot.h, s.foot.color);
}

/** Big chunky fists so strikes read clearly. */
export function fists(rb: RigBuilder, size: number, color: C): void {
  const s = size;
  rb.addPair('hand', () => rbox(s * 0.95, s * 1.05, s * 1.1, s * 0.28, 2), 'gloss', color, { p: [0, -s * 0.5, s * 0.08] });
  // knuckle ridge
  rb.addPair('hand', () => rbox(s * 0.9, s * 0.3, s * 0.35, s * 0.12, 1), 'gloss', color, { p: [0, -s * 0.72, s * 0.5] });
  // thumb (on the inner side: -X for the left hand)
  rb.addPair('hand', () => limb(s * 0.16, s * 0.14, s * 0.32, 8), 'gloss', color, { p: [-s * 0.42, -s * 0.28, s * 0.3], r: [-40, 0, -20] });
}

export function feet(rb: RigBuilder, len: number, w: number, h: number, color: C): void {
  const ankle = rb.p.ankle;
  const profile: [number, number][] = [
    [-len * 0.22, 0],
    [len * 0.78, 0],
    [len * 0.8, h * 0.45],
    [len * 0.45, h * 0.85],
    [len * 0.05, h * 1.25],
    [-len * 0.22, h * 1.2],
  ];
  // Profile is in (z, y); extrude along X then rotate so the profile lies in the ZY plane.
  rb.addPair(
    'foot',
    () => {
      const g = extrude(profile.map(([z, y]) => [z, y] as [number, number]), w, 0.012, 2);
      // extruded shape lies in XY with depth Z; rotate so X->Z (forward) and depth -> X (width)
      g.rotateY(-Math.PI / 2);
      return g;
    },
    'gloss',
    color,
    { p: [0, -ankle, 0] },
  );
}

/** Egyptian broad collar (usekh): concentric coloured bands draped from the neck over the chest. */
export function broadCollar(rb: RigBuilder, rIn: number, widths: number[], colors: C[], mats: MatKey[], scaleZ = 0.8): void {
  let r = rIn;
  let yy = rb.p.chest + 0.035;
  const slope = 0.78;
  widths.forEach((w, i) => {
    const d = w * slope;
    rb.add('chest', collar(r, r + w, d, 0.018, 30, 360), mats[i % mats.length]!, colors[i % colors.length]!, { p: [0, yy, 0.01], s: [1, 1, scaleZ] });
    r += w;
    yy -= d;
  });
}

/** Belt around the hips with a front buckle plate. */
export function belt(rb: RigBuilder, y: number, r: V3, color: C, buckle: C, glow?: C): void {
  rb.add('hips', lathe([[r[0], -0.04], [r[0] * 1.02, 0], [r[0], 0.04]], 20), 'metal', color, { p: [0, y, 0], s: [1, 1, r[2] / r[0]] });
  rb.add('hips', plate(0.12, 0.1, 0.02, 0.02), 'metal', buckle, { p: [0, y, r[2] + 0.01] });
  if (glow) rb.add('hips', plate(0.05, 0.05, 0.01, 0.02, 0), 'glow', glow, { p: [0, y, r[2] + 0.025] });
}

/** Kilt panel riding each thigh (so the skirt follows the legs). */
export function kiltPanels(rb: RigBuilder, len: number, r: number, color: C, trim: C, flare = 1.25): void {
  rb.addPair(
    'upperLeg',
    () =>
      lathe(
        [
          [r * flare, -len],
          [r * 1.08, -len * 0.4],
          [r, 0.04],
        ],
        14,
        -Math.PI * 0.62,
        Math.PI * 1.24,
      ),
    'matte',
    color,
    { p: [0, 0.02, 0] },
  );
  rb.addPair('upperLeg', () => lathe([[r * flare + 0.005, -len - 0.01], [r * flare + 0.005, -len + 0.03]], 14, -Math.PI * 0.62, Math.PI * 1.24), 'metal', trim, { p: [0, 0.02, 0] });
}

export function bracer(rb: RigBuilder, len: number, r0: number, r1: number, color: C, mat: MatKey = 'metal', trimGlow?: C): void {
  const lower = rb.p.lowerArm;
  rb.addPair('lowerArm', () => cyl(r1, r0, len, 14), mat, color, { p: [0, -lower + len / 2 + 0.03, 0] });
  if (trimGlow) rb.addPair('lowerArm', () => torus(r1 + 0.004, 0.006, 6, 18), 'glow', trimGlow, { p: [0, -lower + len + 0.02, 0], r: [90, 0, 0] });
}

export function greave(rb: RigBuilder, len: number, r0: number, r1: number, color: C, mat: MatKey = 'metal'): void {
  const shin = rb.p.lowerLeg;
  rb.addPair('lowerLeg', () => cyl(r0, r1, len, 14, false), mat, color, { p: [0, -shin * 0.45, 0.012], s: [1, 1, 1.1] });
}

export function kneePad(rb: RigBuilder, r: number, color: C): void {
  rb.addPair('lowerLeg', () => ellipsoid(r, r * 1.1, r * 0.7, 12, 8), 'metal', color, { p: [0, -0.02, r * 0.55] });
}

/** Shoulder pauldron: layered curved plates on the upper arm. */
export function pauldron(rb: RigBuilder, r: number, layers: number, color: C, trim: C, mat: MatKey = 'gloss'): void {
  for (let i = 0; i < layers; i++) {
    const rr = r * (1 - i * 0.12);
    rb.addPair(
      'upperArm',
      () => lathe([[rr * 0.2, rr * 0.95], [rr * 0.75, rr * 0.7], [rr, rr * 0.2], [rr * 1.02, -rr * 0.15]], 16, 0, Math.PI * 2),
      i === 0 ? mat : 'metal',
      i === 0 ? color : trim,
      { p: [rr * 0.1, -i * r * 0.28, 0], s: [1, 0.85, 1.05] },
    );
  }
}

/** Plate on the chest front. */
export function chestPlate(rb: RigBuilder, w: number, h: number, y: number, z: number, color: C, mat: MatKey = 'gloss', tilt = -8): void {
  rb.add('chest', plate(w, h, 0.04, 0.05, 0.012), mat, color, { p: [0, y, z], r: [tilt, 0, 0] });
}

/** Tapered tail / beak / horn swept tube helper. */
export function sweptHorn(rb: RigBuilder, bone: string, pts: V3[], r0: number, r1: number, mat: MatKey, color: C, t?: { mirror?: boolean }): void {
  const make = () => sweep(pts, (u) => r0 + (r1 - r0) * u, 28, 10);
  if (t?.mirror) {
    rb.addPair(bone, make, mat, color);
  } else {
    rb.add(bone, make(), mat, color);
  }
}

export function ear(points: [number, number][], depth: number): THREE.BufferGeometry {
  return wedge(points, depth, 0.004);
}
