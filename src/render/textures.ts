/**
 * Procedural textures generated on 2D canvases: stone, carved and painted
 * hieroglyph reliefs, floors, cloth, neon glyph signage, containers, city
 * window lights, particle sprites. Height fields are converted to normal maps.
 * Everything is cached by key so environments can share textures.
 */
import * as THREE from 'three';
import { drawGlyph, GLYPHS } from './glyphs';

export type RGB = [number, number, number];

export function mulberry(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let maxAnisotropy = 8;
export function setMaxAnisotropy(n: number): void {
  maxAnisotropy = Math.max(1, Math.min(16, n));
}

const cache = new Map<string, unknown>();
export function cached<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

export function makeCanvas(w: number, h: number): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: false })!;
  return { cv, ctx };
}

export interface TexOptions {
  srgb?: boolean;
  repeat?: [number, number];
  clamp?: boolean;
  aniso?: boolean;
}

export function toTexture(cv: HTMLCanvasElement, o: TexOptions = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (!o.clamp) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = o.aniso === false ? 1 : maxAnisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Tileable fractal noise (computed once, sampled everywhere).
// ---------------------------------------------------------------------------
const NOISE_N = 256;
let noiseField: Float32Array | null = null;

function buildNoise(): Float32Array {
  const r = mulberry(1337);
  const out = new Float32Array(NOISE_N * NOISE_N);
  let amp = 1;
  let total = 0;
  for (let oct = 0; oct < 6; oct++) {
    const cells = 4 << oct;
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    const step = NOISE_N / cells;
    for (let y = 0; y < NOISE_N; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy) % cells;
      const y1 = (y0 + 1) % cells;
      let fy = gy - Math.floor(gy);
      fy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < NOISE_N; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx) % cells;
        const x1 = (x0 + 1) % cells;
        let fx = gx - Math.floor(gx);
        fx = fx * fx * (3 - 2 * fx);
        const a = grid[y0 * cells + x0]!;
        const b = grid[y0 * cells + x1]!;
        const c = grid[y1 * cells + x0]!;
        const d = grid[y1 * cells + x1]!;
        const v = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        out[y * NOISE_N + x]! += v * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / total;
  return out;
}

/** Tileable fbm noise in [0,1]; x, y in noise-texture pixels (wraps every 256). */
export function noise(x: number, y: number): number {
  if (!noiseField) noiseField = buildNoise();
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const x0 = ((xi % NOISE_N) + NOISE_N) % NOISE_N;
  const y0 = ((yi % NOISE_N) + NOISE_N) % NOISE_N;
  const x1 = (x0 + 1) % NOISE_N;
  const y1 = (y0 + 1) % NOISE_N;
  const n = noiseField;
  const a = n[y0 * NOISE_N + x0]!;
  const b = n[y0 * NOISE_N + x1]!;
  const c = n[y1 * NOISE_N + x0]!;
  const d = n[y1 * NOISE_N + x1]!;
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Height field (0..1) to a tangent-space normal map canvas. */
export function heightToNormal(h: Float32Array, w: number, hh: number, strength: number): HTMLCanvasElement {
  const { cv, ctx } = makeCanvas(w, hh);
  const img = ctx.createImageData(w, hh);
  const d = img.data;
  for (let y = 0; y < hh; y++) {
    const ym = ((y - 1 + hh) % hh) * w;
    const yp = ((y + 1) % hh) * w;
    const yc = y * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (h[yc + xp]! - h[yc + xm]!) * strength;
      const dy = (h[yp + x]! - h[ym + x]!) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (yc + x) * 4;
      d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Read a canvas' red channel as a 0..1 height field. */
function canvasHeight(cv: HTMLCanvasElement): Float32Array {
  const ctx = cv.getContext('2d')!;
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const out = new Float32Array(cv.width * cv.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4]! / 255;
  return out;
}

export interface SurfaceSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  /** G = roughness, B = metalness (use as both roughnessMap and metalnessMap). */
  orm: THREE.CanvasTexture;
}

interface Layers {
  w: number;
  h: number;
  color: Uint8ClampedArray;
  height: Float32Array;
  rough: Float32Array;
  metal: Float32Array;
}

function layers(w: number, h: number): Layers {
  return {
    w,
    h,
    color: new Uint8ClampedArray(w * h * 4),
    height: new Float32Array(w * h),
    rough: new Float32Array(w * h).fill(0.8),
    metal: new Float32Array(w * h),
  };
}

function finish(L: Layers, normalStrength: number, repeat?: [number, number]): SurfaceSet {
  const { cv, ctx } = makeCanvas(L.w, L.h);
  const img = ctx.createImageData(L.w, L.h);
  img.data.set(L.color);
  ctx.putImageData(img, 0, 0);
  const orm = makeCanvas(L.w, L.h);
  const oimg = orm.ctx.createImageData(L.w, L.h);
  for (let i = 0; i < L.w * L.h; i++) {
    oimg.data[i * 4] = 255;
    oimg.data[i * 4 + 1] = Math.max(0, Math.min(255, L.rough[i]! * 255));
    oimg.data[i * 4 + 2] = Math.max(0, Math.min(255, L.metal[i]! * 255));
    oimg.data[i * 4 + 3] = 255;
  }
  orm.ctx.putImageData(oimg, 0, 0);
  const n = heightToNormal(L.height, L.w, L.h, normalStrength);
  const o: TexOptions = repeat ? { repeat } : {};
  return {
    map: toTexture(cv, o),
    normalMap: toTexture(n, { ...o, srgb: false }),
    orm: toTexture(orm.cv, { ...o, srgb: false }),
  };
}

function setPx(L: Layers, i: number, c: RGB): void {
  L.color[i * 4] = c[0];
  L.color[i * 4 + 1] = c[1];
  L.color[i * 4 + 2] = c[2];
  L.color[i * 4 + 3] = 255;
}

// ---------------------------------------------------------------------------
// Stone
// ---------------------------------------------------------------------------

export interface StoneOptions {
  base: RGB;
  seed?: number;
  size?: number;
  /** Block courses: brick width/height in texture pixels. */
  blocks?: { w: number; h: number; mortar: number };
  variation?: number;
  roughness?: number;
}

export function stoneSet(key: string, o: StoneOptions): SurfaceSet {
  return cached(`stone:${key}`, () => {
    const size = o.size ?? 512;
    const L = layers(size, size);
    const r = mulberry(o.seed ?? 7);
    const tintCache = new Map<number, number>();
    const variation = o.variation ?? 0.18;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        let h = noise(x * 0.5 + 31, y * 0.5 + 17) * 0.55 + noise(x * 2.1, y * 2.1) * 0.25;
        let tint = 1;
        let mortar = 0;
        if (o.blocks) {
          const row = Math.floor(y / o.blocks.h);
          const off = row % 2 === 0 ? 0 : o.blocks.w / 2;
          const bx = Math.floor((x + off) / o.blocks.w);
          const lx = (x + off) % o.blocks.w;
          const ly = y % o.blocks.h;
          const edge = Math.min(lx, o.blocks.w - 1 - lx, ly, o.blocks.h - 1 - ly);
          const key2 = row * 1000 + bx;
          if (!tintCache.has(key2)) tintCache.set(key2, 1 + (r() - 0.5) * variation);
          tint = tintCache.get(key2)!;
          if (edge < o.blocks.mortar) {
            mortar = 1 - edge / o.blocks.mortar;
            h -= mortar * 0.45;
          } else {
            h += 0.08 * Math.min(1, (edge - o.blocks.mortar) / 6);
          }
        }
        const n = noise(x * 1.3 + 90, y * 1.3 + 40);
        const speck = noise(x * 6.3, y * 6.3) > 0.72 ? 0.9 : 1;
        const k = tint * (0.82 + n * 0.3) * speck * (1 - mortar * 0.35);
        setPx(L, i, [o.base[0] * k, o.base[1] * k, o.base[2] * k]);
        L.height[i] = h;
        L.rough[i] = (o.roughness ?? 0.85) - n * 0.15 + mortar * 0.1;
      }
    }
    return finish(L, 3.2);
  });
}

// ---------------------------------------------------------------------------
// Hieroglyph reliefs (carved + optionally painted)
// ---------------------------------------------------------------------------

const PAINT: RGB[] = [
  [38, 84, 160], // lapis
  [176, 58, 36], // red ochre
  [214, 160, 58], // yellow ochre
  [46, 150, 140], // turquoise
  [30, 30, 34], // black
  [230, 220, 196], // white
];

export interface ReliefOptions {
  base: RGB;
  seed?: number;
  cols?: number;
  rows?: number;
  painted?: boolean;
  gold?: boolean;
  size?: number;
}

export function reliefSet(key: string, o: ReliefOptions): SurfaceSet {
  return cached(`relief:${key}`, () => {
    const size = o.size ?? 512;
    const r = mulberry(o.seed ?? 11);
    const cols = o.cols ?? 4;
    const rows = o.rows ?? 5;
    // Glyph mask (height) and paint layer on canvases.
    const mask = makeCanvas(size, size);
    const paint = makeCanvas(size, size);
    mask.ctx.fillStyle = '#000';
    mask.ctx.fillRect(0, 0, size, size);
    paint.ctx.clearRect(0, 0, size, size);
    const border = size * 0.06;
    const colW = size / cols;
    const rowH = (size - border * 2) / rows;
    // Frieze borders
    mask.ctx.fillStyle = '#fff';
    for (const by of [border * 0.25, size - border * 0.75]) {
      mask.ctx.fillRect(0, by, size, border * 0.18);
      mask.ctx.fillRect(0, by + border * 0.32, size, border * 0.12);
    }
    for (let cx = 0; cx < cols; cx++) {
      // Column separators
      mask.ctx.fillStyle = '#fff';
      mask.ctx.fillRect(cx * colW, border, 2, size - border * 2);
      for (let ry = 0; ry < rows; ry++) {
        const g = Math.floor(r() * GLYPHS.length);
        const gs = Math.min(colW, rowH) * 0.78;
        const gx = cx * colW + (colW - gs) / 2;
        const gy = border + ry * rowH + (rowH - gs) / 2;
        mask.ctx.fillStyle = '#fff';
        mask.ctx.strokeStyle = '#fff';
        drawGlyph(mask.ctx, g, gx, gy, gs);
        if (o.painted) {
          const pc = PAINT[Math.floor(r() * PAINT.length)]!;
          paint.ctx.fillStyle = `rgb(${pc[0]},${pc[1]},${pc[2]})`;
          paint.ctx.strokeStyle = paint.ctx.fillStyle;
          drawGlyph(paint.ctx, g, gx, gy, gs);
        }
      }
    }
    // Soften the carving edges.
    const soft = makeCanvas(size, size);
    soft.ctx.filter = 'blur(1.5px)';
    soft.ctx.drawImage(mask.cv, 0, 0);
    const glyphH = canvasHeight(soft.cv);
    const paintData = paint.ctx.getImageData(0, 0, size, size).data;
    const L = layers(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const n = noise(x * 0.7 + 11, y * 0.7 + 5);
        const g = glyphH[i]!;
        // Sunk relief: glyphs are carved in (lower), with a bright rim from the normal map.
        const h = n * 0.35 + noise(x * 2.4, y * 2.4) * 0.15 - g * 0.55;
        let c: RGB = [o.base[0] * (0.85 + n * 0.25), o.base[1] * (0.85 + n * 0.25), o.base[2] * (0.85 + n * 0.25)];
        const pa = paintData[i * 4 + 3]! / 255;
        if (pa > 0 && o.painted) {
          const wear = 0.65 + noise(x * 3.1 + 7, y * 3.1) * 0.35;
          const t = pa * wear;
          c = [
            c[0] * (1 - t) + paintData[i * 4]! * t,
            c[1] * (1 - t) + paintData[i * 4 + 1]! * t,
            c[2] * (1 - t) + paintData[i * 4 + 2]! * t,
          ];
        } else if (g > 0.3) {
          c = [c[0] * 0.78, c[1] * 0.74, c[2] * 0.7];
        }
        let metal = 0;
        if (o.gold && g > 0.45) {
          c = [214, 168, 70];
          metal = 0.9;
        }
        setPx(L, i, c);
        L.height[i] = h;
        L.rough[i] = metal > 0 ? 0.35 : 0.88 - n * 0.1;
        L.metal[i] = metal;
      }
    }
    return finish(L, 4.5);
  });
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

export type FloorStyle = 'dock' | 'mosaic' | 'grate' | 'polished';

export function floorSet(style: FloorStyle): SurfaceSet {
  return cached(`floor:${style}`, () => {
    const size = 1024;
    const L = layers(size, size);
    const r = mulberry(style.length * 97);
    if (style === 'dock') {
      // Large sandstone slabs with brass inlay strips and bolts.
      const slab = 256;
      const tints = new Map<number, number>();
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const sx = Math.floor(x / slab);
          const sy = Math.floor(y / slab);
          const k = sy * 10 + sx;
          if (!tints.has(k)) tints.set(k, 0.88 + r() * 0.2);
          const lx = x % slab;
          const ly = y % slab;
          const edge = Math.min(lx, slab - 1 - lx, ly, slab - 1 - ly);
          const n = noise(x * 0.8, y * 0.8);
          const fine = noise(x * 3, y * 3);
          let h = n * 0.4 + fine * 0.15;
          let c: RGB = [178, 146, 108];
          let metal = 0;
          let rough = 0.82 - fine * 0.2;
          const t = tints.get(k)! * (0.8 + n * 0.35);
          c = [c[0] * t, c[1] * t, c[2] * t];
          if (edge < 10) {
            // brass strip between slabs
            c = [170, 128, 60];
            metal = 0.85;
            rough = 0.38 + fine * 0.2;
            h = 0.55 - Math.abs(edge - 5) * 0.05;
          } else if (edge < 13) {
            h -= 0.25;
            c = [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
          }
          // bolts at slab corners
          const bx = Math.min(lx, slab - lx);
          const by = Math.min(ly, slab - ly);
          if (Math.hypot(bx - 22, by - 22) < 6) {
            c = [120, 110, 100];
            metal = 0.9;
            rough = 0.3;
            h = 0.7;
          }
          // wet stains
          const wet = noise(x * 0.25 + 300, y * 0.25 + 50);
          if (wet > 0.6) {
            const s = (wet - 0.6) * 1.6;
            c = [c[0] * (1 - s * 0.35), c[1] * (1 - s * 0.3), c[2] * (1 - s * 0.25)];
            rough -= s * 0.5;
          }
          setPx(L, i, c);
          L.height[i] = h;
          L.rough[i] = rough;
          L.metal[i] = metal;
        }
      }
      return finish(L, 3.5);
    }
    if (style === 'mosaic') {
      // Turquoise / terracotta / cream mosaic with eight-point stars.
      const tile = 64;
      const palette: RGB[] = [
        [196, 178, 150],
        [70, 130, 128],
        [150, 96, 70],
        [52, 60, 76],
        [196, 156, 84],
      ];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const tx = Math.floor(x / tile);
          const ty = Math.floor(y / tile);
          const lx = (x % tile) - tile / 2;
          const ly = (y % tile) - tile / 2;
          const ax = Math.abs(lx);
          const ay = Math.abs(ly);
          const star = Math.max(ax, ay) < 20 && ax + ay < 27;
          const diamond = ax + ay < 12;
          let ci = (tx + ty) % 2 === 0 ? 0 : 0;
          if (star) ci = (tx + ty) % 2 === 0 ? 1 : 2;
          if (diamond) ci = 4;
          if (Math.max(ax, ay) > 29) ci = 3;
          const base = palette[ci]!;
          // tesserae grid
          const tess = 8;
          const ex = x % tess;
          const ey = y % tess;
          const grout = ex === 0 || ey === 0;
          const n = noise(x * 1.7, y * 1.7);
          const k = (grout ? 0.62 : 0.9 + n * 0.18) * (0.92 + noise(x * 0.2, y * 0.2) * 0.16);
          setPx(L, i, [base[0] * k, base[1] * k, base[2] * k]);
          L.height[i] = grout ? 0.1 : 0.6 + n * 0.1;
          L.rough[i] = grout ? 0.95 : ci === 4 ? 0.35 : 0.55 - n * 0.2;
          L.metal[i] = ci === 4 && !grout ? 0.7 : 0;
        }
      }
      return finish(L, 2.5);
    }
    if (style === 'grate') {
      // Brushed metal deck panels with a grating channel and rivets.
      const panel = 256;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const lx = x % panel;
          const ly = y % panel;
          const edge = Math.min(lx, panel - 1 - lx, ly, panel - 1 - ly);
          const brushed = noise(x * 0.1, y * 4) * 0.5 + noise(x * 3, y * 3) * 0.2;
          let c: RGB = [98 + brushed * 60, 108 + brushed * 60, 118 + brushed * 60];
          let h = 0.5 + brushed * 0.1;
          let rough = 0.42 + brushed * 0.3;
          let metal = 0.85;
          const inGrate = ly > 96 && ly < 160;
          if (inGrate) {
            const bar = (lx % 16 < 5) || (ly % 16 < 3);
            c = bar ? [80, 88, 96] : [18, 22, 28];
            h = bar ? 0.6 : 0.0;
            rough = bar ? 0.5 : 0.9;
          }
          if (edge < 4) {
            c = [40, 44, 50];
            h = 0.2;
          }
          const rx = lx % 64;
          const ry = ly % 64;
          if (!inGrate && Math.hypot(rx - 32, ry - 12) < 4) {
            c = [150, 156, 162];
            h = 0.85;
            rough = 0.25;
          }
          // hazard strip along one edge
          if (ly < 20 && ((lx + ly) >> 4) % 2 === 0) {
            c = [200, 150, 30];
            metal = 0.2;
            rough = 0.6;
          }
          setPx(L, i, c);
          L.height[i] = h;
          L.rough[i] = rough;
          L.metal[i] = metal;
        }
      }
      return finish(L, 3);
    }
    // polished: dark veined stone with gold lotus inlay bands
    const band = 512;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const n = noise(x * 0.35, y * 0.35);
        const vein = Math.abs(Math.sin((x * 0.02 + n * 7.0) * 1.3));
        let c: RGB = [34 + n * 30, 38 + n * 28, 52 + n * 34];
        if (vein < 0.06) c = [140, 130, 150];
        let rough = 0.12 + noise(x * 2, y * 2) * 0.12;
        let metal = 0;
        let h = 0.5;
        const ly = y % band;
        const lx = x % 256;
        const inBand = ly > 230 && ly < 282;
        if (inBand) {
          const m = ly - 256;
          const petal = Math.abs(Math.sin(lx * Math.PI / 64)) * 18;
          if (Math.abs(m) < 3 || Math.abs(Math.abs(m) - 22) < 3 || (Math.abs(m) < petal && (lx % 64) > 8)) {
            c = [226, 178, 80];
            metal = 1;
            rough = 0.28;
            h = 0.62;
          }
        }
        const tileEdge = Math.min(x % 256, 255 - (x % 256), y % 256, 255 - (y % 256));
        if (tileEdge < 2 && !inBand) {
          c = [20, 20, 26];
          h = 0.3;
        }
        setPx(L, i, c);
        L.height[i] = h;
        L.rough[i] = rough;
        L.metal[i] = metal;
      }
    }
    return finish(L, 2);
  });
}

