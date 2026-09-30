import { describe, it, expect } from 'vitest';
import { createWorld, step, viewHalfWidthAt, carryOver } from '../src/sim';
import type { World } from '../src/sim';
import { COMBAT } from '../src/data/tuning';
import { getFighterDef } from '../src/data/fighters';
import { getEnv } from '../src/data/level';
import { arena, enemy, N, player, place } from './helpers';

function attackersOn(w: World, targetId: number): number {
  let n = 0;
  for (const f of w.fighters) {
    if (f.team !== 1 || f.kind === 'boss') continue;
    if (f.ai && f.ai.hasToken && f.ai.targetId === targetId) n++;
  }
  return n;
}

describe('enemy AI', () => {
  it('never lets more than the token limit attack the same player', () => {
    const { w, p } = arena();
    w.debug.noAI = false;
    w.debug.god = true;
    w.camera.lockX = w.camera.x;
    const types = ['grunt', 'grunt', 'grunt', 'bladeRunner', 'acrobat', 'bruiser'];
    types.forEach((t, i) => enemy(w, t, 8 + (i % 3) * 3, -2 + i * 0.7));
    let maxAttackers = 0;
    let maxInAttack = 0;
    for (let i = 0; i < 3000; i++) {
      step(w, [N]);
      maxAttackers = Math.max(maxAttackers, attackersOn(w, p.id));
      const inAttack = w.fighters.filter((f) => f.team === 1 && f.state === 'attack').length;
      maxInAttack = Math.max(maxInAttack, inAttack);
    }
    expect(maxAttackers).toBeLessThanOrEqual(COMBAT.maxAttackersPerTarget);
    expect(maxAttackers).toBeGreaterThan(0);
    expect(maxInAttack).toBeLessThanOrEqual(COMBAT.maxAttackersPerTarget);
  });

  it('lines up on z before attacking', () => {
    const { w, p } = arena();
    w.debug.noAI = false;
    w.debug.god = true;
    w.camera.lockX = w.camera.x;
    const e = enemy(w, 'grunt', 12.5, 1.6);
    const tol = getFighterDef('grunt').ai!.alignTolerance;
    let started = false;
    for (let i = 0; i < 1500 && !started; i++) {
      step(w, [N]);
      if (e.state === 'attack' && e.move?.frame === 1) {
        started = true;
        expect(Math.abs(e.z - p.z)).toBeLessThanOrEqual(tol + 0.05);
      }
    }
    expect(started).toBe(true);
  });

  it('never starts an attack while off-screen', () => {
    const { w, p } = arena();
    w.debug.noAI = false;
    w.debug.god = true;
    const e = enemy(w, 'thrower', w.camera.x + viewHalfWidthAt(0) + 1.5, 0);
    e.ai!.mode = 'think';
    let offscreenAttack = false;
    for (let i = 0; i < 1200; i++) {
      step(w, [N]);
      if (e.state === 'attack' && e.move?.frame === 1) {
        if (Math.abs(e.x - w.camera.x) > viewHalfWidthAt(e.z)) offscreenAttack = true;
      }
    }
    expect(offscreenAttack).toBe(false);
    expect(p.hp).toBe(p.maxHp);
  });

  it('flanks on both sides of the player while waiting', () => {
    const { w, p } = arena();
    w.debug.noAI = false;
    w.debug.god = true;
    w.camera.lockX = w.camera.x;
    for (let i = 0; i < 5; i++) enemy(w, 'grunt', 14 + i * 0.4, -1 + i * 0.5);
    let bothSides = false;
    for (let i = 0; i < 900; i++) {
      step(w, [N]);
      const left = w.fighters.some((f) => f.team === 1 && f.x < p.x - 1);
      const right = w.fighters.some((f) => f.team === 1 && f.x > p.x + 1);
      if (left && right) bothSides = true;
    }
    expect(bothSides).toBe(true);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed and inputs', () => {
    const inputs = (i: number) => ({ x: (i % 90 < 60 ? 1 : 0) as 0 | 1, z: (i % 50 < 10 ? 1 : 0) as 0 | 1, attack: i % 7 === 0, jump: i % 97 === 0, run: false });
    const a = createWorld({ seed: 99 });
    const b = createWorld({ seed: 99 });
    for (let i = 0; i < 4000; i++) {
      step(a, [inputs(i)]);
      step(b, [inputs(i)]);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('camera and encounters', () => {
  it('locks on encounter, never scrolls backward, shows GO once cleared and hides it when the next fight starts', () => {
    const w = createWorld({ skipIntro: true, seed: 5 });
    const p = player(w);
    let lastCam = w.camera.x;
    let locked = false;
    let backwards = false;
    for (let i = 0; i < 400 && !locked; i++) {
      step(w, [{ x: 1, z: 0, attack: false, jump: false, run: false }]);
      if (w.camera.x < lastCam - 1e-9) backwards = true;
      lastCam = w.camera.x;
      if (w.level.active) locked = true;
    }
    expect(locked).toBe(true);
    expect(w.camera.lockX).not.toBeNull();
    // Kill everything the encounter spawns until it clears.
    let go = false;
    for (let i = 0; i < 5000 && !go; i++) {
      for (const f of w.fighters) if (f.team === 1 && f.state !== 'enter' && !f.dying) f.hp = Math.min(f.hp, 1);
      step(w, [{ x: 0, z: 0, attack: i % 2 === 0, jump: false, run: false }]);
      if (w.camera.x < lastCam - 1e-9) backwards = true;
      lastCam = w.camera.x;
      // Walk the player toward the nearest enemy.
      const e = w.fighters.find((f) => f.team === 1 && !f.dying);
      if (e) {
        place(p, e.x - 0.9 * Math.sign(e.x - p.x || 1), e.z);
        p.facing = e.x >= p.x ? 1 : -1;
      }
      if (w.events.some((ev) => ev.type === 'go')) go = true;
    }
    expect(go).toBe(true);
    expect(w.camera.lockX).toBeNull();
    expect(w.level.goTimer).toBeGreaterThan(0);
    expect(backwards).toBe(false);
    // The arrow goes away as soon as the next fight starts, even if its timer is still running.
    const next = getEnv(w.level.env).encounters[w.level.nextEncounter]!;
    place(p, next.trigger + 0.1, 0);
    step(w, [N]);
    expect(w.level.active).not.toBeNull();
    expect(w.level.goTimer).toBe(0);
  });

  it('heals partially when entering the next environment', () => {
    const w = createWorld({ skipIntro: true, seed: 5 });
    const p = player(w);
    w.level.nextEncounter = 99;
    p.hp = 20;
    p.x = 97;
    w.camera.x = 100 - viewHalfWidthAt(0.6, 1.25);
    for (let i = 0; i < 400 && w.level.env === 0; i++) step(w, [{ x: 1, z: 0, attack: false, jump: false, run: false }]);
    expect(w.level.env).toBe(1);
    expect(p.hp).toBe(70);
  });
});

describe('continues', () => {
  it('carry score, stats and total play time into the restarted environment', () => {
    const w = createWorld({ seed: 1 });
    for (let i = 0; i < 300; i++) step(w, [N]);
    w.players[0]!.score = 1234;
    const carry = carryOver(w);
    carry[0]!.continues++;
    const w2 = createWorld({ env: 0, carry, seed: 2 });
    expect(w2.players[0]!.score).toBe(1234);
    expect(w2.players[0]!.continues).toBe(1);
    expect(w2.players[0]!.frames).toBe(300);
    expect(w2.players[0]!.lives).toBe(3);
  });
});
