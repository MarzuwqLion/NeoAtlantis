/**
 * Enemy AI.
 *
 * - Attack tokens: at most COMBAT.maxAttackersPerTarget enemies may be
 *   committing to an attack on the same player; everyone else circles and
 *   flanks on both sides.
 * - Enemies line up on z before attacking, every attack has a telegraph
 *   (see moves.ts) and nobody starts an attack while off-screen.
 *
 * Brains only set intent (ai.mx / ai.mz / ai.wantMove); applyIntent turns it
 * into velocities and moves, so the same state machine drives players and AI.
 */
import type { Fighter, World } from './types';
import type { FighterDef } from '../data/defs';
import { getFighterDef } from '../data/fighters';
import { getMove } from '../data/moves';
import { getEnv } from '../data/level';
import { COMBAT } from '../data/tuning';
import { isAlive, releaseToken, setAnim, setState } from './fighter';
import { startMove } from './actions';
import { chance, randInt, randRange } from './rng';
import { clamp, sign, viewHalfWidthAt } from './view';
import { face, onScreen, pickTarget, targetOpen } from './aiUtil';
import { bossThink, bossTick } from './boss';

export { onScreen, pickTarget, targetOpen };

export function tokensHeld(w: World, targetId: number): number {
  let n = 0;
  for (const f of w.fighters) {
    if (f.removeMe || f.dying) continue;
    if (f.kind === 'boss' && f.state !== 'intro' && f.state !== 'dead') n++;
    else if (f.ai && f.ai.hasToken && f.ai.targetId === targetId) n++;
  }
  return n;
}

export function requestToken(w: World, f: Fighter, t: Fighter): boolean {
  const ai = f.ai!;
  if (ai.hasToken) return true;
  if (!onScreen(w, f, 0.6)) return false;
  if (tokensHeld(w, t.id) >= COMBAT.maxAttackersPerTarget) return false;
  ai.hasToken = true;
  ai.tokenFrames = 0;
  ai.targetId = t.id;
  ai.attacked = false;
  return true;
}

/** Steer toward a point; returns true when within tolerance. */
function steer(f: Fighter, tx: number, tz: number, speed: number, tolX = 0.2, tolZ = 0.1): boolean {
  const ai = f.ai!;
  const ex = tx - f.x;
  const ez = tz - f.z;
  ai.mx = Math.abs(ex) > tolX ? sign(ex) * speed * Math.min(1, Math.abs(ex) / 0.6 + 0.35) : 0;
  ai.mz = Math.abs(ez) > tolZ ? sign(ez) * speed * Math.min(1, Math.abs(ez) / 0.4 + 0.35) : 0;
  return ai.mx === 0 && ai.mz === 0;
}

/** Count enemies flanking each side of the target (for side balancing). */
function sideCounts(w: World, t: Fighter, self: Fighter): [number, number] {
  let left = 0;
  let right = 0;
  for (const f of w.fighters) {
    if (f === self || !f.ai || f.team !== 1 || !isAlive(f)) continue;
    if (f.x < t.x) left++;
    else right++;
  }
  return [left, right];
}

/** Wait for a token: hold a flanking position around the target and drift. */
function circle(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  const A = def.ai!;
  const env = getEnv(w.level.env);
  if (--ai.timer <= 0) {
    ai.timer = randInt(w, 70, 160);
    ai.circleDist = randRange(w, A.circle[0], A.circle[1]);
    ai.zOffset = randRange(w, -1.4, 1.4);
    const [l, r] = sideCounts(w, t, f);
    if (l + 1 < r) ai.side = -1;
    else if (r + 1 < l) ai.side = 1;
    else if (chance(w, 0.2)) ai.side = ai.side === 1 ? -1 : 1;
  }
  const hw = viewHalfWidthAt(f.z) - 0.9;
  let wantX = t.x + ai.side * ai.circleDist;
  const lo = w.camera.x - hw;
  const hi = w.camera.x + hw;
  if (wantX < lo || wantX > hi) {
    wantX = clamp(wantX, lo, hi);
    if (Math.abs(wantX - t.x) < 1.6) ai.side = ai.side === 1 ? -1 : 1;
  }
  const wantZ = clamp(t.z + ai.zOffset, env.zMin + 0.2, env.zMax - 0.2);
  steer(f, wantX, wantZ, A.circleSpeed, 0.35, 0.2);
}

