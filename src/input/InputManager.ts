/**
 * Collects keyboard and gamepad state and produces per-player InputState for
 * the simulation, plus edge-detected menu input for the UI. Gamepads are
 * assigned to player slots when a button is pressed on them (browsers only
 * expose a pad after a button press), and survive hot-plugging.
 */
import type { InputState } from '../sim/types';
import { GAMEPAD, KEYBOARD, STICK } from './bindings';

export interface MenuInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  start: boolean;
  any: boolean;
}

interface PadState {
  index: number;
  id: string;
  buttons: boolean[];
  prev: boolean[];
  axes: number[];
  prevDir: { x: number; y: number };
}

/** Anything that can drive a player slot (used by the autoplay bot / tests). */
export type InputOverride = () => InputState;

export class InputManager {
  private readonly keys = new Set<string>();
  /** Keys pressed since the last sample (so very short taps are never lost). */
  private readonly latched = new Set<string>();
  private readonly menuLatched = new Set<string>();
  private readonly pads = new Map<number, PadState>();
  /** Player slot -> gamepad index. */
  private readonly padForPlayer: (number | null)[] = [null, null, null, null];
  private readonly overrides: (InputOverride | null)[] = [null, null, null, null];
  private readonly listeners: (() => void)[] = [];
  onPadChange: ((connected: boolean, id: string) => void) | null = null;
  lastDevice: 'keyboard' | 'gamepad' = 'keyboard';
  private anyLatched = false;

  constructor(target: Window = window) {
    const down = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.latched.add(e.code);
      this.menuLatched.add(e.code);
      this.anyLatched = true;
      this.lastDevice = 'keyboard';
      if (this.isGameKey(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
    const blur = (): void => this.keys.clear();
    const padOn = (e: GamepadEvent): void => {
      this.onPadChange?.(true, e.gamepad.id);
    };
    const padOff = (e: GamepadEvent): void => {
      this.pads.delete(e.gamepad.index);
      for (let i = 0; i < this.padForPlayer.length; i++) if (this.padForPlayer[i] === e.gamepad.index) this.padForPlayer[i] = null;
      this.onPadChange?.(false, e.gamepad.id);
    };
    const mouse = (): void => {
      this.anyLatched = true;
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    target.addEventListener('gamepadconnected', padOn as EventListener);
    target.addEventListener('gamepaddisconnected', padOff as EventListener);
    target.addEventListener('pointerdown', mouse);
    this.listeners.push(() => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
      target.removeEventListener('gamepadconnected', padOn as EventListener);
      target.removeEventListener('gamepaddisconnected', padOff as EventListener);
      target.removeEventListener('pointerdown', mouse);
    });
  }

  private isGameKey(code: string): boolean {
    const k = KEYBOARD;
    return [k.left, k.right, k.up, k.down, k.attack, k.jump, k.run].some((l) => l.includes(code)) || code === 'Space';
  }

  dispose(): void {
    for (const l of this.listeners) l();
  }

  setOverride(player: number, fn: InputOverride | null): void {
    this.overrides[player] = fn;
  }

  hasOverride(player: number): boolean {
    return !!this.overrides[player];
  }

  /** Poll gamepads once per rendered frame. */
  poll(): void {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      let st = this.pads.get(gp.index);
      if (!st) {
        st = { index: gp.index, id: gp.id, buttons: [], prev: [], axes: [], prevDir: { x: 0, y: 0 } };
        this.pads.set(gp.index, st);
      }
      st.prev = st.buttons;
      st.buttons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      st.axes = [...gp.axes];
      const pressedNow = st.buttons.some((b, i) => b && !st!.prev[i]);
      const dir = this.padDir(st);
      if (pressedNow || ((dir.x !== 0 || dir.y !== 0) && st.prevDir.x === 0 && st.prevDir.y === 0)) {
        this.anyLatched = true;
        this.lastDevice = 'gamepad';
        if (pressedNow && !this.padForPlayer.includes(gp.index)) {
          const free = this.padForPlayer.indexOf(null);
          if (free >= 0) this.padForPlayer[free] = gp.index;
        }
      }
    }
  }

  /** Name of the gamepad assigned to a player (or null). */
  padName(player: number): string | null {
    const idx = this.padForPlayer[player];
    if (idx === null || idx === undefined) return null;
    return this.pads.get(idx)?.id ?? null;
  }

  private padDir(st: PadState): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
    let x: -1 | 0 | 1 = 0;
    let y: -1 | 0 | 1 = 0;
    const ax = st.axes[0] ?? 0;
    const ay = st.axes[1] ?? 0;
    const mag = Math.hypot(ax, ay);
    if (mag > STICK.deadzone) {
      const nx = ax / mag;
      const ny = ay / mag;
      x = nx > STICK.octant ? 1 : nx < -STICK.octant ? -1 : 0;
      y = ny > STICK.octant ? 1 : ny < -STICK.octant ? -1 : 0;
    }
    const b = st.buttons;
    if (b[GAMEPAD.left]) x = -1;
    if (b[GAMEPAD.right]) x = 1;
    if (b[GAMEPAD.up]) y = -1;
    if (b[GAMEPAD.down]) y = 1;
    return { x, y };
  }

