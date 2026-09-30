/**
 * Game bootstrap. Exposes window.__game for automated play-testing
 * (Playwright drives the game through the same input interface as a pad).
 */
import '../ui/hud.css';
import { App } from './App';
import { DebugTools } from '../debug/DebugTools';
import { createWorld } from '../sim/world';
import type { World } from '../sim/types';
import { Bot } from '../debug/bot';
import { spawnEnemy } from '../sim/spawn';

export interface GameHooks {
  app: App;
  debug: DebugTools;
  world(): World;
  state(): string;
  start(env?: number, encounter?: number): void;
  autoplay(on: boolean): void;
  speed(scale: number): void;
  god(on: boolean): void;
  jump(env: number, encounter: number): void;
  makeBot(): Bot;
  errors: string[];
}

declare global {
  interface Window {
    __game?: GameHooks;
    __spawn?: (type: string) => void;
  }
}

export function startGame(): void {
  const appEl = document.getElementById('app')!;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui')!;
  const app = new App(appEl, canvas, ui);
  const debug = new DebugTools(app, ui);
  const errors: string[] = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  window.__game = {
    app,
    debug,
    errors,
    world: () => app.world,
    state: () => app.state,
    start: (env = 0, encounter?: number) => {
      void app.audio.unlock();
      if (encounter !== undefined) {
        app.world = createWorld({ env, encounter });
        app.startGameFromWorld();
      } else app.startGame(env);
    },
    autoplay: (on) => app.setAutoplay(on),
    speed: (s) => (app.timeScale = s),
    god: (on) => (app.world.debug.god = on),
    jump: (env, enc) => debug.jump(env, enc),
    makeBot: () => new Bot(),
  };
  window.__spawn = (type: string) => {
    const w = app.world;
    const f = spawnEnemy(w, type, Math.random() < 0.5 ? 'left' : 'right', Math.random() * 2 - 1, 0, w.camera.x);
    if (w.level.active) w.level.active.ids.push(f.id);
  };
  app.start();
  const params = new URLSearchParams(location.search);
  if (params.has('debug')) debug.toggle();
}
