/**
 * The fighter state machine. It owns all timing: moves advance frame by frame
 * through startup / active / recovery, and states such as hitstun, knockdown,
 * lying and getup end when their frame counters run out. Animation clip
 * selection is a by-product of the state (anim, animFrame, animMove).
 */
import type { Fighter, World } from './types';
import type { MoveDef } from '../data/defs';
import { getMove, moveTotal } from '../data/moves';
import { getFighterDef } from '../data/fighters';
import { getEnv } from '../data/level';
import { COMBAT, PHYSICS, PLAYER_MOVEMENT } from '../data/tuning';
import { PROJECTILES, WEAPONS } from '../data/weapons';
import { airtime, getupInvuln, isHittable, launchAirtime, setAnim, setState, toIdle } from './fighter';
import { launch } from './combat';
import { spawnLob, spawnProjectile } from './projectiles';
import { summonFor } from './spawn';
import { clamp, sign, viewHalfWidthAt } from './view';

export function startMove(w: World, f: Fighter, id: string, aimX = f.x, aimZ = f.z, item = -1): void {
  const md = getMove(id);
  setState(f, 'attack');
  f.move = {
    id,
    frame: 0,
    hitIds: [],
    connected: false,
    chargeFrames: 0,
    chargeDone: false,
    aimX,
    aimZ,
    item,
    evFrame: -1,
  };
  f.telegraph = !!md.telegraph && md.startup > 0;
  setAnim(f, md.clip, id, moveTotal(md), true);
  if (!md.air) {
    f.vx = 0;
    f.vz = 0;
  }
  if (f.ai) f.ai.attacked = true;
  if (f.boss) f.boss.hitsSinceAction = 0;
  if (f.telegraph) w.events.push({ type: 'telegraph', id: f.id, move: id });
}

function holdFrame(md: MoveDef): number {
  return md.startup + md.active - 1;
}

function isCharging(f: Fighter, md: MoveDef): boolean {
  return !!md.charge && !!f.move && f.move.frame === holdFrame(md) && !f.move.chargeDone;
}

/** Per-frame move logic: motion, one-shot effects, charge travel. */
function updateMove(w: World, f: Fighter): void {
  const m = f.move!;
  const md = getMove(m.id);
  const fresh = m.frame !== m.evFrame;
  m.evFrame = m.frame;
  const charging = isCharging(f, md);

  let driven = false;
  if (charging) {
    f.vx = md.charge!.speed * f.facing;
    f.vz = 0;
    driven = true;
    m.chargeFrames++;
    if (f.anim !== `${md.clip}_loop`) setAnim(f, `${md.clip}_loop`, null, 0, true);
  } else {
    if (f.animMove !== m.id) {
      setAnim(f, md.clip, m.id, moveTotal(md), true);
      f.animFrame = m.frame;
      f.pAnimFrame = m.frame;
    }
    if (md.motion) {
      for (const seg of md.motion) {
        if (m.frame >= seg.from && m.frame < seg.to) {
          f.vx = seg.vx * f.facing;
          f.vz = seg.vz ?? 0;
          driven = true;
          break;
        }
      }
    }
  }
  const airborne = f.y > 0 || f.vy > 0;
  if (!driven && !airborne) {
    const fr = md.friction ?? PHYSICS.groundFriction;
    f.vx *= fr;
    f.vz *= fr;
    if (Math.abs(f.vx) < 1e-4) f.vx = 0;
    if (Math.abs(f.vz) < 1e-4) f.vz = 0;
  }

  if (!fresh) return;
  const frame = m.frame;
  if (md.jump && frame === md.jump.frame) {
    const j = md.jump;
    f.vy = j.vy;
    f.y = Math.max(f.y, 0.001);
    if (j.toTarget) {
      const flight = airtime(j.vy, PHYSICS.gravity);
      const max = j.maxVx ?? 0.2;
      f.vx = clamp((m.aimX - f.x) / flight, -max, max);
      f.vz = clamp((m.aimZ - f.z) / flight, -0.06, 0.06);
      if (Math.abs(f.vx) > 0.01) f.facing = f.vx > 0 ? 1 : -1;
    } else {
      f.vx = j.vx * f.facing;
      f.vz = 0;
    }
    w.events.push({ type: 'jump', id: f.id });
  }
  if (md.hits.length > 0 && frame === md.startup) {
    w.events.push({ type: 'whiff', id: f.id, heavy: md.hits.some((h) => h.type !== 'light') });
  }
  if (md.sfx) for (const s of md.sfx) if (s.frame === frame) w.events.push({ type: 'sfx', name: s.name, x: f.x });
  if (md.shakeAt && frame === md.shakeAt.frame) w.events.push({ type: 'shake', amount: md.shakeAt.amount, frames: md.shakeAt.frames });
  if (md.projectile && frame === md.projectile.frame) fireProjectile(w, f, md.projectile.kind, md.projectile.x, md.projectile.y);
  if (md.throwWeapon && frame === md.throwWeapon.frame) throwHeldWeapon(w, f);
  if (md.summon && frame === md.summon.frame) summonFor(w, f);
  if (m.item >= 0 && frame === PLAYER_MOVEMENT.pickupFrame) pickupItem(w, f, m.item);
}