  private keyHeld(codes: string[], latched: boolean): boolean {
    for (const c of codes) if (this.keys.has(c) || (latched && this.latched.has(c))) return true;
    return false;
  }

  /** InputState for a player slot. Player 0 also reads the keyboard. */
  sample(player: number): InputState {
    const ov = this.overrides[player];
    if (ov) return ov();
    let x = 0;
    let z = 0;
    let attack = false;
    let jump = false;
    let run = false;
    if (player === 0) {
      const K = KEYBOARD;
      if (this.keyHeld(K.left, false)) x -= 1;
      if (this.keyHeld(K.right, false)) x += 1;
      if (this.keyHeld(K.up, false)) z -= 1;
      if (this.keyHeld(K.down, false)) z += 1;
      attack = this.keyHeld(K.attack, true);
      jump = this.keyHeld(K.jump, true);
      run = this.keyHeld(K.run, false);
    }
    const pi = this.padForPlayer[player];
    const st = pi !== null && pi !== undefined ? this.pads.get(pi) : undefined;
    if (st) {
      const d = this.padDir(st);
      if (d.x !== 0) x = d.x;
      if (d.y !== 0) z = d.y;
      const b = st.buttons;
      attack = attack || GAMEPAD.attack.some((i) => b[i]);
      jump = jump || GAMEPAD.jump.some((i) => b[i]);
      run = run || GAMEPAD.run.some((i) => b[i]);
    }
    this.latched.clear();
    return { x: Math.sign(x) as -1 | 0 | 1, z: Math.sign(z) as -1 | 0 | 1, attack, jump, run };
  }

  /** True once when any key / button / click happened since the last call. */
  consumeAny(): boolean {
    const a = this.anyLatched;
    this.anyLatched = false;
    return a;
  }

  /** Edge-detected menu navigation from every device. Call once per frame. */
  menu(): MenuInput {
    const m: MenuInput = { up: false, down: false, left: false, right: false, confirm: false, back: false, start: false, any: false };
    const K = KEYBOARD;
    const hit = (codes: string[]): boolean => codes.some((c) => this.menuLatched.has(c));
    m.up = hit(K.up);
    m.down = hit(K.down);
    m.left = hit(K.left);
    m.right = hit(K.right);
    m.confirm = hit(['Enter', 'Space', ...K.attack, ...K.jump]);
    m.back = hit(K.back);
    m.start = hit(['Enter', 'Escape', 'KeyP']);
    m.any = this.menuLatched.size > 0;
    this.menuLatched.clear();
    for (const st of this.pads.values()) {
      const b = st.buttons;
      const edge = (i: number): boolean => !!b[i] && !st.prev[i];
      const d = this.padDir(st);
      const pd = st.prevDir;
      if (d.y === -1 && pd.y !== -1) m.up = true;
      if (d.y === 1 && pd.y !== 1) m.down = true;
      if (d.x === -1 && pd.x !== -1) m.left = true;
      if (d.x === 1 && pd.x !== 1) m.right = true;
      if (GAMEPAD.confirm.some(edge)) m.confirm = true;
      if (GAMEPAD.back.some(edge)) m.back = true;
      if (GAMEPAD.start.some(edge)) m.start = true;
      if (b.some((v, i) => v && !st.prev[i])) m.any = true;
      st.prevDir = { x: d.x, y: d.y };
    }
    return m;
  }

  /** Gamepad rumble where supported (Chrome: dual-rumble effect). */
  rumble(player: number, strong: number, weak: number, ms: number): void {
    const pi = this.padForPlayer[player];
    if (pi === null || pi === undefined) return;
    const gp = navigator.getGamepads?.()[pi];
    const act = (gp as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null)?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => undefined);
    }
  }
}
