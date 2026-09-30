/**
 * Player controller: turns a per-player InputState into actions. Presses are
 * buffered for COMBAT.inputBuffer frames so combos don't drop; the buffer only
 * ages on frames the fighter actually steps (not during hitstop).
 */
import type { Fighter, InputState, PlayerSlot, World } from './types';
import { getFighterDef } from '../data/fighters';
import { getMove } from '../data/moves';
import { WEAPONS } from '../data/weapons';
import { COMBAT, PLAYER_MOVEMENT } from '../data/tuning';
import { setAnim, setState } from './fighter';
import { findPickup } from './items';
import { startJump, startMove } from './actions';

export function createPlayerSlot(index: number, fighterId: number, name: string, lives: number): PlayerSlot {
  return {
    index,
    fighterId,
    name,
    lives,
    score: 0,
    prevInput: { x: 0, z: 0, attack: false, jump: false, run: false },
    bufAttack: -1,
    bufJump: -1,
    tapDir: 0,
    tapFrame: -999,
    runLatched: false,
    lastTargetId: -1,
    lastTargetTimer: 0,
    damageTaken: 0,
    enemiesDefeated: 0,
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 0,
    continues: 0,
    frames: 0,
  };
}

/** Edge detection, buffering and double-tap tracking. Runs every frame, even during hitstop. */
export function recordInput(w: World, slot: PlayerSlot, input: InputState): void {
  const prev = slot.prevInput;
  if (input.attack && !prev.attack) slot.bufAttack = 0;
  if (input.jump && !prev.jump) slot.bufJump = 0;
  if (input.x !== 0 && input.x !== prev.x) {
    if (input.x === slot.tapDir && w.frame - slot.tapFrame <= PLAYER_MOVEMENT.doubleTapWindow) slot.runLatched = true;
    slot.tapDir = input.x;
    slot.tapFrame = w.frame;
  }
  if (input.x !== slot.tapDir) slot.runLatched = false;
  prev.x = input.x;
  prev.z = input.z;
  prev.attack = input.attack;
  prev.jump = input.jump;
  prev.run = input.run;
}

/** Age buffered presses (called once per frame the fighter stepped). */
export function ageBuffers(slot: PlayerSlot): void {
  if (slot.bufAttack >= 0 && ++slot.bufAttack > COMBAT.inputBuffer) slot.bufAttack = -1;
  if (slot.bufJump >= 0 && ++slot.bufJump > COMBAT.inputBuffer) slot.bufJump = -1;
  if (slot.lastTargetTimer > 0) slot.lastTargetTimer--;
  if (slot.comboTimer > 0) slot.comboTimer--;
}

function takeAttack(slot: PlayerSlot): boolean {
  if (slot.bufAttack >= 0 && slot.bufAttack <= COMBAT.inputBuffer) {
    slot.bufAttack = -1;
    return true;
  }
  return false;
}

function hasAttack(slot: PlayerSlot): boolean {
  return slot.bufAttack >= 0 && slot.bufAttack <= COMBAT.inputBuffer;
}

function takeJump(slot: PlayerSlot): boolean {
  if (slot.bufJump >= 0 && slot.bufJump <= COMBAT.inputBuffer) {
    slot.bufJump = -1;
    return true;
  }
  return false;
}

/** Decide what the player's fighter does this frame. */
export function playerControl(w: World, slot: PlayerSlot, f: Fighter, input: InputState): void {
  const def = getFighterDef(f.def);
  switch (f.state) {
    case 'idle':
    case 'walk':
    case 'run': {
      const running = input.x !== 0 && (input.run || slot.runLatched);
      if (takeJump(slot)) {
        startJump(f, input.x, input.z, running && f.state === 'run');
        return;
      }
      if (takeAttack(slot)) {
        if (f.state === 'run') {
          startMove(w, f, def.moves.dash!);
          return;
        }
        if (f.weapon) {
          startMove(w, f, WEAPONS[f.weapon].move);
          return;
        }
        const item = findPickup(w, f);
        if (item) {
          startMove(w, f, def.moves.pickup!, f.x, f.z, item.id);
          return;
        }
        startMove(w, f, def.moves.jab!);
        return;
      }
      if (input.x !== 0) f.facing = input.x;
      if (running) {
        f.vx = input.x * def.run;
        f.vz = input.z * def.walkZ * 0.85;
        if (f.state !== 'run') setState(f, 'run');
        setAnim(f, 'run');
      } else if (input.x !== 0 || input.z !== 0) {
        f.vx = input.x * def.walk;
        f.vz = input.z * def.walkZ;
        if (f.state !== 'walk') setState(f, 'walk');
        setAnim(f, 'walk');
      } else {
        f.vx = 0;
        f.vz = 0;
        if (f.state !== 'idle') setState(f, 'idle');
        setAnim(f, 'idle');
      }
      return;
    }
    case 'attack': {
      const m = f.move!;
      const md = getMove(m.id);
      if (md.chain && m.frame >= md.chain.from && (m.connected || !md.chain.requireHit) && hasAttack(slot)) {
        takeAttack(slot);
        startMove(w, f, md.chain.next);
      }
      return;
    }
    case 'air': {
      if (!f.airAttackUsed && takeAttack(slot)) {
        f.airAttackUsed = true;
        startMove(w, f, f.jumpDir ? def.moves.jumpDir! : def.moves.jumpNeutral!);
      }
      return;
    }
    default:
      return;
  }
}
