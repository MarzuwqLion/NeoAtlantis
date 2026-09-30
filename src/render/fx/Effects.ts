/**
 * Turns simulation events into feedback: hit sparks, slash streaks, dust,
 * shards, rings, screen shake and screen flashes. Owns the pooled particle
 * systems, blob shadows and ground rings.
 */
import * as THREE from 'three';
import type { SimEvent, World } from '../../sim/types';
import { ParticleSystem } from './Particles';
import { BlobShadows, GroundRings } from './Ground';

const tmp = new THREE.Color();

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class Effects {
  readonly group = new THREE.Group();
  readonly sparks = new ParticleSystem(900, true, 12);
  readonly smoke = new ParticleSystem(420, false, 11);
  readonly rings = new GroundRings(28);
  readonly shadows = new BlobShadows(96);
  /** Environment tint for dust. */
  readonly dust = new THREE.Color(0xb8a58a);
  readonly accent = new THREE.Color(0x6ff4ff);
  private shake = 0;
  private shakeFrames = 0;
  private shakeMax = 1;
  flash = 0;
  private time = 0;

  constructor() {
    this.group.add(this.smoke.mesh, this.sparks.mesh, this.rings.group, this.shadows.mesh);
  }

  addShake(amount: number, frames: number): void {
    if (amount >= this.shake * (this.shakeFrames / this.shakeMax)) {
      this.shake = amount;
      this.shakeFrames = frames;
      this.shakeMax = frames;
    }
  }

  shakeOffset(out: THREE.Vector2): THREE.Vector2 {
    if (this.shakeFrames <= 0) return out.set(0, 0);
    const k = this.shake * (this.shakeFrames / this.shakeMax) * 0.16;
    return out.set(Math.sin(this.time * 91.7) * k, Math.cos(this.time * 77.3) * k * 0.7);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.shakeFrames > 0) this.shakeFrames = Math.max(0, this.shakeFrames - dt * 60);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.rings.update(dt, this.time);
  }

  clear(): void {
    this.sparks.clear();
    this.smoke.clear();
    this.rings.clear();
    this.shakeFrames = 0;
    this.flash = 0;
  }

  // -------------------------------------------------------------------------

  hitSpark(x: number, y: number, z: number, kind: string, hitType: string, dir: number, blocked: boolean): void {
    const heavy = hitType === 'heavy';
    const kd = hitType === 'knockdown';
    const scale = kd ? 1.35 : heavy ? 1.12 : 0.9;
    if (blocked) {
      // Armour clank: orange sparks and a hard ring.
      this.sparks.spawn({ x, y, z, life: 0.1, size: 0.7 * scale, sizeEnd: 0.3, color: 0xffb060, intensity: 3, cell: 1, rot: Math.random() * 3 });
      for (let i = 0; i < 10; i++) {
        const a = rnd(0, Math.PI * 2);
        const s = rnd(3, 7);
        this.sparks.spawn({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1.5, vz: rnd(-1, 1), life: rnd(0.15, 0.3), size: 0.045, color: 0xffa040, intensity: 3, gravity: 9, stretch: 0.035, cell: 0 });
      }
      return;
    }
    let core = 0xfff0c8;
    let spark = 0xffc860;
    if (kind === 'blade') {
      core = 0xe8ffff;
      spark = 0x9ff6ff;
    } else if (kind === 'energy') {
      core = 0xf0d8ff;
      spark = 0xb070ff;
    } else if (kind === 'shatter') {
      core = 0xfff0d0;
      spark = 0xffb070;
    } else if (kind === 'blunt') {
      spark = 0xffd890;
    }
    // Impact flash
    this.sparks.spawn({ x, y, z, life: 0.1, size: 0.95 * scale, sizeEnd: 0.4 * scale, color: core, intensity: 3.2, cell: 1, rot: rnd(0, Math.PI) });
    this.sparks.spawn({ x, y, z, life: 0.14, size: 0.3 * scale, sizeEnd: 1.3 * scale, color: core, intensity: 1.4, alpha: 0.9, cell: 2 });
    if (kind === 'blade') {
      // Slash streak across the victim.
      const s = 10;
      const ang = dir > 0 ? rnd(-0.9, -0.5) : rnd(-2.6, -2.2);
      this.sparks.spawn({ x, y, z: z + 0.05, vx: Math.cos(ang) * s * dir * dir, vy: Math.sin(ang) * s, life: 0.12, size: 0.1, color: 0xffffff, intensity: 3.5, stretch: 0.22, cell: 0, drag: 20 });
    }
    const n = kd ? 16 : heavy ? 11 : 7;
    for (let i = 0; i < n; i++) {
      const a = rnd(-1.1, 1.1) + (dir > 0 ? 0 : Math.PI);
      const s = rnd(3.5, 8.5) * scale;
      this.sparks.spawn({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + rnd(0, 2),
        vz: rnd(-1.5, 1.5),
        life: rnd(0.12, 0.28),
        size: rnd(0.03, 0.06),
        color: spark,
        intensity: 3,
        gravity: 10,
        stretch: 0.03,
        drag: 3,
        cell: 0,
      });
    }
    if (kd || kind === 'blunt') {
      for (let i = 0; i < 5; i++) {
        this.smoke.spawn({ x: x + rnd(-0.1, 0.1), y: y + rnd(-0.1, 0.1), z, vx: rnd(-1, 1) + dir * 1.2, vy: rnd(0, 1), vz: rnd(-0.5, 0.5), life: rnd(0.35, 0.6), size: 0.25, sizeEnd: 0.7, color: tmp.copy(this.dust).multiplyScalar(1.05), alpha: 0.3, cell: 3, drag: 3, rot: rnd(0, 6), rotSpeed: rnd(-2, 2) });
      }
    }
  }

  dustPuff(x: number, z: number, amount: number, spread = 0.6): void {
    const n = Math.round(3 + amount * 6);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(0.6, 2.2) * (0.6 + amount);
      this.smoke.spawn({
        x: x + Math.cos(a) * 0.15,
        y: 0.08,
        z: z + Math.sin(a) * 0.1,
        vx: Math.cos(a) * s,
        vy: rnd(0.2, 0.9),
        vz: Math.sin(a) * s * spread,
        life: rnd(0.45, 0.8),
        size: 0.2 + amount * 0.15,
        sizeEnd: 0.6 + amount * 0.5,
        color: this.dust,
        alpha: 0.28,
        cell: 3,
        drag: 3.5,
        rot: rnd(0, 6),
        rotSpeed: rnd(-1.5, 1.5),
      });
    }
  }

  shards(x: number, y: number, z: number, color: THREE.ColorRepresentation, n = 12, glow = false): void {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(1.5, 5);
      (glow ? this.sparks : this.smoke).spawn({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: rnd(1.5, 5),
        vz: Math.sin(a) * s * 0.5,
        life: rnd(0.5, 0.9),
        size: rnd(0.05, 0.1),
        sizeEnd: 0.03,
        color,
        intensity: glow ? 2 : 1,
        alpha: 1,
        alphaEnd: 0.6,
        cell: 0,
        gravity: 12,
        rot: rnd(0, 6),
        rotSpeed: rnd(-12, 12),
      });
    }
  }

  glint(x: number, y: number, z: number, color: THREE.ColorRepresentation = 0xffffff, size = 0.8): void {
    this.sparks.spawn({ x, y, z, life: 0.28, size: 0.1, sizeEnd: size, color, intensity: 3, cell: 1, rot: 0.2, rotSpeed: 3, alpha: 1, alphaEnd: 0 });
  }

  motes(x: number, y: number, z: number, color: THREE.ColorRepresentation, n = 8): void {
    for (let i = 0; i < n; i++) {
      this.sparks.spawn({ x: x + rnd(-0.3, 0.3), y: y + rnd(0, 1.2), z: z + rnd(-0.2, 0.2), vx: rnd(-0.2, 0.2), vy: rnd(0.6, 1.6), life: rnd(0.6, 1.2), size: rnd(0.05, 0.1), color, intensity: 2.5, cell: 0, drag: 0.5 });
    }
  }

  /** Handle one simulation event. `pos` resolves fighter ids to positions. */
  onEvent(e: SimEvent, w: World): void {
    switch (e.type) {
      case 'hit': {
        const a = w.fighters.find((f) => f.id === e.attacker);
        const dir = a ? (e.x >= a.x ? 1 : -1) : 1;
        this.hitSpark(e.x, e.y, e.z, e.spark, e.hitType, dir, e.blocked);
        break;
      }
      case 'shake':
        this.addShake(e.amount, e.frames);
        break;
      case 'land': {
        const f = w.fighters.find((o) => o.id === e.id);
        if (f) this.dustPuff(f.x, f.z, e.heavy ? (f.kind === 'boss' ? 1.0 : 0.6) : 0.3);
        break;
      }
      case 'bounce':
        this.dustPuff(e.x, e.z, 0.7);
        break;
      case 'shatter':
        this.shards(e.x, Math.max(0.15, e.y), e.z, 0xb2683e, 16);
        this.shards(e.x, Math.max(0.15, e.y), e.z, 0x2a7f86, 5);
        this.dustPuff(e.x, e.z, 0.5);
        this.sparks.spawn({ x: e.x, y: Math.max(0.2, e.y), z: e.z, life: 0.12, size: 0.8, sizeEnd: 0.3, color: 0xffe0b0, intensity: 2.5, cell: 1 });
        break;
      case 'weaponBreak':
        this.shards(e.x, e.y, e.z, e.weapon === 'staff' ? 0x6a4428 : 0xe0c070, 14);
        this.shards(e.x, e.y, e.z, 0xfff0a0, 8, true);
        this.sparks.spawn({ x: e.x, y: e.y, z: e.z, life: 0.16, size: 1.1, sizeEnd: 0.2, color: 0xffe8a0, intensity: 3, cell: 1 });
        break;
      case 'weaponPickup': {
        const f = w.fighters.find((o) => o.id === e.id);
        if (f) {
          this.rings.burst(f.x, f.z, 0.2, 1.1, 0.35, 0xffd070, 1.2);
          this.motes(f.x, 0.4, f.z, 0xffe090, 10);
        }
        break;
      }
      case 'shockwave':
        if (e.big) {
          this.rings.burst(e.x, e.z, 0.3, 4.2, 0.55, 0xffd27a, 2.2);
          this.rings.burst(e.x, e.z, 0.2, 2.6, 0.4, 0xffffff, 1.5);
          this.dustPuff(e.x, e.z, 0.9, 0.9);
        } else {
          this.dustPuff(e.x, e.z, 0.8, 0.9);
        }
        break;
      case 'death': {
        const f = w.fighters.find((o) => o.id === e.id);
        if (f && f.team === 1) this.motes(f.x, 0.1, f.z, this.accent, 12);
        break;
      }
      case 'respawn':
        this.motes(e.x, 0.5, e.z, 0xffe090, 16);
        break;
      case 'bossDefeated':
        this.flash = 0.75;
        this.addShake(1, 40);
        break;
      case 'bossPhase': {
        const f = w.fighters.find((o) => o.id === e.id);
        if (f) {
          this.rings.burst(f.x, f.z, 0.3, 5, 0.9, 0xb45cff, 2.5);
          this.motes(f.x, 0.5, f.z, 0xb45cff, 24);
        }
        this.flash = 0.35;
        break;
      }
      case 'spawn': {
        if (e.from === 'door') {
          const f = w.fighters.find((o) => o.id === e.id);
          if (f) this.dustPuff(f.x, f.z + 0.6, 0.4);
        }
        break;
      }
      default:
        break;
    }
  }
}