// ---------------------------------------------------------------------------
// Metal & gold
// ---------------------------------------------------------------------------

export function metalSet(key: string, base: RGB, panel = 128, rivets = true): SurfaceSet {
  return cached(`metal:${key}`, () => {
    const size = 512;
    const L = layers(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const lx = x % panel;
        const ly = y % panel;
        const edge = Math.min(lx, panel - 1 - lx, ly, panel - 1 - ly);
        const n = noise(x * 0.9 + 70, y * 0.9);
        const scratch = noise(x * 0.15, y * 5) * 0.4;
        const k = 0.8 + n * 0.3 + scratch * 0.2;
        let c: RGB = [base[0] * k, base[1] * k, base[2] * k];
        let h = 0.5 + n * 0.08;
        let rough = 0.35 + n * 0.25;
        if (edge < 3) {
          c = [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45];
          h = 0.2;
          rough = 0.7;
        }
        if (rivets) {
          const rx = lx % 32;
          if (Math.hypot(rx - 16, Math.min(ly, panel - ly) - 10) < 3.2) {
            h = 0.85;
            rough = 0.25;
          }
        }
        const rust = noise(x * 0.5 + 500, y * 0.5 + 500);
        if (rust > 0.66) {
          const s = Math.min(1, (rust - 0.66) * 3);
          c = [c[0] * (1 - s) + 110 * s, c[1] * (1 - s) + 60 * s, c[2] * (1 - s) + 34 * s];
          rough += s * 0.4;
        }
        setPx(L, i, c);
        L.height[i] = h;
        L.rough[i] = rough;
        L.metal[i] = rust > 0.72 ? 0.3 : 0.9;
      }
    }
    return finish(L, 2.5);
  });
}

