import { createWorld, step, spawnEnemy } from '../src/sim';
import type { Fighter, InputState, World } from '../src/sim';

export const N: InputState = { x: 0, z: 0, attack: false, jump: false, run: false };

export function input(p: Partial<InputState>): InputState {
  return { ...N, ...p };
}

/** A quiet arena: no intro, AI disabled, player at (10, 0). */
export function arena(): { w: World; p: Fighter } {
  const w = createWorld({ skipIntro: true, seed: 1 });
  w.debug.noAI = true;
  const p = player(w);
  place(p, 10, 0);
  w.camera.x = 11;
  w.camera.px = 11;
  return { w, p };
}

export function player(w: World, i = 0): Fighter {
  const id = w.players[i]!.fighterId;
  return w.fighters.find((f) => f.id === id)!;
}

export function place(f: Fighter, x: number, z: number): void {
  f.x = f.px = x;
  f.z = f.pz = z;
  f.y = f.py = 0;
  f.vx = f.vy = f.vz = 0;
}

/** Spawn an enemy standing still at (x, z). */
export function enemy(w: World, type: string, x: number, z: number): Fighter {
  const f = spawnEnemy(w, type, 'right', 0, 0, w.camera.x);
  place(f, x, z);
  f.state = 'idle';
  f.stateFrame = 0;
  f.anim = 'idle';
  f.ai!.mode = 'think';
  f.facing = -1;
  return f;
}

export function run(w: World, inputs: InputState | ((frame: number) => InputState), frames: number): void {
  for (let i = 0; i < frames; i++) {
    const inp = typeof inputs === 'function' ? inputs(i) : inputs;
    step(w, [inp]);
  }
}

/** Press attack once (one frame down, then released). */
export function tap(w: World, p: Partial<InputState> = {}): void {
  step(w, [input({ ...p, attack: true })]);
  step(w, [input(p)]);
}

export function hitEvents(w: World): { attacker: number; target: number; type: string }[] {
  return w.events.filter((e) => e.type === 'hit').map((e) => (e.type === 'hit' ? { attacker: e.attacker, target: e.target, type: e.hitType } : { attacker: 0, target: 0, type: '' }));
}
