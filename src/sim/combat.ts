/**
 * Hit detection and hit resolution.
 *
 * Hitboxes come from move data and are active on specific frames. Hurtboxes
 * come from the fighter definition. Both live in belt space; a hit connects
 * only when the boxes overlap in x/y AND the fighters are within a small
 * depth (z) tolerance. There are no bone-attached colliders.
 */
import type { Facing, Fighter, MoveState, World, HitType } from './types';
import type { HitDef } from '../data/defs';
import { getMove } from '../data/moves';
import { getFighterDef } from '../data/fighters';
import { COMBAT, SCORE } from '../data/tuning';
import { armorLevel, hurtHeight, isHittable, launchAirtime, releaseToken, setAnim, setState } from './fighter';
import { WEAPONS } from '../data/weapons';
import { dropWeapon, spawnItem } from './items';
import { chance } from './rng';

export interface HitSource {
  id: number;
  x: number;
  z: number;
  facing: Facing;
  team: number;
  /** Attacking fighter for melee hits (receives hitstop). Null for projectiles. */
  fighter: Fighter | null;
  /** Player slot credited with the hit (-1 = none). */
  player: number;
  /** Melee move that used a weapon (consumes durability). */
  weaponMove: boolean;
}

interface PendingHit {
  attacker: Fighter;
  target: Fighter;
  hit: HitDef;
  key: number;
  /** Captured at detection time: applying an earlier hit may interrupt the attacker (trades). */
  move: MoveState;
  weaponMove: boolean;
}

const pending: PendingHit[] = [];
const hitThisFrame = new Set<number>();

/** Is hit `h` of the attacker's current move active on the frame being executed? */
export function hitActive(a: Fighter, hitIndex: number): boolean {
  const m = a.move;
  if (!m || a.state !== 'attack') return false;
  const md = getMove(m.id);
  const h = md.hits[hitIndex];
  if (!h) return false;
  const from = h.from ?? md.startup;
  if (md.activeUntilLand) return m.frame >= from && a.y > 0;
  const to = h.to ?? md.startup + md.active;
  return m.frame >= from && m.frame < to;
}

/** World-space x range of a hitbox given the attacker's facing. */
export function hitboxX(a: { x: number; facing: Facing }, h: HitDef): [number, number] {
  return a.facing === 1 ? [a.x + h.box.x0, a.x + h.box.x1] : [a.x - h.box.x1, a.x - h.box.x0];
}

/** Box/box overlap in x/y plus the depth tolerance test. */
export function hitConnects(a: Fighter, h: HitDef, t: Fighter): boolean {
  const def = getFighterDef(t.def);
  const [x0, x1] = hitboxX(a, h);
  const y0 = a.y + h.box.y0;
  const y1 = a.y + h.box.y1;
  const hw = def.hurt.halfWidth;
  if (x1 < t.x - hw || x0 > t.x + hw) return false;
  if (y1 < t.y || y0 > t.y + hurtHeight(t)) return false;
  const zr = h.zRange ?? COMBAT.defaultZRange;
  return Math.abs(a.z - t.z) <= zr + def.hurt.zRadius;
}

/** Collect every connecting hit this frame, then apply them (so trades resolve fairly). */
export function resolveCombat(w: World): void {
  pending.length = 0;
  hitThisFrame.clear();
  for (const a of w.fighters) {
    if (!a.stepped || a.state !== 'attack' || !a.move) continue;
    const md = getMove(a.move.id);
    for (let hi = 0; hi < md.hits.length; hi++) {
      if (!hitActive(a, hi)) continue;
      const h = md.hits[hi]!;
      for (const t of w.fighters) {
        if (t.team === a.team || t === a) continue;
        if (!isHittable(t)) continue;
        if (h.groundOnly && t.y > 0.05) continue;
        const key = hi * 100000 + t.id;
        if (a.move.hitIds.includes(key)) continue;
        if (!hitConnects(a, h, t)) continue;
        pending.push({ attacker: a, target: t, hit: h, key, move: a.move, weaponMove: !!md.weapon && !!a.weapon });
      }
    }
  }
  for (const p of pending) {
    const a = p.attacker;
    p.move.hitIds.push(p.key);
    // One hit per target per frame keeps multi-attacker frames readable.
    if (hitThisFrame.has(p.target.id)) continue;
    hitThisFrame.add(p.target.id);
    p.move.connected = true;
    applyHit(
      w,
      {
        id: a.id,
        x: a.x,
        z: a.z,
        facing: a.facing,
        team: a.team,
        fighter: a,
        player: a.player,
        weaponMove: p.weaponMove,
      },
      p.target,
      p.hit,
      a.y,
    );
  }
}

