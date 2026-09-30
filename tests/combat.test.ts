import { describe, it, expect } from 'vitest';
import { step, hitConnects } from '../src/sim';
import { getMove } from '../src/data/moves';
import { COMBAT } from '../src/data/tuning';
import { arena, enemy, input, N, run, place } from './helpers';

const jab = getMove('jab_1').hits[0]!;
const jumpKick = getMove('jump_kick').hits[0]!;

describe('hit detection (belt-space boxes)', () => {
  it('uses the attacker facing to mirror the hitbox', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11, 0);
    p.facing = 1;
    expect(hitConnects(p, jab, e)).toBe(true);
    p.facing = -1;
    expect(hitConnects(p, jab, e)).toBe(false);
    place(e, 9, 0);
    expect(hitConnects(p, jab, e)).toBe(true);
  });

  it('only connects inside the depth (z) tolerance', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.9, 0);
    p.facing = 1;
    const limit = COMBAT.defaultZRange + 0.15; // grunt zRadius
    e.z = limit - 0.02;
    expect(hitConnects(p, jab, e)).toBe(true);
    e.z = -(limit - 0.02);
    expect(hitConnects(p, jab, e)).toBe(true);
    e.z = limit + 0.05;
    expect(hitConnects(p, jab, e)).toBe(false);
  });

  it('respects reach and height', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 12.6, 0);
    p.facing = 1;
    expect(hitConnects(p, jab, e)).toBe(false); // out of reach
    place(e, 10.8, 0);
    p.y = 2.6; // jump kick far above the target's head
    expect(hitConnects(p, jumpKick, e)).toBe(false);
    p.y = 1.0;
    expect(hitConnects(p, jumpKick, e)).toBe(true);
  });

  it('is active only on the move\'s active frames and hits once per window', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.9, 0);
    e.hp = 999;
    const md = getMove('jab_1');
    step(w, [input({ attack: true })]); // move frame 0 executes this step
    const hitFrames: number[] = [];
    for (let i = 1; i < 30; i++) {
      const frameBefore = p.move?.frame ?? -1;
      step(w, [N]);
      if (w.events.some((ev) => ev.type === 'hit' && ev.attacker === p.id)) hitFrames.push(frameBefore);
    }
    expect(hitFrames).toEqual([md.startup]);
  });

  it('applies hitstop to attacker and victim', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.9, 0);
    e.hp = 999;
    step(w, [input({ attack: true })]);
    let hitStep = -1;
    for (let i = 0; i < 10 && hitStep < 0; i++) {
      step(w, [N]);
      if (w.events.some((ev) => ev.type === 'hit')) hitStep = i;
    }
    expect(hitStep).toBeGreaterThanOrEqual(0);
    const hs = COMBAT.hitstop.light;
    expect(p.hitstop).toBe(hs);
    expect(e.hitstop).toBe(hs + COMBAT.victimHitstopBonus);
    const frame = p.move!.frame;
    const ex = e.x;
    run(w, N, hs);
    // The attacker was frozen: its move advanced exactly once (the hit frame itself) before the freeze ended.
    expect(p.move!.frame).toBe(frame);
    expect(e.x).toBe(ex);
    step(w, [N]);
    expect(p.move!.frame).toBe(frame + 1);
  });

  it('resolves simultaneous hits as a trade', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.8, 0);
    e.hp = 999;
    p.facing = 1;
    e.facing = -1;
    // Hand-start both moves so their active frames coincide.
    w.debug.noAI = true;
    step(w, [input({ attack: true })]);
    e.state = 'attack';
    e.move = { id: 'jab_1', frame: 1, hitIds: [], connected: false, chargeFrames: 0, chargeDone: false, aimX: 0, aimZ: 0, item: -1, evFrame: -1 };
    run(w, N, 3);
    expect(p.hp).toBeLessThan(100);
    expect(e.hp).toBeLessThan(999);
  });

  it('ignores invulnerable targets', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 10.9, 0);
    e.invuln = 60;
    const hp = e.hp;
    step(w, [input({ attack: true })]);
    run(w, N, 12);
    expect(e.hp).toBe(hp);
    expect(p.move?.connected ?? false).toBe(false);
  });
});
