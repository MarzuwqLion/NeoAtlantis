/**
 * Procedural hieroglyphs. Each glyph draws into a unit square (0..1) on a
 * 2D canvas context that has already been translated and scaled. They're
 * used for carved reliefs (as height), painted walls and neon signage.
 */

export type GlyphFn = (c: CanvasRenderingContext2D) => void;

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function poly(c: CanvasRenderingContext2D, pts: number[]): void {
  c.beginPath();
  c.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i]!, pts[i + 1]!);
  c.closePath();
}

export const GLYPHS: GlyphFn[] = [
  // 0 ankh
  (c) => {
    c.lineWidth = 0.09;
    ellipse(c, 0.5, 0.26, 0.14, 0.17);
    c.stroke();
    c.fillRect(0.2, 0.42, 0.6, 0.08);
    c.fillRect(0.455, 0.42, 0.09, 0.5);
  },
  // 1 eye of Horus
  (c) => {
    c.lineWidth = 0.06;
    c.beginPath();
    c.moveTo(0.12, 0.42);
    c.quadraticCurveTo(0.45, 0.18, 0.86, 0.42);
    c.quadraticCurveTo(0.45, 0.6, 0.12, 0.42);
    c.stroke();
    ellipse(c, 0.47, 0.41, 0.09, 0.09);
    c.fill();
    c.beginPath();
    c.moveTo(0.1, 0.28);
    c.lineTo(0.84, 0.26);
    c.stroke();
    c.beginPath();
    c.moveTo(0.42, 0.55);
    c.lineTo(0.38, 0.86);
    c.stroke();
    c.beginPath();
    c.moveTo(0.58, 0.54);
    c.quadraticCurveTo(0.72, 0.88, 0.55, 0.84);
    c.quadraticCurveTo(0.5, 0.76, 0.6, 0.74);
    c.stroke();
  },
  // 2 was sceptre
  (c) => {
    c.lineWidth = 0.08;
    c.beginPath();
    c.moveTo(0.5, 0.2);
    c.lineTo(0.5, 0.86);
    c.stroke();
    poly(c, [0.5, 0.2, 0.72, 0.1, 0.74, 0.18, 0.54, 0.28]);
    c.fill();
    c.beginPath();
    c.moveTo(0.5, 0.86);
    c.lineTo(0.42, 0.95);
    c.moveTo(0.5, 0.86);
    c.lineTo(0.58, 0.95);
    c.stroke();
  },
  // 3 djed pillar
  (c) => {
    c.fillRect(0.4, 0.2, 0.2, 0.72);
    for (let i = 0; i < 4; i++) c.fillRect(0.28, 0.1 + i * 0.075, 0.44, 0.045);
    c.fillRect(0.3, 0.88, 0.4, 0.06);
  },
  // 4 sun disc
  (c) => {
    c.lineWidth = 0.07;
    ellipse(c, 0.5, 0.5, 0.3, 0.3);
    c.stroke();
    ellipse(c, 0.5, 0.5, 0.08, 0.08);
    c.fill();
  },
  // 5 water
  (c) => {
    c.lineWidth = 0.06;
    for (let r = 0; r < 3; r++) {
      c.beginPath();
      const y = 0.32 + r * 0.18;
      c.moveTo(0.08, y);
      for (let i = 0; i < 6; i++) c.lineTo(0.15 + i * 0.14, y + (i % 2 === 0 ? -0.06 : 0.06));
      c.stroke();
    }
  },
  // 6 reed leaf
  (c) => {
    c.beginPath();
    c.moveTo(0.5, 0.92);
    c.quadraticCurveTo(0.28, 0.5, 0.56, 0.08);
    c.quadraticCurveTo(0.66, 0.5, 0.5, 0.92);
    c.fill();
    c.fillRect(0.46, 0.7, 0.14, 0.05);
  },
  // 7 vulture
  (c) => {
    ellipse(c, 0.48, 0.52, 0.26, 0.15, -0.35);
    c.fill();
    ellipse(c, 0.72, 0.28, 0.07, 0.08);
    c.fill();
    poly(c, [0.76, 0.26, 0.9, 0.3, 0.77, 0.32]);
    c.fill();
    poly(c, [0.24, 0.62, 0.08, 0.78, 0.3, 0.7]);
    c.fill();
    c.fillRect(0.45, 0.62, 0.04, 0.26);
    c.fillRect(0.55, 0.62, 0.04, 0.26);
  },
  // 8 owl
  (c) => {
    ellipse(c, 0.45, 0.58, 0.2, 0.25);
    c.fill();
    ellipse(c, 0.62, 0.3, 0.14, 0.13);
    c.fill();
    c.fillRect(0.4, 0.8, 0.05, 0.12);
    c.fillRect(0.5, 0.8, 0.05, 0.12);
  },
  // 9 horned viper
  (c) => {
    c.lineWidth = 0.08;
    c.beginPath();
    c.moveTo(0.08, 0.7);
    c.bezierCurveTo(0.3, 0.5, 0.45, 0.85, 0.65, 0.62);
    c.lineTo(0.85, 0.5);
    c.stroke();
    ellipse(c, 0.86, 0.48, 0.07, 0.05);
    c.fill();
    c.lineWidth = 0.03;
    c.beginPath();
    c.moveTo(0.86, 0.44);
    c.lineTo(0.84, 0.34);
    c.stroke();
  },
  // 10 cobra (uraeus)
  (c) => {
    c.beginPath();
    c.moveTo(0.4, 0.92);
    c.bezierCurveTo(0.2, 0.7, 0.7, 0.62, 0.52, 0.45);
    c.lineTo(0.62, 0.45);
    c.bezierCurveTo(0.82, 0.66, 0.34, 0.72, 0.5, 0.92);
    c.fill();
    ellipse(c, 0.56, 0.3, 0.16, 0.2);
    c.fill();
  },
  // 11 hand
  (c) => {
    poly(c, [0.08, 0.5, 0.62, 0.42, 0.9, 0.44, 0.9, 0.54, 0.62, 0.58, 0.08, 0.62]);
    c.fill();
    poly(c, [0.55, 0.42, 0.7, 0.32, 0.74, 0.36, 0.62, 0.46]);
    c.fill();
  },
  // 12 mouth
  (c) => {
    c.beginPath();
    c.moveTo(0.1, 0.5);
    c.quadraticCurveTo(0.5, 0.3, 0.9, 0.5);
    c.quadraticCurveTo(0.5, 0.7, 0.1, 0.5);
    c.fill();
  },
  // 13 bread
  (c) => {
    c.beginPath();
    c.moveTo(0.14, 0.66);
    c.quadraticCurveTo(0.5, 0.2, 0.86, 0.66);
    c.closePath();
    c.fill();
  },
  // 14 basket
  (c) => {
    c.beginPath();
    c.moveTo(0.1, 0.45);
    c.lineTo(0.9, 0.45);
    c.quadraticCurveTo(0.8, 0.78, 0.5, 0.78);
    c.quadraticCurveTo(0.2, 0.78, 0.1, 0.45);
    c.fill();
    c.lineWidth = 0.05;
    c.beginPath();
    c.arc(0.84, 0.5, 0.1, -1.4, 1.2);
    c.stroke();
  },
  // 15 feather of Maat
  (c) => {
    c.beginPath();
    c.moveTo(0.48, 0.94);
    c.quadraticCurveTo(0.34, 0.5, 0.52, 0.08);
    c.quadraticCurveTo(0.74, 0.14, 0.64, 0.4);
    c.quadraticCurveTo(0.56, 0.7, 0.54, 0.94);
    c.fill();
  },
  // 16 scarab
  (c) => {
    ellipse(c, 0.5, 0.58, 0.18, 0.24);
    c.fill();
    ellipse(c, 0.5, 0.28, 0.12, 0.08);
    c.fill();
    c.lineWidth = 0.04;
    for (let i = 0; i < 3; i++) {
      const y = 0.46 + i * 0.14;
      c.beginPath();
      c.moveTo(0.34, y);
      c.lineTo(0.16, y + 0.06);
      c.moveTo(0.66, y);
      c.lineTo(0.84, y + 0.06);
      c.stroke();
    }
  },
  // 17 lotus
  (c) => {
    c.beginPath();
    c.moveTo(0.5, 0.9);
    c.lineTo(0.5, 0.55);
    c.lineWidth = 0.05;
    c.stroke();
    poly(c, [0.5, 0.12, 0.6, 0.55, 0.4, 0.55]);
    c.fill();
    poly(c, [0.26, 0.2, 0.46, 0.56, 0.3, 0.56]);
    c.fill();
    poly(c, [0.74, 0.2, 0.7, 0.56, 0.54, 0.56]);
    c.fill();
  },
  // 18 pyramid
  (c) => {
    poly(c, [0.5, 0.14, 0.88, 0.82, 0.12, 0.82]);
    c.fill();
  },
  // 19 star
  (c) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 0.4 : 0.14;
      const x = 0.5 + Math.cos(a) * r;
      const y = 0.52 + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
  },
  // 20 house
  (c) => {
    c.lineWidth = 0.08;
    c.beginPath();
    c.moveTo(0.14, 0.78);
    c.lineTo(0.14, 0.28);
    c.lineTo(0.86, 0.28);
    c.lineTo(0.86, 0.78);
    c.lineTo(0.56, 0.78);
    c.stroke();
  },
  // 21 twisted flax
  (c) => {
    c.lineWidth = 0.07;
    c.beginPath();
    c.moveTo(0.5, 0.08);
    for (let i = 0; i < 4; i++) {
      const y = 0.18 + i * 0.2;
      c.bezierCurveTo(0.2, y, 0.2, y + 0.14, 0.5, y + 0.12);
      c.bezierCurveTo(0.8, y + 0.1, 0.8, y + 0.02, 0.5, y + 0.08);
    }
    c.stroke();
  },
  // 22 leg
  (c) => {
    poly(c, [0.46, 0.08, 0.58, 0.08, 0.56, 0.5, 0.6, 0.8, 0.86, 0.84, 0.86, 0.92, 0.46, 0.92, 0.44, 0.5]);
    c.fill();
  },
  // 23 arm
  (c) => {
    poly(c, [0.1, 0.62, 0.62, 0.56, 0.7, 0.28, 0.82, 0.3, 0.74, 0.66, 0.1, 0.72]);
    c.fill();
  },
  // 24 lion
  (c) => {
    ellipse(c, 0.46, 0.6, 0.3, 0.12);
    c.fill();
    ellipse(c, 0.76, 0.44, 0.12, 0.13);
    c.fill();
    c.fillRect(0.2, 0.62, 0.05, 0.2);
    c.fillRect(0.66, 0.62, 0.05, 0.2);
    c.lineWidth = 0.04;
    c.beginPath();
    c.moveTo(0.16, 0.56);
    c.quadraticCurveTo(0.04, 0.4, 0.14, 0.3);
    c.stroke();
  },
  // 25 shen ring
  (c) => {
    c.lineWidth = 0.08;
    ellipse(c, 0.5, 0.42, 0.24, 0.24);
    c.stroke();
    c.fillRect(0.22, 0.72, 0.56, 0.08);
  },
  // 26 papyrus
  (c) => {
    c.lineWidth = 0.05;
    c.beginPath();
    c.moveTo(0.5, 0.92);
    c.lineTo(0.5, 0.4);
    c.stroke();
    poly(c, [0.5, 0.42, 0.18, 0.12, 0.82, 0.12]);
    c.fill();
  },
  // 27 khopesh
  (c) => {
    c.lineWidth = 0.07;
    c.beginPath();
    c.moveTo(0.3, 0.88);
    c.lineTo(0.4, 0.5);
    c.quadraticCurveTo(0.45, 0.14, 0.78, 0.2);
    c.stroke();
  },
  // 28 seated god
  (c) => {
    ellipse(c, 0.44, 0.2, 0.08, 0.1);
    c.fill();
    poly(c, [0.36, 0.3, 0.54, 0.3, 0.56, 0.62, 0.78, 0.64, 0.78, 0.92, 0.32, 0.92]);
    c.fill();
    c.fillRect(0.56, 0.36, 0.2, 0.05);
  },
  // 29 cartouche loop
  (c) => {
    c.lineWidth = 0.06;
    c.beginPath();
    c.roundRect(0.26, 0.1, 0.48, 0.72, 0.2);
    c.stroke();
    c.fillRect(0.22, 0.84, 0.56, 0.06);
  },
];

export function drawGlyph(c: CanvasRenderingContext2D, index: number, x: number, y: number, size: number): void {
  const fn = GLYPHS[((index % GLYPHS.length) + GLYPHS.length) % GLYPHS.length]!;
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  fn(c);
  c.restore();
}