/** Send a fighter flying. */
export function launch(w: World, t: Fighter, dir: Facing, lx: number, ly: number): void {
  const def = getFighterDef(t.def);
  setState(t, 'launched');
  t.hitType = 'knockdown';
  t.vx = (dir * lx) / def.weight;
  t.vy = ly / Math.sqrt(def.weight);
  t.vz = 0;
  t.y = Math.max(t.y, 0.01);
  t.bounces = 0;
  t.facing = dir === 1 ? -1 : 1;
  setAnim(t, 'knockdown', null, launchAirtime(t.vy), true);
  if (t.weapon) dropWeapon(w, t, dir);
  if (t.ai) {
    releaseToken(w, t);
    t.ai.followUp = null;
    t.ai.wantChain = false;
  }
}

function stun(t: Fighter, dir: Facing, h: HitDef): void {
  const def = getFighterDef(t.def);
  const type: HitType = h.type === 'heavy' ? 'heavy' : 'light';
  const base = h.hitstun ?? COMBAT.hitstun[type];
  const len = Math.max(4, Math.round(base * def.hitstunScale));
  setState(t, 'hitstun', len);
  t.hitType = type;
  t.vx = (dir * (h.push ?? 0.03)) / def.weight;
  t.vz = 0;
  t.facing = dir === 1 ? -1 : 1;
  setAnim(t, type === 'heavy' ? 'hit_heavy' : 'hit_light', null, len, true);
}

/**
 * Apply one hit: damage, hitstop, reaction (stun / launch / armour), feedback
 * events (sparks, shake, rumble, sound) and bookkeeping (score, durability).
 */
