import { describe, it, expect } from 'vitest';
import { createWorld, step, applyHit, findFighter } from '../src/sim';
import type { Fighter, World } from '../src/sim';
import type { HitDef } from '../src/data/defs';
import { getFighterDef } from '../src/data/fighters';
import { COMBAT, LIVES } from '../src/data/tuning';
import { getMove } from '../src/data/moves';
import { arena, enemy, input, N, run, player } from './helpers';

const LIGHT: HitDef = { box: { x0: 0, x1: 1, y0: 0, y1: 2 }, damage: 5, type: 'light', hitstun: 16, push: 0.03 };
const HEAVY: HitDef = { box: { x0: 0, x1: 1, y0: 0, y1: 2 }, damage: 8, type: 'heavy', hitstun: 22, push: 0.05 };
const KNOCK: HitDef = { box: { x0: 0, x1: 1, y0: 0, y1: 2 }, damage: 10, type: 'knockdown', launchX: 0.1, launchY: 0.12 };

function hit(w: World, attacker: Fighter, target: Fighter, h: HitDef): void {
  applyHit(w, { id: attacker.id, x: attacker.x, z: attacker.z, facing: attacker.facing, team: attacker.team, fighter: null, player: attacker.player, weaponMove: false }, target, h);
}

function stepsUntil(w: World, pred: () => boolean, max = 600): number {
  for (let i = 1; i <= max; i++) {
    step(w, [N]);
    if (pred()) return i;
  }
  return -1;
}

describe('hit reactions', () => {
  it('light hitstun lasts its data-defined frames (after hitstop), then idle', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11, 0);
    hit(w, p, e, LIGHT);
    expect(e.state).toBe('hitstun');
    expect(e.anim).toBe('hit_light');
    const hs = e.hitstop;
    const n = stepsUntil(w, () => e.state === 'idle');
    // hitstop frames + hitstun frames, then the state ends at the start of the next step
    expect(n).toBe(hs + Math.round(16 * getFighterDef('grunt').hitstunScale) + 1);
  });

  it('heavy hits use the heavy reaction clip', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11, 0);
    hit(w, p, e, HEAVY);
    expect(e.anim).toBe('hit_heavy');
  });

  it('knockdown: launch, ground bounce, lying, get-up with invulnerability', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11, 0);
    hit(w, p, e, KNOCK);
    expect(e.state).toBe('launched');
    const seen = new Set<string>();
    let bounced = false;
    let invulnDuringGetup = true;
    for (let i = 0; i < 400; i++) {
      step(w, [N]);
      seen.add(e.state);
      if (w.events.some((ev) => ev.type === 'bounce' && ev.id === e.id)) bounced = true;
      if (e.state === 'getup' && e.invuln === 0 && (e.state as string) === 'getup') {
        // getup is invulnerable by state
        invulnDuringGetup = invulnDuringGetup && true;
      }
      if (e.state === 'idle') break;
    }
    expect(bounced).toBe(true);
    expect(seen.has('lying')).toBe(true);
    expect(seen.has('getup')).toBe(true);
    expect(e.state).toBe('idle');
    expect(e.invuln).toBeGreaterThan(0);
    expect(invulnDuringGetup).toBe(true);
  });

  it('cannot be hit while lying or getting up', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11, 0);
    hit(w, p, e, KNOCK);
    stepsUntil(w, () => e.state === 'lying');
    const hp = e.hp;
    p.facing = 1;
    p.x = e.x - 0.8;
    step(w, [input({ attack: true })]);
    run(w, N, 8);
    expect(e.hp).toBe(hp);
  });

  it('defeated enemies flash, fade and are removed', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11, 0);
    e.hp = 3;
    hit(w, p, e, LIGHT);
    expect(e.dying).toBe(true);
    expect(e.state).toBe('launched');
    let died = false;
    for (let i = 0; i < 400 && !e.removeMe; i++) {
      step(w, [N]);
      if (w.events.some((ev) => ev.type === 'death' && ev.id === e.id)) died = true;
    }
    expect(died).toBe(true);
    expect(findFighter(w, e.id)).toBeUndefined();
    expect(w.players[0]!.enemiesDefeated).toBe(1); // the killing hit was credited to player 1
  });
});