/** Brushed, slightly worn gold with engraved border lines. */
export function goldSet(key: string, base: RGB = [224, 174, 78]): SurfaceSet {
  return cached(`gold:${key}`, () => {
    const size = 256;
    const L = layers(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const brush = noise(x * 0.08, y * 3.5) * 0.6 + noise(x * 2.5, y * 2.5) * 0.25;
        const wear = noise(x * 0.4 + 200, y * 0.4 + 90);
        const k = 0.82 + brush * 0.3 - (wear > 0.62 ? (wear - 0.62) * 0.8 : 0);
        const groove = y % 128 < 3 || y % 128 > 124;
        const c: RGB = groove ? [base[0] * 0.55, base[1] * 0.5, base[2] * 0.4] : [base[0] * k, base[1] * k, base[2] * k * 0.95];
        setPx(L, i, c);
        L.height[i] = groove ? 0.2 : 0.55 + brush * 0.08;
        L.rough[i] = 0.2 + brush * 0.25 + (wear > 0.62 ? 0.2 : 0);
        L.metal[i] = 1;
      }
    }
    return finish(L, 1.5);
  });
}

// ---------------------------------------------------------------------------
// Cloth, wood, containers
// ---------------------------------------------------------------------------

export type ClothStyle = 'stripes' | 'diamond' | 'zigzag' | 'rug';