export function applyHit(w: World, src: HitSource, t: Fighter, h: HitDef, srcY = 0): void {
  const tdef = getFighterDef(t.def);
  const god = t.team === 0 && w.debug.god;
  const armor = armorLevel(t);
  let damage = h.damage;
  if (t.kind === 'boss' && armor !== 'none') damage = Math.max(1, Math.round(damage * COMBAT.bossArmorScale));
  if (god) damage = 0;
  t.hp = Math.max(0, t.hp - damage);
  t.lastAttacker = src.id;

  const hs = h.hitstop ?? COMBAT.hitstop[h.type];
  if (src.fighter) src.fighter.hitstop = Math.max(src.fighter.hitstop, hs);
  t.hitstop = Math.max(t.hitstop, hs + COMBAT.victimHitstopBonus);
  t.flash = t.hitstop + COMBAT.flashFrames;

  let dir: Facing = src.facing;
  if (h.radial) dir = t.x > src.x + 0.01 ? 1 : t.x < src.x - 0.01 ? -1 : src.facing;

  const dies = t.hp <= 0;
  const armored = !dies && (armor === 'full' || (armor === 'light' && h.type === 'light'));
  let knocked = false;
  if (god) {
    // God mode: no reaction at all.
  } else if (dies) {
    launch(w, t, dir, Math.max(h.launchX ?? 0, COMBAT.deathLaunchX), Math.max(h.launchY ?? 0, COMBAT.deathLaunchY));
    t.dying = true;
    knocked = true;
  } else if (armored) {
    // Super armour: flash and hitstop, no flinch.
  } else if (h.type === 'knockdown' || t.y > 0.05) {
    launch(w, t, dir, h.launchX ?? 0.1, h.launchY ?? 0.12);
    knocked = true;
  } else {
    stun(t, dir, h);
    if (t.ai) {
      releaseToken(w, t);
      const ai = tdef.ai;
      t.ai.reaction = ai ? ai.reaction : 0;
      t.ai.followUp = null;
      t.ai.wantChain = false;
    }
  }
  if (t.boss && !dies) t.boss.hitsSinceAction++;

  // Feedback
  const hurtH = hurtHeight(t);
  const hx = t.x - dir * tdef.hurt.halfWidth * 0.5;
  const midY = srcY + (h.box.y0 + h.box.y1) / 2;
  const hy = Math.min(t.y + hurtH - 0.15, Math.max(t.y + 0.3, midY));
  w.events.push({
    type: 'hit',
    attacker: src.id,
    target: t.id,
    x: hx,
    y: hy,
    z: t.z + 0.12,
    hitType: dies ? 'knockdown' : h.type,
    spark: h.spark ?? 'punch',
    damage,
    blocked: armored,
  });
  const shake = h.shake ?? (h.type === 'knockdown' ? 0.2 : 0);
  if (shake > 0 || dies) w.events.push({ type: 'shake', amount: Math.max(shake, dies ? 0.3 : 0), frames: 12 });

  // Attacker bookkeeping
  if (src.player >= 0) {
    const slot = w.players[src.player];
    if (slot) {
      slot.score += damage * COMBAT.scorePerDamage;
      slot.lastTargetId = t.id;
      slot.lastTargetTimer = COMBAT.lastTargetFrames;
      slot.comboCount = slot.comboTimer > 0 ? slot.comboCount + 1 : 1;
      slot.comboTimer = COMBAT.comboWindow;
      if (slot.comboCount > slot.maxCombo) slot.maxCombo = slot.comboCount;
      if (dies) {
        slot.score += tdef.score;
        slot.enemiesDefeated++;
        if (t.kind === 'boss') slot.score += SCORE.bossBonus;
      }
      const r = h.type === 'light' ? COMBAT.rumble.dealLight : COMBAT.rumble.dealHeavy;
      w.events.push({ type: 'rumble', player: slot.index, strong: r.strong, weak: r.weak, ms: r.ms });
    }
    if (src.weaponMove && src.fighter && src.fighter.weapon) {
      const f = src.fighter;
      f.weaponDurability--;
      if (f.weaponDurability <= 0) {
        const wtype = f.weapon!;
        f.weapon = null;
        f.weaponDurability = 0;
        w.events.push({ type: 'weaponBreak', id: f.id, weapon: wtype, x: f.x + f.facing * 0.6, y: 1.2, z: f.z });
      }
    }
  }
  // Victim bookkeeping
  if (t.player >= 0) {
    const slot = w.players[t.player];
    if (slot) {
      slot.damageTaken += damage;
      const r = knocked ? COMBAT.rumble.knockdown : COMBAT.rumble.take;
      w.events.push({ type: 'rumble', player: slot.index, strong: r.strong, weak: r.weak, ms: r.ms });
    }
  }

  if (dies) onDefeated(w, t);
}

/** Bookkeeping when a fighter's health reaches zero. */
function onDefeated(w: World, t: Fighter): void {
  const def = getFighterDef(t.def);
  if (t.kind === 'enemy' && def.dropOnDeath && chance(w, def.dropOnDeath.chance)) {
    spawnItem(w, def.dropOnDeath.type, t.x, t.z, { y: 1.0, vy: 0.08, vx: 0, lifetime: WEAPONS[def.dropOnDeath.type].groundLifetime });
  }
  if (t.kind === 'boss') {
    w.slowmo = COMBAT.bossDeathSlowmo;
    w.level.bossDefeated = true;
    w.events.push({ type: 'bossDefeated', id: t.id, def: t.def });
    w.events.push({ type: 'shake', amount: 0.8, frames: 30 });
    // The rest of the boss's entourage collapses with it.
    for (const o of w.fighters) {
      if (o.team === 1 && o !== t && !o.dying && o.hp > 0) {
        o.hp = 0;
        launch(w, o, o.x >= t.x ? 1 : -1, COMBAT.deathLaunchX, COMBAT.deathLaunchY);
        o.dying = true;
      }
    }
  }
}
