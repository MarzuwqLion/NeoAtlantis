import { describe, it, expect } from 'vitest';
import { step } from '../src/sim';
import type { World, Fighter } from '../src/sim';
import { getMove } from '../src/data/moves';
import { COMBAT, PLAYER_MOVEMENT } from '../src/data/tuning';
import { WEAPONS } from '../src/data/weapons';
import { spawnItem } from '../src/sim/items';
import { arena, enemy, input, N, run } from './helpers';

/** Mash attack every other frame and record the sequence of moves the player performs. */
function mash(w: World, p: Fighter, frames: number): string[] {
  const seq: string[] = [];
  for (let i = 0; i < frames; i++) {
    step(w, [input({ attack: i % 2 === 0 })]);
    // A move that started this step has executed exactly its frame 0.
    if (p.move && p.move.frame === 1 && p.hitstop === 0) seq.push(p.move.id);
  }
  return seq;
}

describe('attack combo chain', () => {
  it('chains jab, jab, body blow, finisher on hit and the finisher knocks down', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.85, 0);
    e.hp = 999;
    const seq = mash(w, p, 80);
    expect(seq.slice(0, 4)).toEqual(['jab_1', 'jab_2', 'body_blow', 'finisher']);
    expect(['launched', 'lying']).toContain(e.state);
  });

  it('does not advance the chain on a whiff', () => {
    const { w, p } = arena();
    const seq = mash(w, p, 60);
    expect(seq.length).toBeGreaterThan(1);
    expect(new Set(seq)).toEqual(new Set(['jab_1']));
  });

  it('buffers a press made up to inputBuffer frames before the chain window', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.85, 0);
    e.hp = 999;
    const chainFrom = getMove('jab_1').chain!.from;
    step(w, [input({ attack: true })]);
    step(w, [N]);
    // Wait out the hitstop, then press a few frames before the window opens.
    while (p.hitstop > 0 || (p.move && p.move.frame < chainFrom - 3)) step(w, [N]);
    expect(p.move!.id).toBe('jab_1');
    step(w, [input({ attack: true })]);
    step(w, [N]);
    for (let i = 0; i < 16 && p.move?.id === 'jab_1'; i++) step(w, [N]);
    expect(p.move?.id).toBe('jab_2');
  });

  it('drops a press older than the buffer window', () => {
    const { w, p } = arena();
    // Whiffing jab: press during startup, far before recovery ends.
    step(w, [input({ attack: true })]);
    step(w, [N]);
    step(w, [input({ attack: true })]); // frame 2 of jab_1 (total 13 frames)
    run(w, N, 14);
    expect(p.state).toBe('idle');
  });

  it('does not age the buffer during hitstop', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.85, 0);
    e.hp = 999;
    step(w, [input({ attack: true })]);
    step(w, [N]);
    while (p.hitstop === 0) step(w, [N]);
    // Press right at the start of the freeze: hitstop is longer than 0 but the press must survive.
    step(w, [input({ attack: true })]);
    run(w, N, COMBAT.hitstop.light + 8);
    expect(p.move?.id === 'jab_2' || w.players[0]!.comboCount >= 2).toBe(true);
  });
});

describe('movement options', () => {
  it('double-tap runs and attacking while running is a dash attack', () => {
    const { w, p } = arena();
    step(w, [input({ x: 1 })]);
    step(w, [N]);
    step(w, [input({ x: 1 })]);
    run(w, input({ x: 1 }), 5);
    expect(p.state).toBe('run');
    step(w, [input({ x: 1, attack: true })]);
    expect(p.move?.id).toBe('dash_attack');
  });

  it('holding the run button runs too', () => {
    const { w, p } = arena();
    run(w, input({ x: -1, run: true }), 4);
    expect(p.state).toBe('run');
    expect(p.vx).toBeLessThan(0);
  });

  it('commits to the jump arc and allows one air attack', () => {
    const { w, p } = arena();
    step(w, [input({ jump: true, x: 1 })]);
    run(w, N, PLAYER_MOVEMENT.jumpSquat + 1);
    expect(p.state).toBe('air');
    const vx = p.vx;
    run(w, input({ x: -1 }), 5);
    expect(p.vx).toBe(vx); // no air control
    step(w, [input({ attack: true })]);
    expect(p.move?.id).toBe('flying_kick');
    step(w, [N]);
    step(w, [input({ attack: true })]);
    expect(p.move?.id).toBe('flying_kick');
  });

  it('neutral jump attack is the downward kick', () => {
    const { w, p } = arena();
    step(w, [input({ jump: true })]);
    run(w, N, PLAYER_MOVEMENT.jumpSquat + 3);
    step(w, [input({ attack: true })]);
    expect(p.move?.id).toBe('jump_kick');
    run(w, N, 80);
    expect(p.y).toBe(0);
    expect(['idle', 'land']).toContain(p.state);
  });
});

describe('weapons', () => {
  it('picks up a weapon with attack, swings it, wears it out and breaks it', () => {
    const { w, p } = arena();
    spawnItem(w, 'khopesh', 10.2, 0);
    tapAttack(w);
    expect(p.move?.id).toBe('pickup');
    run(w, N, 20);
    expect(p.weapon).toBe('khopesh');
    expect(p.weaponDurability).toBe(WEAPONS.khopesh.durability);
    const e = enemy(w, 'bruiser', 11.2, 0);
    e.hp = 9999;
    p.weaponDurability = 2;
    let broke = false;
    for (let i = 0; i < 200 && !broke; i++) {
      step(w, [input({ attack: i % 2 === 0 })]);
      if (w.events.some((ev) => ev.type === 'weaponBreak')) broke = true;
      if (e.state === 'lying' || e.state === 'launched') {
        e.state = 'idle';
        e.x = p.x + 1.1 * p.facing;
      }
    }
    expect(broke).toBe(true);
    expect(p.weapon).toBeNull();
  });

  it('drops the held weapon when knocked down', () => {
    const { w, p } = arena();
    p.weapon = 'staff';
    p.weaponDurability = 5;
    const e = enemy(w, 'grunt', 11, 0);
    e.facing = -1;
    e.state = 'attack';
    e.move = { id: 'grunt_staff', frame: 0, hitIds: [], connected: false, chargeFrames: 0, chargeDone: false, aimX: 0, aimZ: 0, item: -1, evFrame: -1 };
    run(w, N, 30);
    expect(p.weapon).toBeNull();
    expect(w.items.some((it) => it.type === 'staff' && it.durability === 5)).toBe(true);
  });

  it('throws the jar as a projectile that breaks on impact', () => {
    const { w, p } = arena();
    p.weapon = 'jar';
    p.weaponDurability = 1;
    const e = enemy(w, 'grunt', 14, 0);
    tapAttack(w);
    expect(p.move?.id).toBe('jar_throw');
    let thrown = false;
    let shattered = false;
    for (let i = 0; i < 90; i++) {
      step(w, [N]);
      if (w.projectiles.some((pr) => pr.kind === 'jar')) thrown = true;
      if (w.events.some((ev) => ev.type === 'shatter')) shattered = true;
    }
    expect(thrown).toBe(true);
    expect(shattered).toBe(true);
    expect(p.weapon).toBeNull();
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

function tapAttack(w: World): void {
  step(w, [input({ attack: true })]);
}