/** Line up on z and close to within `range` of the target on our side. Returns true when ready. */
function lineUp(f: Fighter, def: FighterDef, t: Fighter, range: [number, number], zTol = def.ai!.alignTolerance): boolean {
  const ai = f.ai!;
  const A = def.ai!;
  const dx = t.x - f.x;
  const dz = t.z - f.z;
  const adx = Math.abs(dx);
  const side = f.x < t.x ? -1 : 1;
  const mid = (range[0] + range[1]) / 2;
  const wantX = t.x + side * mid;
  const aligned = Math.abs(dz) <= zTol;
  ai.mz = aligned ? 0 : sign(dz) * A.approachSpeed * Math.min(1, Math.abs(dz) / 0.35 + 0.4);
  if (adx < range[0]) ai.mx = -sign(dx) * 0.85;
  else if (adx > range[1]) ai.mx = sign(wantX - f.x) * A.approachSpeed * (aligned ? 1 : 0.6);
  else ai.mx = 0;
  return aligned && adx >= range[0] && adx <= range[1];
}

function tryToken(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  const A = def.ai!;
  if (ai.cooldown > 0) return;
  if (--ai.retry > 0) return;
  ai.retry = randInt(w, A.tokenRetry[0], A.tokenRetry[1]);
  if (chance(w, A.aggression)) requestToken(w, f, t);
}

// ---------------------------------------------------------------------------
// Brains
// ---------------------------------------------------------------------------

function gruntBrain(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  face(f, t.x - f.x);
  if (!ai.hasToken) {
    circle(w, f, def, t);
    tryToken(w, f, def, t);
    return;
  }
  const range: [number, number] = f.weapon === 'staff' ? [1.0, 1.8] : f.weapon === 'khopesh' ? [0.6, 1.25] : def.ai!.attackRange;
  if (lineUp(f, def, t, range) && targetOpen(t) && onScreen(w, f, 0.4)) {
    ai.wantMove = f.weapon ? (def.moves[f.weapon] ?? def.moves.attack!) : def.moves.attack!;
    ai.wantChain = true;
  }
}

function bladeRunnerBrain(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  face(f, t.x - f.x);
  if (!ai.hasToken) {
    circle(w, f, def, t);
    // Blade runners strafe more: refresh their lane offset often.
    if (ai.timer > 60) ai.timer = randInt(w, 30, 60);
    tryToken(w, f, def, t);
    return;
  }
  if (lineUp(f, def, t, def.ai!.attackRange) && targetOpen(t) && onScreen(w, f, 0.8)) {
    ai.wantMove = f.weapon ? def.moves.dash! : def.moves.dashUnarmed!;
    ai.followUp = def.moves.retreat!;
  }
}

function bruiserBrain(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  face(f, t.x - f.x);
  if (!ai.hasToken) {
    circle(w, f, def, t);
    tryToken(w, f, def, t);
    return;
  }
  const adx = Math.abs(t.x - f.x);
  const aligned = Math.abs(t.z - f.z) <= def.ai!.alignTolerance;
  if (adx > 3.6) {
    // Line up for the charge from where we stand.
    ai.mz = aligned ? 0 : sign(t.z - f.z) * 0.9;
    ai.mx = 0;
    if (aligned && targetOpen(t) && onScreen(w, f, 1.0)) ai.wantMove = def.moves.charge!;
    return;
  }
  if (lineUp(f, def, t, def.ai!.attackRange) && targetOpen(t) && onScreen(w, f, 0.5)) {
    ai.wantMove = def.moves.smash!;
  }
}

