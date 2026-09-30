/**
 * Debug tools, toggled with F1 or the backquote key:
 *   hitbox / hurtbox overlay, freeze + frame-step (".") , god mode, AI off,
 *   autoplay bot, sim speed, jump to any encounter, spawn any enemy,
 *   animation viewer (any clip on any character), live FPS / draw calls.
 */
import type { App } from '../app/App';
import { ENVIRONMENTS } from '../data/level';
import { FIGHTERS } from '../data/fighters';
import { createWorld } from '../sim/world';
import { spawnEnemy } from '../sim/spawn';
import { AnimViewer } from './AnimViewer';

export class DebugTools {
  readonly panel: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private viewer: AnimViewer | null = null;
  visible = false;
  private statTimer = 0;
  private readonly syncers: (() => void)[] = [];

  constructor(private readonly app: App, parent: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel interactive';
    this.panel.style.display = 'none';
    parent.appendChild(this.panel);
    this.panel.innerHTML = `<h3>DEBUG (F1)</h3><div class="debug-stats"></div>`;
    this.stats = this.panel.querySelector('.debug-stats')!;
    const check = (label: string, get: () => boolean, set: (v: boolean) => void): HTMLInputElement => {
      const l = document.createElement('label');
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = get();
      c.onchange = () => set(c.checked);
      this.syncers.push(() => {
        if (document.activeElement !== c) c.checked = get();
      });
      l.append(c, document.createTextNode(label));
      this.panel.appendChild(l);
      return c;
    };
    check('Hitboxes / hurtboxes', () => app.renderer.hitboxes.lines.visible, (v) => (app.renderer.hitboxes.lines.visible = v));
    check('God mode', () => app.world.debug.god, (v) => (app.world.debug.god = v));
    check('AI disabled', () => app.world.debug.noAI, (v) => (app.world.debug.noAI = v));
    check('Autoplay bot', () => !!app.bot, (v) => app.setAutoplay(v));
    check('Freeze (frame-step with .)', () => app.frozen, (v) => (app.frozen = v));
    const stepBtn = this.button('Step 1 frame', () => {
      app.frozen = true;
      app.stepRequests++;
    });
    this.panel.appendChild(stepBtn);
    // speed
    const speed = document.createElement('select');
    for (const s of [0.25, 0.5, 1, 2, 4, 8]) {
      const o = document.createElement('option');
      o.value = String(s);
      o.textContent = `Sim speed x${s}`;
      if (s === 1) o.selected = true;
      speed.appendChild(o);
    }
    speed.onchange = () => (app.timeScale = Number(speed.value));
    this.panel.appendChild(speed);
    // jump to encounter
    this.panel.appendChild(this.heading('Jump to encounter'));
    const enc = document.createElement('select');
    ENVIRONMENTS.forEach((env, ei) => {
      env.encounters.forEach((e, i) => {
        const o = document.createElement('option');
        o.value = `${ei}:${i}`;
        o.textContent = `${env.stage} · ${e.name}${e.boss ? ' (BOSS)' : ''}${e.tram ? ' (TRAM)' : ''}`;
        enc.appendChild(o);
      });
    });
    this.panel.appendChild(enc);
    this.panel.appendChild(
      this.button('Go', () => {
        const [e, i] = enc.value.split(':').map(Number);
        this.jump(e!, i!);
      }),
    );
    // spawn enemy
    this.panel.appendChild(this.heading('Spawn enemy'));
    const sp = document.createElement('select');
    for (const [id, f] of Object.entries(FIGHTERS)) {
      if (!f.ai || id === 'sobekhan' || id === 'apep') continue;
      const o = document.createElement('option');
      o.value = id;
      o.textContent = `${f.name} (${id})`;
      sp.appendChild(o);
    }
    this.panel.appendChild(sp);
    this.panel.appendChild(
      this.button('Spawn (right edge)', () => {
        if (app.state !== 'playing') return;
        const f = spawnEnemy(app.world, sp.value, 'right', 0, 0, app.world.camera.x);
        if (app.world.level.active) app.world.level.active.ids.push(f.id);
      }),
    );
    this.panel.appendChild(this.heading('Animation viewer'));
    this.panel.appendChild(this.button('Open / close viewer', () => this.toggleViewer()));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggle();
      } else if (e.code === 'Period' && this.visible) {
        app.frozen = true;
        app.stepRequests++;
      }
    });
    app.onFrame((dt) => this.update(dt));
  }

  private heading(t: string): HTMLElement {
    const h = document.createElement('h3');
    h.textContent = t;
    return h;
  }

  private button(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    return b;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? '' : 'none';
  }

  jump(env: number, encounter: number): void {
    const app = this.app;
    const god = app.world.debug.god;
    app.world = createWorld({ env, encounter });
    app.world.debug.god = god;
    app.startGameFromWorld();
  }

  toggleViewer(): void {
    const app = this.app;
    if (this.viewer) {
      this.viewer.dispose();
      this.viewer = null;
      app.renderer.post.setScene(app.renderer.scene, app.renderer.camera);
      app.renderOverride = null;
      return;
    }
    const v = new AnimViewer(app.renderer.renderer, this.panel.parentElement!);
    v.setAspect(16 / 9);
    this.viewer = v;
    app.renderer.post.setScene(v.scene, v.camera);
    app.renderOverride = (dt) => {
      v.update(dt);
      app.renderer.post.render(dt);
    };
  }

  private update(dt: number): void {
    if (!this.visible) return;
    this.statTimer += dt;
    if (this.statTimer < 0.25) return;
    this.statTimer = 0;
    for (const s of this.syncers) s();
    const a = this.app;
    const w = a.world;
    const r = a.renderer;
    const env = ENVIRONMENTS[w.level.env]!;
    this.stats.textContent =
      `FPS        ${a.fps.toFixed(0)}\n` +
      `Draw calls ${r.lastDrawCalls}\n` +
      `Triangles  ${(r.lastTriangles / 1000).toFixed(0)}k\n` +
      `Res scale  ${r.pixelRatio.toFixed(2)}\n` +
      `Frame      ${w.frame}\n` +
      `Entities   ${w.fighters.length} f / ${w.projectiles.length} p / ${w.items.length} i\n` +
      `Env        ${env.name}\n` +
      `Encounter  ${w.level.active ? env.encounters[w.level.active.index]!.name + ' w' + (w.level.active.wave + 1) : '-'}\n` +
      `Camera     ${w.camera.x.toFixed(1)}${w.camera.lockX !== null ? ' (locked)' : ''}`;
  }
}