export function clothTexture(key: string, style: ClothStyle, colors: string[]): THREE.CanvasTexture {
  return cached(`cloth:${key}`, () => {
    const size = 256;
    const { cv, ctx } = makeCanvas(size, size);
    ctx.fillStyle = colors[0]!;
    ctx.fillRect(0, 0, size, size);
    if (style === 'stripes') {
      const w = size / 8;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = colors[i % colors.length]!;
        ctx.fillRect(i * w, 0, w, size);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * w + w * 0.44, 0, w * 0.12, size);
    } else if (style === 'diamond') {
      ctx.fillStyle = colors[1] ?? '#fff';
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const cx = x * 64 + 32;
          const cy = y * 64 + 32;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 26);
          ctx.lineTo(cx + 26, cy);
          ctx.lineTo(cx, cy + 26);
          ctx.lineTo(cx - 26, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = colors[2] ?? '#000';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) ctx.fillRect(x * 64 + 26, y * 64 + 26, 12, 12);
    } else if (style === 'zigzag') {
      ctx.lineWidth = 14;
      for (let r = 0; r < 6; r++) {
        ctx.strokeStyle = colors[(r % (colors.length - 1)) + 1]!;
        ctx.beginPath();
        const y = r * 44 + 20;
        ctx.moveTo(0, y);
        for (let i = 0; i <= 8; i++) ctx.lineTo(i * 32, y + (i % 2 === 0 ? -14 : 14));
        ctx.stroke();
      }
    } else {
      // rug: border + medallion
      ctx.fillStyle = colors[1]!;
      ctx.fillRect(12, 12, size - 24, size - 24);
      ctx.fillStyle = colors[2]!;
      ctx.fillRect(28, 28, size - 56, size - 56);
      ctx.fillStyle = colors[3] ?? colors[0]!;
      ctx.beginPath();
      ctx.moveTo(size / 2, 40);
      ctx.lineTo(size - 40, size / 2);
      ctx.lineTo(size / 2, size - 40);
      ctx.lineTo(40, size / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors[1]!;
      drawGlyph(ctx, 17, size / 2 - 40, size / 2 - 40, 80);
    }
    // weave noise
    const img = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const k = 0.85 + noise(x * 4, y * 4) * 0.2 + ((x + y) % 2) * 0.03;
        img.data[i] = img.data[i]! * k;
        img.data[i + 1] = img.data[i + 1]! * k;
        img.data[i + 2] = img.data[i + 2]! * k;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(cv);
  });
}