function throwerBrain(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  const A = def.ai!;
  const env = getEnv(w.level.env);
  const dx = t.x - f.x;
  const adx = Math.abs(dx);
  face(f, dx);
  const hw = viewHalfWidthAt(f.z) - 0.9;
  const lo = w.camera.x - hw;
  const hi = w.camera.x + hw;

  // Weak up close: shove if cornered, otherwise back away.
  if (adx < 1.25 && targetOpen(t)) {
    const cornered = f.x <= lo + 0.4 || f.x >= hi - 0.4;
    if (cornered || chance(w, 0.02)) {
      if (requestToken(w, f, t) && Math.abs(t.z - f.z) < 0.4) {
        ai.wantMove = def.moves.shove!;
        return;
      }
    }
  }
  // Hang at the far edge: stay on our side of the target at long range.
  let side = f.x >= t.x ? 1 : -1;
  let wantX = t.x + side * ai.circleDist;
  if (wantX < lo || wantX > hi) {
    const other = t.x - side * ai.circleDist;
    if (other >= lo && other <= hi) {
      side = -side;
      wantX = other;
    } else {
      wantX = clamp(wantX, lo, hi);
    }
  }
  const lane = ai.hasToken ? t.z : clamp(t.z + ai.zOffset * 0.6, env.zMin + 0.2, env.zMax - 0.2);
  const arrived = steer(f, wantX, lane, adx < 2.8 ? 1.15 : A.circleSpeed, 0.5, ai.hasToken ? A.alignTolerance * 0.8 : 0.25);

  if (!ai.hasToken) {
    if (--ai.timer <= 0) {
      ai.timer = randInt(w, 80, 160);
      ai.zOffset = randRange(w, -1.2, 1.2);
      ai.circleDist = randRange(w, A.circle[0], A.circle[1]);
    }
    tryToken(w, f, def, t);
    return;
  }
  const aligned = Math.abs(t.z - f.z) <= A.alignTolerance;
  if (aligned && adx >= A.attackRange[0] && adx <= A.attackRange[1] && targetOpen(t) && onScreen(w, f, 0.6) && (arrived || adx > 3.4)) {
    ai.aimX = t.x;
    ai.aimZ = t.z;
    ai.wantMove = def.moves.lob!;
  }
}

function acrobatBrain(w: World, f: Fighter, def: FighterDef, t: Fighter): void {
  const ai = f.ai!;
  face(f, t.x - f.x);
  if (!ai.hasToken) {
    circle(w, f, def, t);
    tryToken(w, f, def, t);
    return;
  }
  const adx = Math.abs(t.x - f.x);
  const aligned = Math.abs(t.z - f.z) <= def.ai!.alignTolerance;
  if (adx < 1.3 && aligned && targetOpen(t) && onScreen(w, f, 0.4)) {
    ai.wantMove = def.moves.kick!;
    return;
  }
  if (lineUp(f, def, t, def.ai!.attackRange) && targetOpen(t) && onScreen(w, f, 0.8)) {
    ai.wantMove = def.moves.slide!;
    ai.followUp = def.moves.flip!;
  }
}

// ---------------------------------------------------------------------------

/** Entry walk from off-screen or out of a doorway. */
function updateEntry(f: Fighter, def: FighterDef): void {
  const ai = f.ai!;
  const ex = ai.enterX - f.x;
  const ez = ai.enterZ - f.z;
  const d = Math.hypot(ex, ez);
  if (d < 0.12) {
    setState(f, 'idle');
    setAnim(f, 'idle');
    f.vx = 0;
    f.vz = 0;
    ai.mode = 'think';
    return;
  }
  const sp = def.walk * 1.1;
  f.vx = (ex / d) * sp;
  f.vz = (ez / d) * Math.max(def.walkZ * 1.1, sp * 0.6);
  if (Math.abs(ex) > 0.05) f.facing = ex > 0 ? 1 : -1;
  setAnim(f, 'walk');
}