function fireProjectile(w: World, f: Fighter, kind: 'jar' | 'lobJar' | 'shockwave', ox: number, oy: number): void {
  const m = f.move!;
  const x = f.x + f.facing * ox;
  if (kind === 'lobJar') {
    spawnLob(w, f, x, f.y + oy, f.z, m.aimX, m.aimZ);
    w.events.push({ type: 'throw', id: f.id });
  } else if (kind === 'shockwave') {
    spawnProjectile(w, 'shockwave', f, f.x, 0, f.z, 0, 0);
    w.events.push({ type: 'shockwave', x: f.x, z: f.z, big: false });
  } else {
    const def = PROJECTILES.jar;
    spawnProjectile(w, 'jar', f, x, f.y + oy, f.z, f.facing * (def.speedX ?? 0.2), def.speedY ?? 0.05);
    w.events.push({ type: 'throw', id: f.id });
  }
}

function throwHeldWeapon(w: World, f: Fighter): void {
  if (!f.weapon || !WEAPONS[f.weapon].thrown) return;
  const def = PROJECTILES.jar;
  spawnProjectile(w, 'jar', f, f.x + f.facing * 0.45, f.y + 1.45, f.z, f.facing * (def.speedX ?? 0.2), def.speedY ?? 0.05);
  f.weapon = null;
  f.weaponDurability = 0;
  w.events.push({ type: 'throw', id: f.id });
}

function pickupItem(w: World, f: Fighter, itemId: number): void {
  for (const it of w.items) {
    if (it.id !== itemId || it.removeMe) continue;
    if (Math.abs(it.x - f.x) > WEAPONS[it.type].reach + 0.35 || Math.abs(it.z - f.z) > 0.6) return;
    f.weapon = it.type;
    f.weaponDurability = it.durability;
    it.removeMe = true;
    w.events.push({ type: 'weaponPickup', id: f.id, weapon: it.type });
    return;
  }
}

function landFromAir(w: World, f: Fighter, len: number): void {
  setState(f, 'land', len);
  setAnim(f, 'land', null, len, true);
  f.vx = 0;
  f.vz = 0;
  w.events.push({ type: 'land', id: f.id, heavy: f.kind === 'boss' || len >= 12 });
}

function respawnBlast(w: World, f: Fighter): void {
  const r2 = COMBAT.respawnBlastRadius * COMBAT.respawnBlastRadius;
  w.events.push({ type: 'shockwave', x: f.x, z: f.z, big: true });
  w.events.push({ type: 'shake', amount: 0.5, frames: 18 });
  for (const e of w.fighters) {
    if (e.team === f.team || !isHittable(e)) continue;
    const dx = e.x - f.x;
    const dz = e.z - f.z;
    if (dx * dx + dz * dz > r2) continue;
    launch(w, e, dx >= 0 ? 1 : -1, 0.12, 0.13);
    e.flash = 10;
  }
}

function takeoff(w: World, f: Fighter): void {
  setState(f, 'air');
  f.vy = PLAYER_MOVEMENT.jumpVelocity;
  f.y = 0.001;
  setAnim(f, 'jump', null, airtime(f.vy, PHYSICS.gravity), true);
  w.events.push({ type: 'jump', id: f.id });
}

export function startJump(f: Fighter, dirX: number, dirZ: number, running: boolean): void {
  setState(f, 'jumpSquat', PLAYER_MOVEMENT.jumpSquat);
  setAnim(f, 'jump_squat', null, PLAYER_MOVEMENT.jumpSquat, true);
  f.jumpDir = dirX !== 0 ? 1 : 0;
  f.vx = dirX * (running ? PLAYER_MOVEMENT.runJumpSpeedX : PLAYER_MOVEMENT.jumpSpeedX);
  f.vz = dirZ * PLAYER_MOVEMENT.jumpSpeedZ;
  if (dirX !== 0) f.facing = dirX > 0 ? 1 : -1;
  f.airAttackUsed = false;
}

function respawn(w: World, f: Fighter): void {
  f.hp = f.maxHp;
  f.dying = false;
  f.y = COMBAT.respawnHeight;
  f.py = f.y;
  f.vx = 0;
  f.vy = 0;
  f.vz = 0;
  const hw = viewHalfWidthAt(f.z) - 1.5;
  f.x = clamp(f.x, w.camera.x - hw, w.camera.x + hw);
  f.px = f.x;
  f.weapon = null;
  f.weaponDurability = 0;
  setState(f, 'respawn');
  setAnim(f, 'fall');
  f.invuln = COMBAT.respawnInvuln;
  w.events.push({ type: 'respawn', player: f.player, x: f.x, z: f.z });
}

