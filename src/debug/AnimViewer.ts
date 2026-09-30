/**
 * Animation viewer: plays any clip on any character (debug tool). Uses the
 * same CharacterVisual interface and post pipeline as the game.
 */
import * as THREE from 'three';
import type { WeaponType } from '../sim/types';
import type { MoveDef } from '../data/defs';
import { MOVES, moveTotal } from '../data/moves';
import { FIGHTERS } from '../data/fighters';
import { CodeCharacter } from '../render/characters/CharacterView';
import { PALETTES } from '../render/characters/models';
import { getClipLibrary } from '../render/anim/library';
import { makeEnvMap } from '../render/envmap';
import type { PostPipeline } from '../render/post';

const NORM_LEN: Record<string, number> = {
  hit_light: 18,
  hit_heavy: 24,
  knockdown: 34,
  bounce: 12,
  lying: 34,
  getup: 24,
  land: 8,
  jump: 39,
  jump_squat: 3,
  mb_intro: 190,
  fb_intro: 210,
};

export class AnimViewer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  private character: CodeCharacter | null = null;
  model = 'heru';
  palette = 'default';
  clip = 'idle';
  frame = 0;
  playing = true;
  speed = 1;
  view: 'right' | 'left' | 'three' | 'front' = 'right';
  weapon: WeaponType | null = null;
  private dist = 0;
  private lineupChars: CodeCharacter[] = [];
  private lineupTime = 0;
  private readonly ui: HTMLDivElement;
  private readonly floor: THREE.Mesh;
  private frameInput!: HTMLInputElement;
  private clipSelect!: HTMLSelectElement;
  private info!: HTMLDivElement;

  constructor(renderer: THREE.WebGLRenderer, parent: HTMLElement) {
    this.scene.background = new THREE.Color(0x10141e);
    this.scene.environment = makeEnvMap(renderer, {
      top: 0x5a7aa8,
      horizon: 0x2a3446,
      bottom: 0x100c0a,
      panels: [
        { color: 0xfff0d0, intensity: 6, pos: [10, 12, 14], size: [10, 6] },
        { color: 0x80c0ff, intensity: 3, pos: [-14, 6, -10], size: [8, 8] },
      ],
    });
    this.scene.add(new THREE.HemisphereLight(0x9ab8e0, 0x2a2018, 0.9));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
    key.position.set(4, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x60c8ff, 1.6);
    rim.position.set(-6, 4, -6);
    this.scene.add(rim);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.8 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);
    const grid = new THREE.GridHelper(6, 12, 0x4a4030, 0x302a22);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.position.y = 0.002;
    this.scene.add(grid);
    this.ui = document.createElement('div');
    this.ui.className = 'viewer-ui';
    parent.appendChild(this.ui);
    this.buildUI();
    this.setModel('heru', 'default');
  }

  private buildUI(): void {
    const ui = this.ui;
    ui.innerHTML = '';
    const row = (label: string, el: HTMLElement): void => {
      const d = document.createElement('label');
      d.textContent = label;
      d.appendChild(el);
      ui.appendChild(d);
    };
    const modelSel = document.createElement('select');
    for (const [m, pals] of Object.entries(PALETTES)) {
      for (const p of Object.keys(pals)) {
        const o = document.createElement('option');
        o.value = `${m}:${p}`;
        o.textContent = p === 'default' ? m : `${m} (${p})`;
        modelSel.appendChild(o);
      }
    }
    modelSel.onchange = () => {
      const [m, p] = modelSel.value.split(':');
      this.setModel(m!, p!);
    };
    row('Character', modelSel);
    this.clipSelect = document.createElement('select');
    this.clipSelect.onchange = () => this.setClip(this.clipSelect.value);
    row('Clip', this.clipSelect);
    const wsel = document.createElement('select');
    for (const w of ['none', 'khopesh', 'staff', 'jar']) {
      const o = document.createElement('option');
      o.value = w;
      o.textContent = w;
      wsel.appendChild(o);
    }
    wsel.onchange = () => {
      this.weapon = wsel.value === 'none' ? null : (wsel.value as WeaponType);
      this.character?.setWeapon(this.weapon);
    };
    row('Weapon', wsel);
    const viewSel = document.createElement('select');
    for (const v of ['right', 'left', 'three', 'front']) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      viewSel.appendChild(o);
    }
    viewSel.onchange = () => (this.view = viewSel.value as typeof this.view);
    row('View', viewSel);
    const play = document.createElement('button');
    play.textContent = 'Play / Pause';
    play.onclick = () => (this.playing = !this.playing);
    ui.appendChild(play);
    const speed = document.createElement('input');
    speed.type = 'range';
    speed.min = '0.05';
    speed.max = '2';
    speed.step = '0.05';
    speed.value = '1';
    speed.oninput = () => (this.speed = Number(speed.value));
    row('Speed', speed);
    this.frameInput = document.createElement('input');
    this.frameInput.type = 'range';
    this.frameInput.min = '0';
    this.frameInput.max = '100';
    this.frameInput.step = '0.1';
    this.frameInput.oninput = () => {
      this.playing = false;
      this.frame = Number(this.frameInput.value);
    };
    row('Frame', this.frameInput);
    this.info = document.createElement('div');
    this.info.className = 'viewer-info';
    ui.appendChild(this.info);
  }

  /** Every character side by side (silhouette check). */
  lineup(view: 'right' | 'three' = 'three'): void {
    this.character?.dispose();
    this.character = null;
    for (const c of this.lineupChars) c.dispose();
    this.lineupChars = [];
    const cast: [string, string, number][] = [
      ['sobekhan', 'default', 2.2],
      ['bruiser', 'default', 1.5],
      ['grunt', 'default', 1.1],
      ['grunt', 'elite', 1.1],
      ['heru', 'default', 1.1],
      ['bladeRunner', 'default', 1.05],
      ['thrower', 'default', 1.05],
      ['acrobat', 'default', 1.0],
      ['apep', 'default', 1.4],
    ];
    const total = cast.reduce((a, c) => a + c[2], 0);
    let x = -total / 2;
    for (const [m, p, w] of cast) {
      const c = new CodeCharacter(m, p);
      c.setRim(new THREE.Color(0x70c8ff), 0.6);
      x += w / 2;
      c.setTransform(x, 0, 0, 1, 0, true);
      c.object.rotation.y = view === 'three' ? Math.PI / 5 : Math.PI / 2 - (14 * Math.PI) / 180;
      x += w / 2;
      this.scene.add(c.object);
      this.lineupChars.push(c);
    }
    this.floor.scale.setScalar(4);
    this.camera.position.set(0, 2.0, 14.5);
    this.camera.lookAt(0, 1.35, 0);
  }

  setModel(model: string, palette = 'default'): void {
    for (const c of this.lineupChars) c.dispose();
    this.lineupChars = [];
    this.floor.scale.setScalar(1);
    this.character?.dispose();
    this.model = model;
    this.palette = palette;
    this.character = new CodeCharacter(model, palette);
    this.character.setRim(new THREE.Color(0x70c8ff), 0.8);
    this.character.setWeapon(this.weapon);
    this.scene.add(this.character.object);
    this.clipSelect.innerHTML = '';
    for (const name of [...getClipLibrary(model).keys()].sort()) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      this.clipSelect.appendChild(o);
    }
    this.setClip(this.character.hasClip(this.clip) ? this.clip : 'idle');
  }

  setClip(name: string): void {
    this.clip = name;
    this.frame = 0;
    this.dist = 0;
    this.clipSelect.value = name;
    this.character?.resetSecondary();
  }

  /** The move whose frame data drives a move clip (prefers this model's own moves). */
  moveFor(clip: string): { id: string; def: MoveDef } | null {
    const own = Object.entries(FIGHTERS)
      .filter(([, f]) => f.model === this.model)
      .flatMap(([, f]) => Object.values(f.moves));
    for (const id of own) {
      const def = MOVES[id];
      if (def && def.clip === clip) return { id, def };
    }
    for (const [id, def] of Object.entries(MOVES)) if (def.clip === clip) return { id, def };
    const base = clip.replace(/_loop$/, '');
    for (const [id, def] of Object.entries(MOVES)) if (def.clip === base) return { id, def };
    return null;
  }

  clipLength(): number {
    const lib = getClipLibrary(this.model);
    const c = lib.get(this.clip);
    if (!c) return 60;
    if (c.mode === 'move') {
      const m = this.moveFor(this.clip);
      return m ? moveTotal(m.def) + 8 : 40;
    }
    if (c.mode === 'norm') return NORM_LEN[this.clip] ?? 30;
    if (c.mode === 'loop') return c.length;
    if (c.mode === 'stride') return 90;
    return 40;
  }

  update(dt: number): void {
    if (this.lineupChars.length) {
      this.lineupTime += dt * 60;
      for (const c of this.lineupChars) c.play({ clip: 'idle', frame: this.lineupTime, len: 0, move: null }, dt);
      this.info.textContent = 'lineup';
      return;
    }
    const ch = this.character;
    if (!ch) return;
    const lib = getClipLibrary(this.model);
    const c = lib.get(this.clip);
    const len = this.clipLength();
    if (this.playing) {
      this.frame += dt * 60 * this.speed;
      if (this.frame > len) this.frame = 0;
    }
    this.frameInput.max = String(len);
    this.frameInput.value = String(this.frame);
    const move = c && c.mode === 'move' ? (this.moveFor(this.clip)?.def ?? null) : null;
    const def = Object.values(FIGHTERS).find((f) => f.model === this.model);
    const speed = this.clip === 'run' ? (def?.run ?? 0.1) : (def?.walk ?? 0.05);
    if (c?.mode === 'stride') this.dist = this.frame * speed;
    // Stride clips read distance from the transform; feed it by moving in place.
    ch.setTransform(0, 0, 0, 1, dt, true);
    if (c?.mode === 'stride') ch.overrideTravel(this.dist);
    const normLen = NORM_LEN[this.clip] ?? 30;
    ch.play({ clip: this.clip, frame: this.frame, len: c?.mode === 'norm' ? normLen : len, move }, dt);
    const yaw = this.view === 'right' ? Math.PI / 2 - (14 * Math.PI) / 180 : this.view === 'left' ? -Math.PI / 2 + (14 * Math.PI) / 180 : this.view === 'three' ? Math.PI / 4 : 0;
    ch.object.rotation.y = yaw;
    const h = ch.height;
    const dist = Math.max(4.2, h * 2.3);
    this.camera.position.set(0, h * 0.62 + 0.9, dist);
    this.camera.lookAt(0, h * 0.5, 0);
    const m = move ? ` S${move.startup} A${move.active} R${move.recovery}` : '';
    this.info.textContent = `${this.model} · ${this.clip} (${c?.mode ?? '?'}) · frame ${this.frame.toFixed(1)} / ${len}${m}`;
  }

  setAspect(a: number): void {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  show(v: boolean): void {
    this.ui.style.display = v ? '' : 'none';
  }

  dispose(): void {
    for (const c of this.lineupChars) c.dispose();
    this.character?.dispose();
    this.ui.remove();
  }

  attachPost(post: PostPipeline): void {
    post.setScene(this.scene, this.camera);
  }
}