export function woodSet(key: string, base: RGB): SurfaceSet {
  return cached(`wood:${key}`, () => {
    const size = 256;
    const L = layers(size, size);
    const plank = 64;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const p = Math.floor(x / plank);
        const grain = Math.sin((y * 0.08 + noise(x * 0.6 + p * 40, y * 0.2) * 6) * 3) * 0.5 + 0.5;
        const edge = Math.min(x % plank, plank - 1 - (x % plank));
        const k = 0.7 + grain * 0.25 + (p % 3) * 0.05;
        const c: RGB = edge < 2 ? [base[0] * 0.35, base[1] * 0.35, base[2] * 0.35] : [base[0] * k, base[1] * k, base[2] * k];
        setPx(L, i, c);
        L.height[i] = edge < 2 ? 0.1 : 0.5 + grain * 0.1;
        L.rough[i] = 0.75;
      }
    }
    return finish(L, 2);
  });
}

export function containerSet(key: string, base: RGB, glyph: number): SurfaceSet {
  return cached(`container:${key}`, () => {
    const w = 512;
    const h = 512;
    const L = layers(w, h);
    const decal = makeCanvas(w, h);
    decal.ctx.fillStyle = '#fff';
    decal.ctx.strokeStyle = '#fff';
    drawGlyph(decal.ctx, glyph, w * 0.34, h * 0.3, h * 0.3);
    decal.ctx.fillRect(w * 0.1, h * 0.12, w * 0.8, h * 0.04);
    decal.ctx.fillRect(w * 0.1, h * 0.84, w * 0.8, h * 0.04);
    decal.ctx.font = 'bold 44px sans-serif';
    decal.ctx.fillText('NA-' + (100 + glyph * 37), w * 0.62, h * 0.72);
    const dd = decal.ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const rib = Math.sin((x / w) * Math.PI * 28) * 0.5 + 0.5;
        const n = noise(x * 0.8, y * 0.8);
        const k = 0.72 + rib * 0.18 + n * 0.2;
        let c: RGB = [base[0] * k, base[1] * k, base[2] * k];
        const d = dd[i * 4 + 3]! / 255;
        if (d > 0.5) c = [c[0] * 0.3 + 225 * 0.7, c[1] * 0.3 + 215 * 0.7, c[2] * 0.3 + 190 * 0.7];
        const rust = noise(x * 0.4 + 40, y * 0.4 + 900);
        if (rust > 0.64) {
          const s = Math.min(1, (rust - 0.64) * 3);
          c = [c[0] * (1 - s) + 96 * s, c[1] * (1 - s) + 52 * s, c[2] * (1 - s) + 30 * s];
        }
        setPx(L, i, c);
        L.height[i] = rib * 0.5 + n * 0.1;
        L.rough[i] = 0.55 + rust * 0.3;
        L.metal[i] = 0.5;
      }
    }
    return finish(L, 3);
  });
}