/** A player's death animation finished: spend a life or end the game. */
function playerOut(w: World, f: Fighter): void {
  const slot = w.players[f.player];
  if (!slot) return;
  slot.lives = Math.max(0, slot.lives - 1);
  if (slot.lives > 0) {
    respawn(w, f);
  } else if (!w.gameOver) {
    w.gameOver = true;
    w.events.push({ type: 'gameOver' });
  }
}

/** State transitions driven by timers. Runs before control so freed fighters can act this frame. */
export function resolveStateEnd(w: World, f: Fighter): void {
  switch (f.state) {
    case 'attack': {
      const m = f.move!;
      const md = getMove(m.id);
      if (m.frame >= moveTotal(md)) {
        if (md.air && (f.y > 0 || f.vy > 0)) {
          f.airAttackUsed = true;
          setState(f, 'air');
          setAnim(f, 'fall');
        } else {
          toIdle(f);
        }
      }
      break;
    }
    case 'jumpSquat':
      if (f.stateFrame >= f.stateLen) takeoff(w, f);
      break;
    case 'land':
    case 'hitstun':
      if (f.stateFrame >= f.stateLen) toIdle(f);
      break;
    case 'lying':
      if (f.stateFrame >= f.stateLen) {
        if (f.dying) {
          setState(f, 'dead', COMBAT.deathFrames);
          setAnim(f, 'death');
          w.events.push({ type: 'death', id: f.id, kind: f.kind });
          if (f.player >= 0) w.events.push({ type: 'playerDeath', player: f.player });
        } else {
          const def = getFighterDef(f.def);
          setState(f, 'getup', def.getupFrames);
          setAnim(f, 'getup', null, def.getupFrames, true);
        }
      }
      break;
    case 'getup':
      if (f.stateFrame >= f.stateLen) {
        toIdle(f);
        f.invuln = getupInvuln(f);
      }
      break;
    case 'dead':
      if (f.stateFrame === f.stateLen) {
        if (f.player >= 0) playerOut(w, f);
        else f.removeMe = true;
      }
      break;
    default:
      break;
  }
}

/** Movement, gravity, landings and move effects for the current state. */
export function updatePhysics(w: World, f: Fighter): void {
  const def = getFighterDef(f.def);
  switch (f.state) {
    case 'idle':
    case 'walk':
    case 'run':
    case 'enter':
    case 'victory':
      f.x += f.vx;
      f.z += f.vz;
      break;
    case 'attack': {
      updateMove(w, f);
      const md = getMove(f.move!.id);
      f.x += f.vx;
      f.z += f.vz;
      if (f.y > 0 || f.vy > 0) {
        f.vy = Math.max(-PHYSICS.maxFall, f.vy - PHYSICS.gravity);
        f.y += f.vy;
        if (f.y <= 0) {
          f.y = 0;
          f.vy = 0;
          landFromAir(w, f, md.landRecovery ?? PLAYER_MOVEMENT.landFrames);
          break;
        }
      }
      if (md.charge && md.charge.stopAtEdge && isCharging(f, md) && f.move!.chargeFrames > 4) {
        const hw = viewHalfWidthAt(f.z) - PHYSICS.screenMargin - 0.25;
        const edge = w.camera.x + f.facing * hw;
        if (f.facing === 1 ? f.x >= edge : f.x <= edge) {
          f.x = edge;
          f.vx = 0;
          f.move!.chargeDone = true;
          w.events.push({ type: 'shake', amount: f.kind === 'boss' ? 0.75 : 0.45, frames: 16 });
          w.events.push({ type: 'sfx', name: 'wall_crash', x: f.x });
        }
      }
      break;
    }
    case 'jumpSquat':
      break;
    case 'air':
      f.x += f.vx;
      f.z += f.vz;
      f.vy = Math.max(-PHYSICS.maxFall, f.vy - PHYSICS.gravity);
      f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        landFromAir(w, f, f.player >= 0 ? PLAYER_MOVEMENT.landFrames : PLAYER_MOVEMENT.dropLandFrames);
      }
      break;
    case 'respawn':
      f.vy = Math.max(-PHYSICS.maxFall, f.vy - PHYSICS.gravity);
      f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        respawnBlast(w, f);
        landFromAir(w, f, COMBAT.respawnLandFrames);
      }
      break;
    case 'land':
      f.vx = 0;
      f.vz = 0;
      break;
    case 'hitstun':
      f.vx *= PHYSICS.hitstunFriction;
      f.x += f.vx;
      break;
    case 'launched':
      f.vy = Math.max(-PHYSICS.maxFall, f.vy - PHYSICS.launchGravity);
      f.x += f.vx;
      f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0;
        if (f.bounces === 0 && -f.vy > PHYSICS.bounceMinVy) {
          f.vy = -f.vy * PHYSICS.bounceDamping;
          f.vx *= PHYSICS.bounceVxScale;
          f.bounces++;
          f.y = 0.001;
          w.events.push({ type: 'bounce', id: f.id, x: f.x, z: f.z });
          setAnim(f, 'bounce', null, launchAirtime(f.vy), true);
        } else {
          f.vy = 0;
          f.vx = 0;
          const len = f.dying ? COMBAT.deathLyingFrames : def.lyingFrames;
          setState(f, 'lying', len);
          setAnim(f, f.dying ? 'death' : 'lying', null, len, true);
        }
      }
      break;
    case 'lying':
    case 'getup':
    case 'dead':
      f.vx = 0;
      f.vz = 0;
      break;
    case 'intro':
      if (f.y > 0 || f.vy > 0) {
        f.vy = Math.max(-PHYSICS.maxFall, f.vy - PHYSICS.gravity);
        f.y += f.vy;
        if (f.y <= 0) {
          f.y = 0;
          f.vy = 0;
          w.events.push({ type: 'land', id: f.id, heavy: true });
          w.events.push({ type: 'shake', amount: 0.9, frames: 26 });
          w.events.push({ type: 'shockwave', x: f.x, z: f.z, big: true });
        }
      }
      break;
  }
}

