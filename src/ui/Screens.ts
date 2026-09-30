/**
 * Menu screens (HTML overlay): press-any-button, title, controls, pause,
 * game over / continue, level clear, controller-lost. All are navigable with
 * gamepad, keyboard or mouse.
 */
import type { MenuInput } from '../input/InputManager';

export const EMBLEM_SVG = `<svg class="emblem" viewBox="0 0 200 150">
<defs>
<linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="0.5" stop-color="#e8b64c"/><stop offset="1" stop-color="#8a5a1c"/></linearGradient>
<radialGradient id="ec" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#e8ffff"/><stop offset="0.4" stop-color="#6ff4ff"/><stop offset="1" stop-color="#1f7d9a" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="100" cy="70" r="62" fill="url(#ec)" opacity="0.35"/>
<path d="M100 8 L168 118 H32 Z" fill="none" stroke="url(#eg)" stroke-width="5"/>
<path d="M100 30 L148 110 H52 Z" fill="#0b1426" stroke="#e8b64c" stroke-width="1.5" opacity="0.9"/>
<path d="M70 78 Q100 54 130 78 Q100 98 70 78 Z" fill="none" stroke="#6ff4ff" stroke-width="3"/>
<circle cx="100" cy="77" r="8" fill="#6ff4ff"/>
<path d="M96 90 L90 108 M104 88 Q114 100 106 108" stroke="#6ff4ff" stroke-width="2.5" fill="none"/>
<path d="M18 128 Q34 118 50 128 T82 128 T114 128 T146 128 T182 128" stroke="#6ff4ff" stroke-width="3" fill="none" opacity="0.8"/>
<path d="M28 140 Q44 130 60 140 T92 140 T124 140 T156 140 T172 140" stroke="#29b3a8" stroke-width="2.5" fill="none" opacity="0.6"/>
</svg>`;

export const LOGO_HTML = `<div class="logo">${EMBLEM_SVG}<div class="logo-title">NEO ATLANTIS</div><div class="logo-sub">A BRAWL BENEATH THE WAVES</div></div>`;

export interface MenuItem {
  label: string;
  action: () => void;
}

export type Sfx = (name: string) => void;

export class Screen {
  readonly root: HTMLDivElement;
  protected items: MenuItem[] = [];
  protected index = 0;
  private readonly list: HTMLDivElement | null;
  onBack: (() => void) | null = null;

  constructor(parent: HTMLElement, cls: string, html: string, items: MenuItem[] = []) {
    this.root = document.createElement('div');
    this.root.className = `screen ${cls}`;
    this.root.innerHTML = html;
    parent.appendChild(this.root);
    this.list = items.length ? document.createElement('div') : null;
    if (this.list) {
      this.list.className = 'menu interactive';
      this.root.appendChild(this.list);
      this.setItems(items);
    }
    this.hide();
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    this.index = 0;
    if (!this.list) return;
    this.list.innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('div');
      b.className = 'menu-item';
      b.textContent = it.label;
      b.onmouseenter = () => {
        this.index = i;
        this.render();
      };
      b.onclick = () => {
        this.index = i;
        it.action();
      };
      this.list!.appendChild(b);
    });
    this.render();
  }

  protected render(): void {
    if (!this.list) return;
    [...this.list.children].forEach((c, i) => c.classList.toggle('sel', i === this.index));
  }

  /** Show the screen; the cursor returns to the first item unless keepCursor is set. */
  show(keepCursor = false): void {
    this.root.classList.add('on');
    if (!keepCursor) this.index = 0;
    this.render();
  }

  hide(): void {
    this.root.classList.remove('on');
  }

  get visible(): boolean {
    return this.root.classList.contains('on');
  }

  handle(m: MenuInput, sfx: Sfx): void {
    if (!this.items.length) return;
    if (m.up) {
      this.index = (this.index + this.items.length - 1) % this.items.length;
      sfx('ui_move');
      this.render();
    } else if (m.down) {
      this.index = (this.index + 1) % this.items.length;
      sfx('ui_move');
      this.render();
    } else if (m.back) {
      // Esc / B go back; they never activate the highlighted item.
      if (this.onBack) {
        sfx('ui_back');
        this.onBack();
      }
    } else if (m.confirm || m.start) {
      sfx('ui_confirm');
      this.items[this.index]!.action();
    }
  }
}

export const CONTROLS_HTML = `<div class="panel controls">
<h2>CONTROLS</h2>
<table>
<tr><th></th><th>GAMEPAD</th><th>KEYBOARD</th></tr>
<tr><td>Move (8-way)</td><td>Left stick / D-pad</td><td>Arrows / WASD</td></tr>
<tr><td>Attack · pick up weapon</td><td>X / &#9633;</td><td>J or X</td></tr>
<tr><td>Jump</td><td>A / &#10005;</td><td>K, Z or Space</td></tr>
<tr><td>Run</td><td>RB / R1 (or double-tap)</td><td>L or Shift (or double-tap)</td></tr>
<tr><td>Pause</td><td>Start</td><td>Enter / Esc / P</td></tr>
</table>
<ul>
<li>Tap attack for a 4-hit combo: jab, jab, body blow, finisher. The chain continues while your hits connect.</li>
<li>Jump + attack: neutral jump for a downward kick, jump while moving for a flying kick.</li>
<li>Attack while running for a lunging dash attack.</li>
<li>Stand over a weapon and press attack to pick it up. Weapons wear out, and you drop them when knocked down.</li>
<li>Enemies flash and wind up before they strike &mdash; step out of their lane or hit them first.</li>
</ul>
<div class="hint">Press B / Esc to go back</div>
</div>`;

export function formatTime(frames: number): string {
  const s = Math.floor(frames / 60);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