/** Run the brain for one enemy / boss. Sets intent only. */
export function aiThink(w: World, f: Fighter): void {
  const ai = f.ai!;
  const def = getFighterDef(f.def);
  ai.mx = 0;
  ai.mz = 0;
  ai.speedMul = 1;
  ai.wantMove = null;

  if (f.state === 'enter') {
    updateEntry(f, def);
    return;
  }
  if (ai.mode === 'enter') {
    if (f.state === 'idle' && f.y === 0) ai.mode = 'think';
    else return;
  }
  if (w.debug.noAI || w.level.cutscene || w.level.transition) return;
  if (ai.cooldown > 0) ai.cooldown--;

  const t = pickTarget(w, f);
  if (ai.hasToken) {
    ai.tokenFrames++;
    const timeout = def.ai ? def.ai.tokenTimeout : 0;
    if (!t || (timeout > 0 && ai.tokenFrames > timeout && !ai.attacked) || (t && ai.targetId !== t.id)) releaseToken(w, f);
  }
  if (!t) return;
  if (f.boss) {
    bossTick(w, f);
    ai.attacked = false;
  }
  if (f.state !== 'idle' && f.state !== 'walk') return;

  // Token is returned once the committed attack (and any follow-up) is over.
  if (ai.attacked && !ai.followUp) {
    releaseToken(w, f);
    ai.mode = 'backoff';
    ai.timer = randInt(w, 18, 36);
  }
  if (ai.followUp) return;
  if (ai.reaction > 0) {
    ai.reaction--;
    face(f, t.x - f.x);
    return;
  }
  if (ai.mode === 'backoff') {
    face(f, t.x - f.x);
    ai.mx = -sign(t.x - f.x) * 0.6;
    if (--ai.timer <= 0) ai.mode = 'think';
    return;
  }

  if (f.boss) {
    bossThink(w, f, def, t);
    return;
  }
  switch (def.ai?.brain) {
    case 'grunt':
      gruntBrain(w, f, def, t);
      break;
    case 'bladeRunner':
      bladeRunnerBrain(w, f, def, t);
      break;
    case 'bruiser':
      bruiserBrain(w, f, def, t);
      break;
    case 'thrower':
      throwerBrain(w, f, def, t);
      break;
    case 'acrobat':
      acrobatBrain(w, f, def, t);
      break;
    default:
      break;
  }
}

/** Turn intent into motion / moves using the shared state machine. */
export function applyIntent(w: World, f: Fighter): void {
  const ai = f.ai!;
  const def = getFighterDef(f.def);
  if (f.state === 'attack' && f.move) {
    const md = getMove(f.move.id);
    if (ai.wantChain && md.chain && f.move.frame >= md.chain.from && (f.move.connected || !md.chain.requireHit)) {
      startMove(w, f, md.chain.next, ai.aimX, ai.aimZ);
    }
    return;
  }
  if (f.state !== 'idle' && f.state !== 'walk') return;
  if (ai.followUp) {
    const next = ai.followUp;
    ai.followUp = null;
    const t = pickTarget(w, f);
    if (t) face(f, t.x - f.x);
    ai.wantChain = false;
    startMove(w, f, next, ai.aimX, ai.aimZ);
    return;
  }
  if (ai.wantMove) {
    const id = ai.wantMove;
    ai.wantMove = null;
    ai.wantChain = ai.wantChain && !!getMove(id).chain;
    startMove(w, f, id, ai.aimX, ai.aimZ);
    return;
  }
  ai.wantChain = false;
  const vx = ai.mx * def.walk * ai.speedMul;
  const vz = ai.mz * def.walkZ * ai.speedMul;
  f.vx = vx;
  f.vz = vz;
  if (Math.abs(vx) + Math.abs(vz) > 1e-4) {
    if (f.state !== 'walk') setState(f, 'walk');
    setAnim(f, 'walk');
  } else {
    if (f.state !== 'idle') setState(f, 'idle');
    setAnim(f, 'idle');
  }
}
