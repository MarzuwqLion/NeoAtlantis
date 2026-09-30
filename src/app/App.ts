/**
 * Application shell: screens, the fixed-step loop and glue between the
 * simulation, renderer, input, audio and UI.
 *
 * Loop: real time accumulates; the simulation advances in fixed 1/60 s steps
 * (slower during boss-kill slow motion); the renderer draws every display
 * frame, interpolating between the last two simulation states.
 */
import type { InputState, World } from '../sim/types';
import { NEUTRAL_INPUT } from '../sim/types';
import { createWorld, carryOver, step } from '../sim/world';
import { findFighter } from '../sim/fighter';
import { getEnv, ENVIRONMENTS } from '../data/level';
import { FIGHTERS } from '../data/fighters';
import { COMBAT } from '../data/tuning';
import { GameRenderer } from '../render/GameRenderer';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { playEventSounds } from '../audio/events';
import { Hud } from '../ui/Hud';
import { CONTROLS_HTML, formatTime, LOGO_HTML, Screen } from '../ui/Screens';
import { Bot } from '../debug/bot';
import { fitApp } from './layout';

export type AppState = 'press' | 'title' | 'controls' | 'playing' | 'paused' | 'gameover' | 'clear';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 8;

export class App {
  readonly renderer: GameRenderer;
  readonly input = new InputManager();
  readonly audio = new AudioManager();
  readonly hud: Hud;
  world: World;
  state: AppState = 'press';
  /** Debug: simulation speed multiplier (autoplay fast-forward). */
  timeScale = 1;
  /** Debug: freeze the simulation; `stepRequests` advances it frame by frame. */
  frozen = false;
  stepRequests = 0;
  bot: Bot | null = null;
  fps = 60;
  /** Debug: replaces game rendering (animation viewer). */
  renderOverride: ((dt: number) => void) | null = null;
  private acc = 0;
  private last = 0;
  private readonly screens: Record<'press' | 'title' | 'controls' | 'pause' | 'gameover' | 'clear', Screen>;
  private controlsReturn: AppState = 'title';
  private countdown = 10;
  private countdownAcc = 0;
  private attractTime = 0;
  private pendingOver = -1;
  private pendingClear = -1;
  private frameHooks: ((dt: number) => void)[] = [];
  private stepHooks: (() => void)[] = [];
  private readonly appEl: HTMLElement;
  private padLost = false;