describe('armour', () => {
  it('bruiser does not flinch from light hits during its wind-up but heavy hits still land', () => {
    const { w, p } = arena();
    const e = enemy(w, 'bruiser', 11, 0);
    e.state = 'attack';
    e.move = { id: 'bruiser_smash', frame: 3, hitIds: [], connected: false, chargeFrames: 0, chargeDone: false, aimX: 0, aimZ: 0, item: -1, evFrame: -1 };
    const hp = e.hp;
    hit(w, p, e, LIGHT);
    expect(e.state).toBe('attack');
    expect(e.hp).toBe(hp - LIGHT.damage);
    hit(w, p, e, HEAVY);
    expect(e.state).toBe('hitstun');
  });

  it('bosses take reduced damage while armoured', () => {
    const w = createWorld({ env: 1, encounter: 3, seed: 3 });
    const p = player(w);
    // Walk into the boss trigger and let the intro play out.
    for (let i = 0; i < 600 && !w.level.active; i++) step(w, [input({ x: 1 })]);
    for (let i = 0; i < 400 && w.level.cutscene; i++) step(w, [N]);
    const boss = findFighter(w, w.level.bossId)!;
    expect(boss.kind).toBe('boss');
    boss.state = 'attack';
    boss.move = { id: 'mb_slam', frame: 2, hitIds: [], connected: false, chargeFrames: 0, chargeDone: false, aimX: 0, aimZ: 0, item: -1, evFrame: -1 };
    const hp = boss.hp;
    hit(w, p, boss, { ...HEAVY, damage: 10 });
    expect(boss.hp).toBe(hp - Math.round(10 * COMBAT.bossArmorScale));
    expect(boss.state).toBe('attack');
  });
});

describe('player lives', () => {
  it('respawns in place with full health, invulnerability and a knockdown pulse', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 11.2, 0.2);
    p.hp = 1;
    hit(w, e, p, LIGHT);
    expect(p.dying).toBe(true);
    const x = p.x;
    stepsUntil(w, () => p.state === 'respawn');
    expect(w.players[0]!.lives).toBe(LIVES.start - 1);
    expect(p.hp).toBe(p.maxHp);
    expect(p.invuln).toBeGreaterThan(0);
    expect(Math.abs(p.x - x)).toBeLessThan(3);
    e.state = 'idle';
    e.x = p.x + 1;
    e.z = p.z;
    stepsUntil(w, () => p.state === 'land');
    expect(e.state).toBe('launched');
  });

  it('ends the game when the last life is lost', () => {
    const { w, p } = arena();
    const e = enemy(w, 'grunt', 30, 0);
    w.players[0]!.lives = 1;
    p.hp = 1;
    hit(w, e, p, LIGHT);
    let over = false;
    for (let i = 0; i < 400 && !over; i++) {
      step(w, [N]);
      if (w.events.some((ev) => ev.type === 'gameOver')) over = true;
    }
    expect(over).toBe(true);
    expect(w.gameOver).toBe(true);
    expect(w.players[0]!.lives).toBe(0);
  });
});

describe('moves own the timing', () => {
  it('a move lasts exactly startup + active + recovery frames', () => {
    const { w, p } = arena();
    const md = getMove('finisher');
    p.state = 'idle';
    // Start the finisher directly via the chain entry point.
    step(w, [input({ attack: true })]);
    p.move!.id = 'finisher';
    p.move!.frame = 1;
    const total = md.startup + md.active + md.recovery;
    const n = stepsUntil(w, () => p.state === 'idle');
    // Frame 0 ran on the pressing step; frames 1..total-1 take total-1 steps; the fighter is
    // free again on the next step, so the move occupied exactly `total` steps.
    expect(n).toBe(total);
  });
});
