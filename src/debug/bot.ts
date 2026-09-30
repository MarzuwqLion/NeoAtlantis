/**
 * Autoplay bot. Reads the world and produces an InputState for one player
 * slot, exactly like a gamepad would. Used for the automated playthrough
 * (headless test and in-browser Playwright run) and as a debug toggle.
 * Pure logic: no DOM, no three.js.
 */
import type { Fighter, InputState, World } from '../sim/types';
import type { MoveDef } from '../data/defs';
import { getMove } from '../data/moves';
import { getEnv } from '../data/level';
import { getFighterDef } from '../data/fighters';
import { COMBAT } from '../data/tuning';
import { viewHalfWidthAt } from '../sim/view';

function sgn(v: number): -1 | 0 | 1 {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

const DOWN_STATES = new Set(['launched', 'lying', 'getup', 'dead', 'intro', 'respawn']);

type Threat =
  | { kind: 'none' }
  | { kind: 'jump' }
  | { kind: 'lane'; dir: -1 | 1 }
  | { kind: 'counter'; target: Fighter }
  | { kind: 'retreat'; from: Fighter };

function maxReach(md: MoveDef): number {
  let r = 0;
  for (const h of md.hits) r = Math.max(r, h.box.x1);
  return r;
}

function laneWidth(md: MoveDef): number {
  let r = 0;
  for (const h of md.hits) r = Math.max(r, h.zRange ?? COMBAT.defaultZRange);
  return r;
}

export class Bot {
  private attackHeld = false;
  private jumpHeld = false;
  private laneDir: -1 | 1 = 1;
  private laneTimer = 0;
  private stuck = 0;
  private lastX = 0;
  private lastZ = 0;

  decide(w: World, slotIndex: number): InputState {
    const out: InputState = { x: 0, z: 0, attack: false, jump: false, run: false };
    const slot = w.players[slotIndex];
    if (!slot) return out;
    const me = w.fighters.find((f) => f.id === slot.fighterId);
    if (!me) return out;

    const enemies = w.fighters.filter((f) => f.team !== me.team && !f.dying && f.state !== 'dead' && !f.removeMe);
    const free = me.state === 'idle' || me.state === 'walk' || me.state === 'run';

    if (me.state === 'attack') {
      // Keep the combo going while it connects.
      if (me.move && me.move.connected && getMove(me.move.id).chain) this.tapAttack(out);
      else this.attackHeld = false;
      return out;
    }
    if (me.state === 'air') {
      const t = this.nearest(me, enemies);
      if (t && Math.abs(t.x - me.x) < 1.3 && Math.abs(t.z - me.z) < 0.4 && !DOWN_STATES.has(t.state)) this.tapAttack(out);
      else this.attackHeld = false;
      return out;
    }
    if (!free) {
      this.attackHeld = false;
      this.jumpHeld = false;
      return out;
    }

    const threat = this.assess(w, me, enemies);
    switch (threat.kind) {
      case 'jump':
        this.tapJump(out);
        return out;
      case 'lane':
        out.z = threat.dir;
        return this.finish(me, out);
      case 'counter': {
        const dx = threat.target.x - me.x;
        if (sgn(dx) !== me.facing && Math.abs(dx) > 0.1) {
          out.x = sgn(dx);
          return this.finish(me, out);
        }
        this.tapAttack(out);
        return out;
      }
      case 'retreat': {
        const away = sgn(me.x - threat.from.x) || 1;
        out.x = this.nearEdge(w, me, away) ? 0 : away;
        if (out.x === 0) out.z = this.escapeZ(w, me, threat.from.z);
        return this.finish(me, out);
      }
      default:
        break;
    }

    // Weapons lying around.
    if (!me.weapon) {
      const closeEnemy = enemies.some((e) => Math.abs(e.x - me.x) < 2 && Math.abs(e.z - me.z) < 0.9);
      let best: { x: number; z: number; d: number } | null = null;
      for (const it of w.items) {
        if (it.y > 0.05) continue;
        const d = Math.abs(it.x - me.x) + Math.abs(it.z - me.z);
        if (d < 5 && (!best || d < best.d)) best = { x: it.x, z: it.z, d };
      }
      if (best && !closeEnemy) {
        const dx = best.x - me.x;
        const dz = best.z - me.z;
        if (Math.abs(dx) < 0.45 && Math.abs(dz) < 0.3) {
          this.tapAttack(out);
          return out;
        }
        out.x = Math.abs(dx) > 0.25 ? sgn(dx) : 0;
        out.z = Math.abs(dz) > 0.15 ? sgn(dz) : 0;
        return this.finish(me, out);
      }
    }

    const target = this.pickTarget(w, me, enemies);
    if (!target) {
      const env = getEnv(w.level.env);
      out.x = 1;
      out.run = true;
      const mid = (env.zMin + env.zMax) / 2;
      if (Math.abs(me.z - mid) > 0.8) out.z = sgn(mid - me.z);
      return this.finish(me, out);
    }

    const dx = target.x - me.x;
    const dz = target.z - me.z;
    const adx = Math.abs(dx);
    const adz = Math.abs(dz);
    const boss = target.kind === 'boss';
    const tdef = getFighterDef(target.def);
    const reach = (me.weapon === 'staff' ? 2.1 : me.weapon === 'khopesh' ? 1.3 : me.weapon === 'jar' ? 7 : 0.95) + tdef.hurt.halfWidth;
    const wantDist = me.weapon === 'jar' ? 3.5 : Math.max(0.55, reach - 0.45);

    if (boss && this.bossBusy(target)) {
      // Keep away from a winding-up / attacking boss and stay off its lane.
      const safe = 3.6;
      if (adx < safe) out.x = this.nearEdge(w, me, -sgn(dx) || 1) ? 0 : ((-sgn(dx) || 1) as -1 | 1);
      if (adz < 1.4) out.z = this.escapeZ(w, me, target.z);
      return this.finish(me, out);
    }

    // Line up out of reach first, then step in.
    const aligned = adz <= 0.18;
    if (!aligned) out.z = sgn(dz);
    const approachDist = aligned ? wantDist : Math.max(wantDist, 1.7);
    if (adx > approachDist + 0.25) out.x = sgn(dx);
    else if (adx < approachDist - 0.4) out.x = (-sgn(dx) || 1) as -1 | 1;
    if (adx > 5.5 && adz < 1) out.run = true;

    if (adz <= 0.28 && adx <= reach - 0.05 && this.hittable(target)) {
      if (sgn(dx) !== me.facing && adx > 0.1) {
        out.x = sgn(dx);
        out.z = 0;
        return this.finish(me, out);
      }
      this.tapAttack(out);
      return out;
    }
    return this.finish(me, out);
  }

  private finish(me: Fighter, out: InputState): InputState {
    const moved = Math.abs(me.x - this.lastX) + Math.abs(me.z - this.lastZ) > 0.002;
    if (!moved && (out.x !== 0 || out.z !== 0)) this.stuck++;
    else this.stuck = 0;
    this.lastX = me.x;
    this.lastZ = me.z;
    if (this.stuck > 90) {
      this.stuck = 0;
      this.tapJump(out);
    } else {
      this.jumpHeld = false;
    }
    this.attackHeld = false;
    return out;
  }

  private tapAttack(out: InputState): void {
    out.attack = !this.attackHeld;
    this.attackHeld = out.attack;
  }

  private tapJump(out: InputState): void {
    out.jump = !this.jumpHeld;
    this.jumpHeld = out.jump;
  }

  private nearest(me: Fighter, list: Fighter[]): Fighter | null {
    let best: Fighter | null = null;
    let bd = Infinity;
    for (const e of list) {
      const d = Math.abs(e.x - me.x) + Math.abs(e.z - me.z) * 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private hittable(t: Fighter): boolean {
    return !DOWN_STATES.has(t.state) && t.invuln <= 0;
  }

  private pickTarget(w: World, me: Fighter, list: Fighter[]): Fighter | null {
    let best: Fighter | null = null;
    let bd = Infinity;
    for (const e of list) {
      if (Math.abs(e.x - w.camera.x) > viewHalfWidthAt(e.z) + 0.2) continue;
      let d = Math.abs(e.x - me.x) + Math.abs(e.z - me.z) * 2.5;
      if (!this.hittable(e)) d += 8;
      if (e.kind === 'boss') d += 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private bossBusy(b: Fighter): boolean {
    if (b.state === 'intro') return true;
    if (b.state !== 'attack' || !b.move) return false;
    const md = getMove(b.move.id);
    if (md.charge && !b.move.chargeDone) return true;
    return b.move.frame < md.startup + md.active + 1;
  }

  private nearEdge(w: World, me: Fighter, dir: number): boolean {
    const hw = viewHalfWidthAt(me.z) - 1.0;
    return dir > 0 ? me.x > w.camera.x + hw : me.x < w.camera.x - hw;
  }

  private escapeZ(w: World, me: Fighter, fromZ: number): -1 | 1 {
    const env = getEnv(w.level.env);
    const up = me.z - env.zMin;
    const down = env.zMax - me.z;
    let dir: -1 | 1 = me.z < fromZ ? -1 : 1;
    if (Math.abs(me.z - fromZ) < 0.05) dir = up > down ? -1 : 1;
    if (dir === -1 && up < 0.5) dir = 1;
    if (dir === 1 && down < 0.5) dir = -1;
    return dir;
  }

  private assess(w: World, me: Fighter, enemies: Fighter[]): Threat {
    if (this.laneTimer > 0) {
      this.laneTimer--;
      return { kind: 'lane', dir: this.laneDir };
    }
    for (const p of w.projectiles) {
      if (p.team === me.team) continue;
      if (p.kind === 'shockwave') {
        const d = Math.hypot(me.x - p.x, me.z - p.z);
        if (d > p.radius - 0.2 && d - p.radius < 1.0) return { kind: 'jump' };
      } else if (p.kind === 'lobJar') {
        if (Math.abs(p.targetX - me.x) < 1.4 && Math.abs(p.targetZ - me.z) < 0.9) return this.lane(w, me, p.targetZ, 16);
      }
    }
    const myReach = (me.weapon === 'staff' ? 2.1 : me.weapon === 'khopesh' ? 1.3 : 0.95) + 0.3;
    for (const e of enemies) {
      if (e.state !== 'attack' || !e.move) continue;
      const md = getMove(e.move.id);
      if (md.hits.length === 0) continue;
      const endActive = md.startup + md.active + (md.charge && !e.move.chargeDone ? 1 : 0);
      if (e.move.frame >= endActive && !(md.charge && !e.move.chargeDone) && !md.activeUntilLand) continue;
      const dx = me.x - e.x;
      const adx = Math.abs(dx);
      const adz = Math.abs(e.z - me.z);
      const radial = md.hits.some((h) => h.radial);
      const ahead = radial || sgn(dx) === e.facing || adx < 0.4;
      const travels = !!md.charge || (md.motion ?? []).some((m) => m.vx > 0.12);
      const reach = travels ? 11 : maxReach(md) + 0.9;
      const lane = laneWidth(md) + 0.35;
      if (!ahead || adx > reach || adz > lane) continue;
      const armored = !!md.armor && md.armor.level === 'full';
      if (!travels && !armored && e.kind !== 'boss' && adx <= myReach && adz < 0.3 && e.move.frame < md.startup) {
        return { kind: 'counter', target: e };
      }
      if (travels || e.kind === 'boss' || md.activeUntilLand) return this.lane(w, me, e.z, 12);
      return { kind: 'retreat', from: e };
    }
    return { kind: 'none' };
  }

  private lane(w: World, me: Fighter, fromZ: number, frames: number): Threat {
    this.laneDir = this.escapeZ(w, me, fromZ);
    this.laneTimer = frames;
    return { kind: 'lane', dir: this.laneDir };
  }
}