/** Advance frame counters after combat (only for fighters that stepped this frame). */
export function advanceCounters(f: Fighter): void {
  f.stateFrame++;
  if (f.invuln > 0) f.invuln--;
  if (f.state === 'attack' && f.move) {
    const md = getMove(f.move.id);
    const charging = isCharging(f, md);
    if (charging && f.move.chargeFrames >= md.charge!.max) f.move.chargeDone = true;
    if (!charging) f.move.frame++;
    if (f.move.frame >= md.startup) f.telegraph = false;
    if (f.animMove === f.move.id) f.animFrame = f.move.frame;
    else f.animFrame++;
  } else {
    f.animFrame++;
  }
}

/** Keep fighters inside the lane and (when appropriate) inside the screen. */
export function clampFighters(w: World): void {
  const env = getEnv(w.level.env);
  const cam = w.camera.x;
  const tr = w.level.transition;
  for (const f of w.fighters) {
    if (f.removeMe) continue;
    const entering = f.player < 0 && (f.state === 'enter' || (f.ai !== null && f.ai.mode === 'enter'));
    if (!entering) f.z = clamp(f.z, env.zMin, env.zMax);
    const hw = viewHalfWidthAt(f.z) - PHYSICS.screenMargin;
    let lo = cam - hw;
    let hi = cam + hw;
    if (f.player >= 0) {
      if (tr) {
        if (tr.phase === 'exit' || tr.phase === 'fade') hi = Infinity;
        if (tr.phase === 'enter') lo = -Infinity;
      }
    } else {
      if (entering || w.camera.lockX === null) continue;
      if (f.state === 'dead') continue;
    }
    if (f.x < lo) {
      f.x = lo;
      if (f.state === 'launched') f.vx = Math.abs(f.vx) * 0.4;
      else if (f.state === 'hitstun') f.vx = 0;
    } else if (f.x > hi) {
      f.x = hi;
      if (f.state === 'launched') f.vx = -Math.abs(f.vx) * 0.4;
      else if (f.state === 'hitstun') f.vx = 0;
    }
  }
}

function pushable(f: Fighter): boolean {
  return f.kind === 'enemy' && f.y === 0 && (f.state === 'idle' || f.state === 'walk');
}

/** Soft separation so enemies don't stack on each other or on the player. */
export function separate(w: World): void {
  const list = w.fighters;
  const sx = PHYSICS.separationX;
  const sz = PHYSICS.separationZ;
  const push = PHYSICS.separationPush;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    if (a.removeMe) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      if (b.removeMe) continue;
      const pa = pushable(a);
      const pb = pushable(b);
      if (!pa && !pb) continue;
      if (a.team === 0 && b.team === 0) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const mixed = a.team !== b.team;
      const lx = mixed ? 0.5 : sx;
      const lz = mixed ? 0.24 : sz;
      if (Math.abs(dx) >= lx || Math.abs(dz) >= lz) continue;
      const s = dx === 0 ? (a.id < b.id ? 1 : -1) : sign(dx);
      const zs = dz === 0 ? 0 : sign(dz);
      if (pa) {
        a.x -= s * push;
        a.z -= zs * push * 0.4;
      }
      if (pb) {
        b.x += s * push;
        b.z += zs * push * 0.4;
      }
    }
  }
}
