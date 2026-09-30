/**
 * Weapons lying on the ground.
 */
import type { Fighter, Item, WeaponType, World } from './types';
import { WEAPONS } from '../data/weapons';
import { COMBAT } from '../data/tuning';
import { getEnv } from '../data/level';
import { viewHalfWidthAt, clamp } from './view';

export interface ItemSpawnOptions {
  y?: number;
  vx?: number;
  vy?: number;
  durability?: number;
  /** -1 = never despawns. */
  lifetime?: number;
}

export function spawnItem(w: World, type: WeaponType, x: number, z: number, opts: ItemSpawnOptions = {}): Item {
  const y = opts.y ?? 0;
  const item: Item = {
    id: w.nextId++,
    type,
    x,
    y,
    z,
    px: x,
    py: y,
    pz: z,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
    durability: opts.durability ?? WEAPONS[type].durability,
    age: 0,
    lifetime: opts.lifetime ?? -1,
    removeMe: false,
  };
  w.items.push(item);
  return item;
}

/** Drop the fighter's weapon as a tossed ground item. */
export function dropWeapon(w: World, f: Fighter, dir: number): void {
  if (!f.weapon) return;
  const type = f.weapon;
  const durability = f.player >= 0 ? f.weaponDurability : WEAPONS[type].durability;
  spawnItem(w, type, f.x, f.z, {
    y: Math.max(0.6, f.y + 0.6),
    vx: -dir * 0.035,
    vy: 0.1,
    durability,
    lifetime: WEAPONS[type].groundLifetime,
  });
  f.weapon = null;
  f.weaponDurability = 0;
  w.events.push({ type: 'weaponDrop', id: f.id, weapon: type });
}

export function updateItems(w: World): void {
  const env = getEnv(w.level.env);
  for (const it of w.items) {
    it.px = it.x;
    it.py = it.y;
    it.pz = it.z;
    it.age++;
    if (it.y > 0 || it.vy > 0) {
      it.vy -= 0.009;
      it.y += it.vy;
      it.x += it.vx;
      if (it.y <= 0) {
        it.y = 0;
        if (it.vy < -0.04) {
          it.vy = -it.vy * 0.35;
          it.vx *= 0.6;
        } else {
          it.vy = 0;
          it.vx = 0;
        }
      }
    }
    it.z = clamp(it.z, env.zMin, env.zMax);
    const hw = viewHalfWidthAt(it.z) - 0.4;
    it.x = clamp(it.x, w.camera.x - hw, w.camera.x + hw);
    if (it.lifetime >= 0 && it.age >= it.lifetime) it.removeMe = true;
  }
}

/** Nearest item the fighter is standing over, or null. */
export function findPickup(w: World, f: Fighter): Item | null {
  let best: Item | null = null;
  let bestD = Infinity;
  for (const it of w.items) {
    if (it.removeMe || it.y > 0.05) continue;
    const reach = WEAPONS[it.type].reach;
    const dx = Math.abs(it.x - f.x);
    const dz = Math.abs(it.z - f.z);
    if (dx > reach || dz > COMBAT.pickupZ) continue;
    const d = dx + dz * 1.5;
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}
