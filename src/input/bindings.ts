/**
 * Input bindings. Edit these objects to rebind (a rebinding menu only has to
 * write new arrays into them). Keyboard uses KeyboardEvent.code values;
 * gamepad uses the W3C "standard" mapping button indices.
 */

export interface KeyBindings {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  attack: string[];
  jump: string[];
  run: string[];
  start: string[];
  back: string[];
}

export interface PadBindings {
  attack: number[];
  jump: number[];
  run: number[];
  start: number[];
  back: number[];
  confirm: number[];
  up: number;
  down: number;
  left: number;
  right: number;
}

export const KEYBOARD: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  attack: ['KeyJ', 'KeyX'],
  jump: ['KeyK', 'KeyZ', 'Space'],
  run: ['KeyL', 'ShiftLeft', 'ShiftRight'],
  start: ['Enter', 'Escape', 'KeyP'],
  back: ['Escape', 'Backspace'],
};

/** Standard mapping: 0 A/Cross, 1 B/Circle, 2 X/Square, 3 Y/Triangle, 5 RB/R1, 9 Start, 12-15 d-pad. */
export const GAMEPAD: PadBindings = {
  attack: [2],
  jump: [0],
  run: [5],
  start: [9],
  back: [1],
  confirm: [0, 2],
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

export const STICK = {
  /** Radial deadzone on the left stick. */
  deadzone: 0.3,
  /** sin(22.5 deg): component threshold for 8-way quantisation. */
  octant: 0.383,
};
