import { describe, it, expect } from 'vitest';
import { createWorld, step, carryOver } from '../src/sim';
import type { World } from '../src/sim';
import { ENVIRONMENTS } from '../src/data/level';
import { Bot } from '../src/debug/bot';

/**
 * Headless end-to-end run: the autoplay bot plays the whole level through the
 * same InputState interface a gamepad uses, taking continues if it runs out
 * of lives (continue restarts the current environment, as in the game).
 */
describe('full level (headless)', () => {
  it('can be played from the first environment to level clear', () => {
    let w: World = createWorld({ seed: 7 });
    const bot = new Bot();
    let continues = 0;
    let frames = 0;
    const envsSeen = new Set<number>();
    const bosses = new Set<string>();
    for (let i = 0; i < 60 * 60 * 45; i++) {
      step(w, [bot.decide(w, 0)]);
      frames++;
      envsSeen.add(w.level.env);
      for (const e of w.events) if (e.type === 'bossDefeated') bosses.add(e.def);
      if (w.gameOver) {
        continues++;
        const carry = carryOver(w);
        carry[0]!.continues++;
        w = createWorld({ env: w.level.env, carry, seed: 7 + continues });
        if (continues > 10) break;
      }
      if (w.level.complete) break;
    }
    expect(w.level.complete).toBe(true);
    expect(envsSeen.size).toBe(ENVIRONMENTS.length);
    expect([...bosses].sort()).toEqual(['apep', 'sobekhan']);
    // Target run length is 12-15 minutes for a person; the bot should land in the same ballpark.
    const minutes = frames / 3600;
    expect(minutes).toBeGreaterThan(6);
    expect(minutes).toBeLessThan(25);
  }, 300000);
});