// ---------------------------------------------------------------------------
// Emissive signage and lights
// ---------------------------------------------------------------------------

/** A neon glyph sign: bright glyph strokes with glow on black (use additively). */
export function neonSignTexture(key: string, glyphs: number[], color: string, frame = true): THREE.CanvasTexture {
  return cached(`neon:${key}`, () => {
    const cell = 128;
    const w = cell * glyphs.length + (frame ? 48 : 0);
    const h = cell + (frame ? 48 : 0);
    const { cv, ctx } = makeCanvas(w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const draw = (lw: number, blur: number, style: string): void => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.fillStyle = style;
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      if (frame) {
        ctx.strokeRect(10, 10, w - 20, h - 20);
      }
      glyphs.forEach((g, i) => drawGlyph(ctx, g, (frame ? 24 : 0) + i * cell + 10, (frame ? 24 : 0) + 10, cell - 20));
      ctx.restore();
    };
    draw(6, 24, color);
    draw(3, 8, '#ffffff');
    return toTexture(cv, { clamp: true });
  });
}

/** Scattered lit windows for distant towers (emissive map). */
export function windowLightsTexture(key: string, warm: string, cool: string, density = 0.35): THREE.CanvasTexture {
  return cached(`windows:${key}`, () => {
    const size = 256;
    const { cv, ctx } = makeCanvas(size, size);
    const r = mulberry(key.length * 31 + 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    for (let y = 4; y < size; y += 12) {
      for (let x = 4; x < size; x += 10) {
        if (r() > density) continue;
        ctx.fillStyle = r() > 0.3 ? warm : cool;
        ctx.globalAlpha = 0.5 + r() * 0.5;
        ctx.fillRect(x, y, 5, 7);
      }
    }
    ctx.globalAlpha = 1;
    return toTexture(cv);
  });
}

/** Soft radial gradient (blob shadows, glows). */
export function radialTexture(): THREE.CanvasTexture {
  return cached('radial', () => {
    const size = 128;
    const { cv, ctx } = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return toTexture(cv, { clamp: true, srgb: false });
  });
}

/** 2x2 particle atlas: soft dot, star flare, ring, smoke puff. */
export function particleAtlas(): THREE.CanvasTexture {
  return cached('particles', () => {
    const size = 512;
    const half = size / 2;
    const { cv, ctx } = makeCanvas(size, size);
    ctx.clearRect(0, 0, size, size);
    // soft dot
    let g = ctx.createRadialGradient(half / 2, half / 2, 0, half / 2, half / 2, half / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, half, half);
    // star flare
    ctx.save();
    ctx.translate(half * 1.5, half / 2);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      const len = i % 2 === 0 ? half * 0.5 : half * 0.3;
      const lg = ctx.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,1)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(0, -half * 0.035);
      ctx.lineTo(len, 0);
      ctx.lineTo(0, half * 0.035);
      ctx.closePath();
      ctx.fill();
    }
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 0.22);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-half / 2, -half / 2, half, half);
    ctx.restore();
    // ring
    ctx.save();
    ctx.translate(half / 2, half * 1.5);
    g = ctx.createRadialGradient(0, 0, half * 0.3, 0, 0, half * 0.48);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-half / 2, -half / 2, half, half);
    ctx.restore();
    // smoke puff
    const img = ctx.getImageData(half, half, half, half);
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const dx = (x - half / 2) / (half / 2);
        const dy = (y - half / 2) / (half / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        const n = noise(x * 1.2, y * 1.2);
        const a = Math.max(0, 1 - d * (1.1 - n * 0.5)) * (0.5 + n * 0.5);
        const i = (y * half + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.min(255, a * 255 * 1.4);
      }
    }
    ctx.putImageData(img, half, half);
    return toTexture(cv, { clamp: true, srgb: false });
  });
}

/** Painted clay jar pattern. */
export function jarTexture(): THREE.CanvasTexture {
  return cached('jar', () => {
    const w = 256;
    const h = 128;
    const { cv, ctx } = makeCanvas(w, h);
    ctx.fillStyle = '#b2683e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2330';
    ctx.fillRect(0, 26, w, 8);
    ctx.fillRect(0, 96, w, 6);
    ctx.fillStyle = '#e8d8b0';
    for (let i = 0; i < 8; i++) drawGlyph(ctx, [5, 17, 0, 19][i % 4]!, i * 32 + 4, 42, 26);
    ctx.fillStyle = '#2a7f86';
    ctx.fillRect(0, 76, w, 6);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
      const k = 0.85 + noise((i % w) * 2, Math.floor(i / w) * 2) * 0.25;
      img.data[i * 4] = img.data[i * 4]! * k;
      img.data[i * 4 + 1] = img.data[i * 4 + 1]! * k;
      img.data[i * 4 + 2] = img.data[i * 4 + 2]! * k;
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(cv);
  });
}