  constructor(appEl: HTMLElement, canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.appEl = appEl;
    this.renderer = new GameRenderer(canvas);
    this.hud = new Hud(ui);
    this.hud.show(false);
    this.world = this.makeAttractWorld();
    this.screens = {
      press: new Screen(ui, 'title-bg', `${LOGO_HTML}<div class="press">PRESS ANY BUTTON</div><div class="small-hint">Gamepad recommended &middot; Keyboard: Arrows/WASD move &middot; J attack &middot; K jump &middot; L run &middot; Enter pause<br/>F1 or \` toggles the debug tools</div>`),
      title: new Screen(ui, 'title-bg', LOGO_HTML, [
        { label: 'START GAME', action: () => this.startGame(0) },
        { label: 'CONTROLS', action: () => this.showControls('title') },
      ]),
      controls: new Screen(ui, 'dim', CONTROLS_HTML),
      pause: new Screen(ui, 'dim', '<div class="big-title">PAUSED</div><div class="sub pause-msg"></div>', [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'RESTART STAGE', action: () => this.restartStage() },
        { label: 'CONTROLS', action: () => this.showControls('paused') },
        { label: 'QUIT TO TITLE', action: () => this.quitToTitle() },
      ]),
      gameover: new Screen(ui, 'dim', '<div class="big-title red">GAME OVER</div><div class="sub">CONTINUE?</div><div class="countdown">10</div>', [
        { label: 'CONTINUE', action: () => this.continueGame() },
        { label: 'QUIT', action: () => this.quitToTitle() },
      ]),
      clear: new Screen(ui, 'dim', '<div class="big-title">LEVEL CLEAR</div><div class="sub">NEO ATLANTIS IS SAFE</div><div class="stats"></div><div class="rank"></div>', [
        { label: 'RETURN TO TITLE', action: () => this.quitToTitle() },
      ]),
    };
    this.screens.controls.onBack = () => this.closeControls();
    this.screens.pause.onBack = () => this.resume();
    this.screens.press.show();
    this.input.onPadChange = (connected) => {
      if (!connected && this.state === 'playing' && !this.input.hasOverride(0)) {
        this.padLost = true;
        this.pause();
      }
    };
    const resize = (): void => {
      const l = fitApp(this.appEl);
      this.renderer.resize(l.width, l.height);
    };
    window.addEventListener('resize', resize);
    resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.input.hasOverride(0)) this.pause();
    });
  }

  private makeAttractWorld(): World {
    const w = createWorld({ env: 0, skipIntro: true, seed: 3 });
    w.debug.noAI = true;
    for (const f of w.fighters) f.x = -50;
    return w;
  }

  /** Called every display frame with dt (debug tools hook in here). */
  onFrame(fn: (dt: number) => void): void {
    this.frameHooks.push(fn);
  }

  /** Called right before every simulation step (test drivers hook in here). */
  onBeforeStep(fn: () => void): void {
    this.stepHooks.push(fn);
  }

  start(): void {
    this.renderer.setEnvironment(this.world.level.env);
    this.prewarm(0);
    this.last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private prewarm(envIndex: number): void {
    const env = getEnv(envIndex);
    const types = new Set<string>(['heru']);
    for (const enc of env.encounters) {
      for (const wv of enc.waves) for (const s of wv.spawns) types.add(s.type);
      if (enc.boss) types.add(enc.boss);
    }
    types.add('grunt');
    const models = [...types].map((t) => ({ model: FIGHTERS[t]!.model, palette: FIGHTERS[t]!.palette }));
    this.renderer.prewarm(models);
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  private showOnly(name: keyof App['screens'] | null, keepCursor = false): void {
    for (const [k, s] of Object.entries(this.screens)) {
      if (k === name) s.show(keepCursor);
      else s.hide();
    }
  }

  private sfx = (name: string): void => this.audio.play(name);

  startGame(env = 0, encounter?: number): void {
    this.world = createWorld(encounter !== undefined ? { env, encounter } : { env });
    this.enterPlaying();
    this.audio.playMusic(getEnv(env).music);
  }

  private enterPlaying(): void {
    this.state = 'playing';
    this.acc = 0;
    this.pendingOver = -1;
    this.pendingClear = -1;
    this.showOnly(null);
    this.hud.show(true);
    this.renderer.setEnvironment(this.world.level.env);
    this.prewarm(this.world.level.env);
    this.audio.setPaused(false);
  }

  /** Start playing an already-created world (debug jump-to-encounter, tests). */
  startGameFromWorld(): void {
    this.enterPlaying();
    this.audio.playMusic(getEnv(this.world.level.env).music);
  }

  continueGame(): void {
    const env = this.world.level.env;
    const carry = carryOver(this.world);
    for (const c of carry) c.continues++;
    this.world = createWorld({ env, carry, seed: (Date.now() & 0xffff) | 1 });
    this.enterPlaying();
    this.audio.playMusic(getEnv(env).music);
  }

  restartStage(): void {
    const env = this.world.level.env;
    const carry = carryOver(this.world);
    this.world = createWorld({ env, carry });
    this.enterPlaying();
    this.audio.playMusic(getEnv(env).music);
  }

  quitToTitle(): void {
    this.state = 'title';
    this.world = this.makeAttractWorld();
    this.hud.show(false);
    this.showOnly('title');
    this.audio.playMusic('title');
    this.audio.setPaused(false);
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    const msg = this.screens.pause.root.querySelector('.pause-msg');
    if (msg) msg.textContent = this.padLost ? 'CONTROLLER DISCONNECTED — reconnect and press a button' : '';
    this.showOnly('pause');
    this.audio.play('pause');
    this.audio.setPaused(true);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.padLost = false;
    this.state = 'playing';
    this.showOnly(null);
    this.audio.setPaused(false);
  }

  private showControls(from: AppState): void {
    this.controlsReturn = from;
    this.state = 'controls';
    this.showOnly('controls');
  }

  private closeControls(): void {
    if (this.controlsReturn === 'paused') {
      this.state = 'paused';
      this.showOnly('pause', true);
    } else {
      this.state = 'title';
      this.showOnly('title', true);
    }
  }

  private showGameOver(): void {
    this.state = 'gameover';
    this.countdown = 10;
    this.countdownAcc = 0;
    this.showOnly('gameover');
    this.audio.playMusic('game_over');
  }

  private showClear(): void {
    this.state = 'clear';
    const s = this.world.players[0]!;
    const secs = s.frames;
    const stats = this.screens.clear.root.querySelector('.stats')!;
    stats.innerHTML = [
      ['TIME', formatTime(secs)],
      ['SCORE', String(s.score).padStart(7, '0')],
      ['DAMAGE TAKEN', String(s.damageTaken)],
      ['ENEMIES DEFEATED', String(s.enemiesDefeated)],
      ['BEST COMBO', `${s.maxCombo} HITS`],
      ['CONTINUES', String(s.continues)],
    ]
      .map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`)
      .join('');
    const rank = s.continues === 0 && s.damageTaken < 250 ? 'RANK: PHARAOH' : s.continues === 0 ? 'RANK: HIGH PRIEST' : s.continues < 3 ? 'RANK: SCRIBE' : 'RANK: APPRENTICE';
    this.screens.clear.root.querySelector('.rank')!.textContent = rank;
    this.showOnly('clear');
    this.audio.playMusic('level_clear');
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private frame(dt: number): void {
    this.fps += (1 / Math.max(1e-4, dt) - this.fps) * 0.05;
    this.input.poll();
    if (this.renderOverride) {
      for (const fn of this.frameHooks) fn(dt);
      this.renderOverride(dt);
      return;
    }
    let alpha = 1;
    switch (this.state) {
      case 'press':
        this.attract(dt);
        if (this.input.consumeAny()) {
          void this.audio.unlock().then(() => this.audio.playMusic('title'));
          this.audio.play('ui_confirm');
          this.state = 'title';
          this.showOnly('title');
          this.input.menu();
        }
        break;
      case 'title':
        this.attract(dt);
        this.screens.title.handle(this.input.menu(), this.sfx);
        break;
      case 'controls': {
        const m = this.input.menu();
        if (m.back || m.confirm || m.start) {
          this.sfx('ui_back');
          this.closeControls();
        }
        if (this.controlsReturn === 'title') this.attract(dt);
        break;
      }
      case 'playing': {
        const m = this.input.menu();
        if (m.start && !this.input.hasOverride(0)) {
          this.pause();
          break;
        }
        alpha = this.advance(dt);
        break;
      }
      case 'paused':
        this.screens.pause.handle(this.input.menu(), this.sfx);
        alpha = 1;
        break;
      case 'gameover': {
        this.screens.gameover.handle(this.input.menu(), this.sfx);
        this.countdownAcc += dt;
        if (this.countdownAcc >= 1) {
          this.countdownAcc -= 1;
          this.countdown--;
          this.audio.play('tick');
          if (this.countdown < 0) {
            this.quitToTitle();
            break;
          }
        }
        const c = this.screens.gameover.root.querySelector('.countdown');
        if (c) c.textContent = String(Math.max(0, this.countdown));
        alpha = this.advance(dt, true);
        break;
      }
      case 'clear':
        this.screens.clear.handle(this.input.menu(), this.sfx);
        alpha = this.advance(dt, true);
        break;
    }
    for (const fn of this.frameHooks) fn(dt);
    this.renderer.update(this.world, alpha, dt);
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'gameover' || this.state === 'clear') this.hud.update(this.world, dt);
    this.renderer.render(dt);
  }

  /** Title / attract mode: slow camera drift over the docks. */
  private attract(dt: number): void {
    this.attractTime += dt;
    const w = this.world;
    const cx = 18 + Math.sin(this.attractTime * 0.05) * 14;
    w.camera.px = w.camera.x;
    w.camera.x = cx;
  }

  /** Advance the simulation by real time. Returns the interpolation alpha. */
  private advance(dt: number, idle = false): number {
    const w = this.world;
    if (this.frozen) {
      while (this.stepRequests > 0) {
        this.stepRequests--;
        this.stepSim();
      }
      return 1;
    }
    const scale = (w.slowmo > 0 ? COMBAT.slowmoScale : 1) * this.timeScale;
    this.acc += dt * scale;
    let n = 0;
    const cap = MAX_STEPS_PER_FRAME * Math.max(1, Math.ceil(this.timeScale));
    while (this.acc >= STEP && n < cap) {
      this.acc -= STEP;
      this.stepSim(idle);
      n++;
    }
    if (n >= cap) this.acc = Math.min(this.acc, STEP);
    return Math.min(1, this.acc / STEP);
  }

  private inputs: (InputState | undefined)[] = [];

  private stepSim(idle = false): void {
    for (const fn of this.stepHooks) fn();
    const w = this.world;
    for (let i = 0; i < w.players.length; i++) this.inputs[i] = idle ? NEUTRAL_INPUT : this.sampleInput(i);
    step(w, this.inputs);
    this.renderer.onStepEvents(w);
    for (const e of w.events) {
      playEventSounds(this.audio, e, w);
      switch (e.type) {
        case 'rumble':
          this.input.rumble(e.player, e.strong, e.weak, e.ms);
          break;
        case 'bossIntro':
          this.audio.playMusic(e.def === 'apep' ? 'boss_final' : 'boss_mid');
          break;
        case 'bossDefeated':
          this.audio.stopMusic(1.5);
          break;
        case 'encounterClear':
          if (!w.level.active && w.level.bossId >= 0 && !this.isFinal()) this.audio.playMusic(getEnv(w.level.env).music);
          break;
        case 'envEnter':
          this.audio.playMusic(getEnv(e.env).music);
          this.prewarm(e.env);
          break;
        case 'gameOver':
          this.pendingOver = 120;
          break;
        case 'levelClear':
          this.pendingClear = 150;
          break;
        default:
          break;
      }
    }
    if (this.pendingOver > 0 && --this.pendingOver === 0 && this.state === 'playing') this.showGameOver();
    if (this.pendingClear > 0 && --this.pendingClear === 0 && this.state === 'playing') this.showClear();
  }

  private isFinal(): boolean {
    return this.world.level.env >= ENVIRONMENTS.length - 1;
  }

  private sampleInput(i: number): InputState {
    if (i === 0 && this.bot) return this.bot.decide(this.world, 0);
    return this.input.sample(i);
  }

  setAutoplay(on: boolean): void {
    this.bot = on ? new Bot() : null;
  }

  playerFighter() {
    const s = this.world.players[0];
    return s ? findFighter(this.world, s.fighterId) : undefined;
  }
}
