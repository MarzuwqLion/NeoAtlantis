/**
 * Projectiles: thrown jars, lobbed jars and the mid-boss shockwave ring.
 */
import type { Facing, Fighter, Projectile, ProjectileKind, World } from './types';
import { PROJECTILES } from '../data/weapons';
import { getFighterDef } from '../data/fighters';
import { getEnv } from '../data/level';
import { applyHit } from './combat';
import { hurtHeight, isHittable } from './fighter';
import { clamp, viewHalfWidthAt } from './view';

export function spawnProjectile(
  w: World,
  kind: ProjectileKind,
  owner: Fighter,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  targetX = x,
  targetZ = z,
): Projectile {
  const p: Projectile = {
    id: w.nextId++,
    kind,
    team: owner.team,
    owner: owner.id,
    x,
    y,
    z,
    px: x,
    py: y,
    pz: z,
    vx,
    vy,
    vz: 0,
    age: 0,
    radius: 0,
    targetX,
    targetZ,
    hitIds: [],
    removeMe: false,
  };
  w.projectiles.push(p);
  return p;
}

/** Thrower lob: pick the launch velocity so the jar lands on the target point. */
export function spawnLob(w: World, owner: Fighter, x: number, y: number, z: number, tx: number, tz: number): Projectile {
  const def = PROJECTILES.lobJar;
  const lob = def.lob!;
  const dist = Math.abs(tx - x);
  const flight = clamp(Math.round(dist * lob.perMeter), lob.min, lob.max);
  // y(t) = y + vy t - g t^2/2 = 0 at t = flight
  const vy = (def.gravity * flight * flight * 0.5 - y) / flight;
  const vx = (tx - x) / flight;
  const p = spawnProjectile(w, 'lobJar', owner, x, y, z, vx, vy, tx, z);
  p.vz = (clamp(tz, z - 0.6, z + 0.6) - z) / flight;
  p.targetZ = z + p.vz * flight;
  return p;
}

function ownerPlayer(w: World, p: Projectile): number {
  for (const f of w.fighters) if (f.id === p.owner) return f.player;
  return -1;
}

function touches(p: Projectile, t: Fighter, radius: number, zRange: number): boolean {
  const def = getFighterDef(t.def);
  if (Math.abs(p.x - t.x) > radius + def.hurt.halfWidth) return false;
  if (p.y + radius < t.y || p.y - radius > t.y + hurtHeight(t)) return false;
  return Math.abs(p.z - t.z) <= zRange + def.hurt.zRadius;
}

export function updateProjectiles(w: World): void {
  const env = getEnv(w.level.env);
  for (const p of w.projectiles) {
    if (p.removeMe) continue;
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    p.age++;
    const def = PROJECTILES[p.kind];
    if (p.age > def.maxAge) {
      p.removeMe = true;
      continue;
    }

    if (def.ring) {
      // Expanding ground ring: hits grounded targets under the wavefront.
      p.radius += def.ring.speed;
      if (p.radius > def.ring.maxRadius) {
        p.removeMe = true;
        continue;
      }
      for (const t of w.fighters) {
        if (t.team === p.team || !isHittable(t) || t.y > 0.22) continue;
        if (p.hitIds.includes(t.id)) continue;
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (Math.abs(d - p.radius) > def.ring.thickness * 0.5) continue;
        p.hitIds.push(t.id);
        const dir: Facing = t.x >= p.x ? 1 : -1;
        applyHit(w, { id: p.owner, x: p.x, z: p.z, facing: dir, team: p.team, fighter: null, player: -1, weaponMove: false }, t, def.hit);
      }
      continue;
    }

    // Ballistic flight
    p.vy -= def.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.z = clamp(p.z, env.zMin - 0.3, env.zMax + 0.3);
    const dir: Facing = p.vx >= 0 ? 1 : -1;

    // Direct hit
    for (const t of w.fighters) {
      if (t.team === p.team || !isHittable(t)) continue;
      if (!touches(p, t, def.radius, def.hit.zRange ?? 0.42)) continue;
      applyHit(w, { id: p.owner, x: p.x - dir, z: p.z, facing: dir, team: p.team, fighter: null, player: ownerPlayer(w, p), weaponMove: false }, t, def.hit);
      shatter(w, p);
      break;
    }
    if (p.removeMe) continue;

    // Ground impact
    if (p.y <= 0) {
      p.y = 0;
      if (def.splash) {
        const s = def.splash;
        for (const t of w.fighters) {
          if (t.team === p.team || !isHittable(t) || t.y > 0.6) continue;
          const dx = t.x - p.x;
          const dz = t.z - p.z;
          if (Math.abs(dz) > s.zRange + getFighterDef(t.def).hurt.zRadius) continue;
          if (Math.abs(dx) > s.radius) continue;
          const sdir: Facing = dx >= 0 ? 1 : -1;
          applyHit(w, { id: p.owner, x: p.x, z: p.z, facing: sdir, team: p.team, fighter: null, player: ownerPlayer(w, p), weaponMove: false }, t, s.hit);
        }
      }
      shatter(w, p);
      continue;
    }

    // Left the arena
    const hw = viewHalfWidthAt(p.z) + 3;
    if (Math.abs(p.x - w.camera.x) > hw) p.removeMe = true;
  }
}

function shatter(w: World, p: Projectile): void {
  p.removeMe = true;
  w.events.push({ type: 'shatter', x: p.x, y: Math.max(0.1, p.y), z: p.z });
}
