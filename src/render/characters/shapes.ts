/**
 * Geometry helpers for code-built characters and props: tapered limbs,
 * lathed shells, bevelled plates, extrusions and swept tubes.
 * All angles in degrees.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];

const DEG = Math.PI / 180;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export interface XForm {
  p?: V3;
  r?: V3;
  s?: V3 | number;
}

/** Apply translate / rotate (deg, XYZ) / scale to a geometry in place and return it. */
export function xf<T extends THREE.BufferGeometry>(g: T, t: XForm): T {
  _e.set((t.r?.[0] ?? 0) * DEG, (t.r?.[1] ?? 0) * DEG, (t.r?.[2] ?? 0) * DEG);
  _q.setFromEuler(_e);
  _p.set(t.p?.[0] ?? 0, t.p?.[1] ?? 0, t.p?.[2] ?? 0);
  if (typeof t.s === 'number') _s.set(t.s, t.s, t.s);
  else if (t.s) _s.set(t.s[0], t.s[1], t.s[2]);
  else _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

export function matrixOf(t: XForm): THREE.Matrix4 {
  _e.set((t.r?.[0] ?? 0) * DEG, (t.r?.[1] ?? 0) * DEG, (t.r?.[2] ?? 0) * DEG);
  _q.setFromEuler(_e);
  _p.set(t.p?.[0] ?? 0, t.p?.[1] ?? 0, t.p?.[2] ?? 0);
  if (typeof t.s === 'number') _s.set(t.s, t.s, t.s);
  else if (t.s) _s.set(t.s[0], t.s[1], t.s[2]);
  else _s.set(1, 1, 1);
  return new THREE.Matrix4().compose(_p.clone(), _q.clone(), _s.clone());
}

/** Tapered capsule hanging down from the origin along -Y (limb segment). */
export function limb(r0: number, r1: number, len: number, radial = 12): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const capSteps = 5;
  for (let i = 0; i <= capSteps; i++) {
    const a = -Math.PI / 2 + (i / capSteps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r1), -len + Math.sin(a) * r1));
  }
  // slight muscle bulge in the upper third
  const mid = 4;
  for (let i = 1; i < mid; i++) {
    const t = i / mid;
    const r = r1 + (r0 - r1) * t + Math.sin(t * Math.PI) * (r0 + r1) * 0.08;
    pts.push(new THREE.Vector2(r, -len + len * t));
  }
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r0), Math.sin(a) * r0));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/** Lathe from [radius, y] pairs (bottom to top). */
export function lathe(profile: [number, number][], radial = 16, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)),
    radial,
    phiStart,
    phiLength,
  );
}

export function ellipsoid(rx: number, ry: number, rz: number, w = 16, h = 12): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}

/** Partial sphere (dome) — theta range in degrees from the top. */
export function dome(r: number, thetaDeg = 90, w = 18, h = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, thetaDeg * DEG);
}

export function rbox(w: number, h: number, d: number, r = 0.02, seg = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

export function cyl(rTop: number, rBottom: number, h: number, seg = 14, open = false): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
}

export function cone(r: number, h: number, seg = 12): THREE.BufferGeometry {
  return new THREE.ConeGeometry(r, h, seg);
}

export function torus(r: number, tube: number, rs = 8, ts = 20, arcDeg = 360): THREE.BufferGeometry {
  return new THREE.TorusGeometry(r, tube, rs, ts, arcDeg * DEG);
}

/** Extrude a 2D outline (x, y points) by depth along Z, centred on Z, with a bevel. */
export function extrude(points: [number, number][], depth: number, bevel = 0.01, curveSegs = 6): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curveSegs,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Extrude a THREE.Shape. */
export function extrudeShape(shape: THREE.Shape, depth: number, bevel = 0.01, curveSegs = 10): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curveSegs,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Rounded-rectangle plate (armour plates, panels). Lies in XY, thickness along Z. */
export function plate(w: number, h: number, depth: number, r = 0.03, bevel = 0.008): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return extrudeShape(s, depth, bevel, 4);
}

/** Swept tube along points with a radius function t -> r (t in 0..1). */
export function sweep(points: V3[], radius: (t: number) => number, tubular = 24, radial = 8): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const r = radius(t);
    const n = frames.normals[i]!;
    const b = frames.binormals[i]!;
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const s = Math.sin(v);
      const c = -Math.cos(v);
      N.set(c * n.x + s * b.x, c * n.y + s * b.y, c * n.z + s * b.z).normalize();
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      nor.push(N.x, N.y, N.z);
    }
  }
  for (let i = 1; i <= tubular; i++) {
    for (let j = 1; j <= radial; j++) {
      const a = (radial + 1) * (i - 1) + (j - 1);
      const b = (radial + 1) * i + (j - 1);
      const c = (radial + 1) * i + j;
      const d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Flat ring / washer (broad collars) lying in XZ, sloping down by `drop` at the outer edge. */
export function collar(rInner: number, rOuter: number, drop: number, thickness: number, seg = 28, arcDeg = 360, startDeg = 0): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [rInner, 0],
    [rOuter, -drop],
    [rOuter, -drop - thickness],
    [rInner, -thickness],
    [rInner, 0],
  ];
  return lathe(prof, seg, startDeg * DEG, arcDeg * DEG);
}

/** Wedge (triangular prism) — ears, beaks, fins. Triangle in XY, depth in Z. */
export function wedge(points: [number, number][], depth: number, bevel = 0.004): THREE.BufferGeometry {
  return extrude(points, depth, bevel, 2);
}
