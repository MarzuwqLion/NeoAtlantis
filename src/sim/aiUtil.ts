/**
 * Small helpers shared by the enemy brains and the boss brains.
 */
import type { Fighter, World } from './types';
import { viewHalfWidthAt } from './view';

/** Visible horizontally (with an inner margin). */
export function onScreen(w: World, f: Fighter, margin: number): boolean {
  return Math.abs(f.x - w.camera.x) <= viewHalfWidthAt(f.z) - margin;
}

export function pickTarget(w: World, f: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bestD = Infinity;
  for (const p of w.fighters) {
    if (p.team !== 0 || p.removeMe) continue;
    if (p.state === 'dead' || p.state === 'respawn' || p.dying) continue;
    const d = Math.abs(p.x - f.x) + Math.abs(p.z - f.z) * 1.5;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Can the target be attacked right now (no point swinging at a downed player)? */
export function targetOpen(t: Fighter): boolean {
  switch (t.state) {
    case 'launched':
    case 'lying':
    case 'getup':
    case 'dead':
    case 'respawn':
      return false;
    default:
      return t.invuln <= 0;
  }
}

export function face(f: Fighter, dx: number): void {
  if (dx > 0.05) f.facing = 1;
  else if (dx < -0.05) f.facing = -1;
}
