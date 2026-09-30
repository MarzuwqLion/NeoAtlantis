/**
 * The game renderer. Reads the simulation state (never writes it) and turns
 * it into a frame: camera, environment, characters, projectiles, items,
 * effects and post-processing. Interpolates between the last two simulation
 * states with `alpha` so rendering is decoupled from the fixed 60 Hz step.
 */
import * as THREE from 'three';
import type { Fighter, SimEvent, World } from '../sim/types';
import { CAMERA_OFFSET } from '../sim/view';
import { CAMERA, COMBAT } from '../data/tuning';
import { getFighterDef } from '../data/fighters';
import { getMove } from '../data/moves';
import { TRANSITION } from '../data/tuning';
import { CodeCharacter } from './characters/CharacterView';
import { createWeaponMesh, jarGroup } from './characters/weapons';
import { PostPipeline } from './post';
import { makeEnvMap } from './envmap';
import { SHARED } from './materials';
import { setMaxAnisotropy } from './textures';
import { Effects } from './fx/Effects';
import { Trail } from './fx/Trails';
import type { RingHandle } from './fx/Ground';
import { buildEnvironment, type EnvironmentView } from './env';
import type { EnvLook } from './env/types';
import { HitboxOverlay } from './HitboxOverlay';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface ItemView {
  obj: THREE.Object3D;
}

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly post: PostPipeline;
  readonly fx = new Effects();
  readonly hitboxes = new HitboxOverlay();
  env: EnvironmentView | null = null;
  envIndex = -1;
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  private readonly key = new THREE.DirectionalLight(0xffffff, 2);
  private readonly fill = new THREE.DirectionalLight(0xffffff, 0.5);
  private readonly points: THREE.PointLight[] = [];
  private readonly chars = new Map<number, CodeCharacter>();
  private readonly pool = new Map<string, CodeCharacter[]>();
  private readonly projViews = new Map<number, THREE.Object3D>();
  private readonly projRings = new Map<number, RingHandle>();
  private readonly itemViews = new Map<number, ItemView>();
  private readonly trails: Trail[] = [];
  private readonly rim = new THREE.Color(0x80e0ff);
  private rimStrength = 0.75;
  private shadowStrength = 0.8;
  private time = 0;
  private readonly shake = new THREE.Vector2();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private width = 1280;
  private height = 720;
  pixelRatio = 1;
  maxPixelRatio = 1;
  adaptive = true;
  private frameTimes: number[] = [];
  private adaptTimer = 0;
  lastDrawCalls = 0;
  lastTriangles = 0;

  constructor(canvas: HTMLCanvasElement) {
    const lowPower = new URLSearchParams(location.search).has('lowpower');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: lowPower ? 'low-power' : 'high-performance', stencil: false });
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.info.autoReset = false;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    this.pixelRatio = Math.min(1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovY, CAMERA.aspect, 0.5, 600);
    this.scene.add(this.hemi, this.key, this.key.target, this.fill, this.fill.target);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 10, 2);
      this.points.push(p);
      this.scene.add(p);
    }
    this.scene.add(this.fx.group);
    this.scene.add(this.hitboxes.lines);
    for (let i = 0; i < 6; i++) {
      const t = new Trail(0x9ff6ff);
      this.trails.push(t);
      this.scene.add(t.mesh);
    }
    this.post = new PostPipeline(this.renderer, this.scene, this.camera, 1280, 720);
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.post.composer.setPixelRatio(this.pixelRatio);
    this.post.setSize(w, h);
    this.camera.aspect = CAMERA.aspect;
    this.camera.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------
  // Environment
  // -------------------------------------------------------------------------

  setEnvironment(index: number): void {
    if (this.envIndex === index && this.env) return;
    if (this.env) this.env.dispose();
    this.env = buildEnvironment(index);
    this.envIndex = index;
    this.scene.add(this.env.group);
    this.applyLook(this.env.look);
    this.fx.clear();
    for (const t of this.trails) t.reset();
    for (const [, r] of this.projRings) this.fx.rings.release(r);
    this.projRings.clear();
  }

  private applyLook(l: EnvLook): void {
    this.scene.background = new THREE.Color(l.background);
    this.scene.fog = new THREE.FogExp2(l.fog.color, l.fog.density);
    const oldEnv = this.scene.environment;
    this.scene.environment = makeEnvMap(this.renderer, l.envMap);
    oldEnv?.dispose();
    this.hemi.color.set(l.hemi.sky);
    this.hemi.groundColor.set(l.hemi.ground);
    this.hemi.intensity = l.hemi.intensity;
    this.key.color.set(l.key.color);
    this.key.intensity = l.key.intensity;
    this.key.position.set(l.key.dir[0] * 20, l.key.dir[1] * 20, l.key.dir[2] * 20);
    this.fill.color.set(l.fill.color);
    this.fill.intensity = l.fill.intensity;
    this.fill.position.set(l.fill.dir[0] * 20, l.fill.dir[1] * 20, l.fill.dir[2] * 20);
    this.rim.set(l.rim.color);
    this.rimStrength = l.rim.strength;
    SHARED.uCausticColor.value.set(l.caustics.color);
    SHARED.uCausticStrength.value = l.caustics.strength;
    SHARED.uCausticScale.value = l.caustics.scale;
    SHARED.uCausticSpeed.value = l.caustics.speed;
    const g = this.post.grade;
    g.exposure = l.grade.exposure;
    g.bloomStrength = l.grade.bloomStrength;
    g.bloomRadius = l.grade.bloomRadius;
    g.bloomThreshold = l.grade.bloomThreshold;
    g.saturation = l.grade.saturation;
    g.contrast = l.grade.contrast;
    g.vignette = l.grade.vignette;
    g.lift.set(l.grade.lift);
    g.gamma.set(l.grade.gamma);
    g.gain.set(l.grade.gain);
    g.tint.set(l.grade.tint);
    this.fx.dust.set(l.dust);
    this.fx.accent.set(l.accent);
    this.shadowStrength = l.shadowStrength;
    for (const v of this.chars.values()) v.setRim(this.rim, this.rimStrength);
    for (const list of this.pool.values()) for (const v of list) v.setRim(this.rim, this.rimStrength);
  }

  /** Pre-create one view of each character type and compile every shader (no mid-fight hitches). */
  prewarm(models: { model: string; palette: string }[]): void {
    const made: CodeCharacter[] = [];
    for (const m of models) made.push(this.acquire(m.model, m.palette));
    for (const w of ['khopesh', 'staff', 'jar'] as const) {
      const o = createWeaponMesh(w);
      o.position.set(0, -100, 0);
      this.scene.add(o);
      made[0]?.object.add(o);
    }
    for (const v of made) {
      v.object.position.set(this.camera.position.x, 0, 0);
      v.object.visible = true;
    }
    this.renderer.compile(this.scene, this.camera);
    for (const v of made) this.release(v);
  }

  // -------------------------------------------------------------------------
  // Characters
  // -------------------------------------------------------------------------

  private acquire(model: string, palette: string): CodeCharacter {
    const key = `${model}:${palette}`;
    const list = this.pool.get(key);
    let v = list?.pop();
    if (!v) {
      v = new CodeCharacter(model, palette);
      this.scene.add(v.object);
    }
    v.object.visible = true;
    v.setRim(this.rim, this.rimStrength);
    v.setFade(1);
    v.setFlash(0);
    v.setGlow(0);
    v.setWeapon(null);
    v.setProp(false);
    v.resetSecondary();
    return v;
  }

  private release(v: CodeCharacter): void {
    v.object.visible = false;
    const key = `${v.model}:${v.palette}`;
    const list = this.pool.get(key) ?? [];
    list.push(v);
    this.pool.set(key, list);
  }

  viewFor(id: number): CodeCharacter | undefined {
    return this.chars.get(id);
  }

  private syncFighter(f: Fighter, v: CodeCharacter, alpha: number, dt: number, fresh: boolean, w: World): void {
    const x = lerp(f.px, f.x, alpha);
    const y = lerp(f.py, f.y, alpha);
    const z = lerp(f.pz, f.z, alpha);
    v.setTransform(x, y, z, f.facing, dt, fresh);
    const frame = f.pAnimFrame + (f.animFrame - f.pAnimFrame) * alpha;
    const move = f.animMove ? getMove(f.animMove) : null;
    // Victim shake during hitstop reads the impact.
    if (f.hitstop > 0 && f.flash > 0) v.setShake(Math.sin(this.time * 140 + f.id) * 0.04, 0);
    else v.setShake(0, 0);
    v.play({ clip: f.anim, frame, len: f.animLen, move }, dt);
    v.setWeapon(f.weapon);
    const lobbing = f.anim === 'thrower_lob' && !!f.move && !!move && f.move.frame < move.startup + move.active;
    v.setProp(lobbing);
    v.setFlash(f.flash > 0 ? Math.min(1, f.flash / 7) * 0.7 : 0);
    let glow = 0;
    if (f.telegraph) glow = 0.55 + 0.45 * Math.sin(this.time * 28);
    if (f.boss && f.boss.phase === 2) glow = Math.max(glow, 0.45 + 0.2 * Math.sin(this.time * 4));
    if (f.state === 'intro') glow = Math.max(glow, 0.3);
    v.setGlow(glow);
    let fade = 1;
    if (f.state === 'dead') {
      const t = f.stateFrame / COMBAT.deathFrames;
      fade = t > 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.45) : 1;
      if (Math.floor(f.stateFrame / 4) % 2 === 1) fade *= 0.2;
      if (f.player >= 0 && w.gameOver) fade = 0;
    } else if (f.player >= 0 && f.invuln > 0 && f.state !== 'getup') {
      fade = Math.floor(this.time * 20) % 2 === 0 ? 0.45 : 1;
    }
    v.setFade(fade);
    // Blob shadow: shrinks and fades with height.
    const def = getFighterDef(f.def);
    const lying = f.state === 'lying' || f.state === 'dead' || (f.state === 'launched' && f.y < 0.4);
    const r = def.hurt.halfWidth * (lying ? 2.2 : 1.35);
    if (fade > 0.05) this.fx.shadows.add(x, z, r, lying ? r * 0.55 : r * 0.7, y, this.shadowStrength * Math.min(1, fade + 0.3));
  }

  // -------------------------------------------------------------------------
  // Per-step events (effects, trails bookkeeping)
  // -------------------------------------------------------------------------

  onStepEvents(w: World): void {
    for (const e of w.events) {
      this.fx.onEvent(e, w);
      this.env?.onEvent(e, w);
      this.handleEvent(e, w);
    }
  }

  private handleEvent(e: SimEvent, w: World): void {
    if (e.type === 'telegraph') {
      const v = this.chars.get(e.id);
      const f = w.fighters.find((o) => o.id === e.id);
      if (v && f) {
        v.boneWorldPosition('handR', this.tmpA);
        this.fx.glint(this.tmpA.x, this.tmpA.y + 0.1, this.tmpA.z + 0.2, f.kind === 'boss' ? 0xff9a40 : 0xfff4c0, f.kind === 'boss' ? 1.3 : 0.9);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------

  update(w: World, alpha: number, dt: number): void {
    this.time += dt;
    SHARED.uTime.value = this.time;
    if (w.level.env !== this.envIndex) this.setEnvironment(w.level.env);

    // Camera
    const camX = lerp(w.camera.px, w.camera.x, alpha);
    this.fx.shakeOffset(this.shake);
    let fov: number = CAMERA.fovY;
    let lookShift = 0;
    const cs = w.level.cutscene;
    if (cs) {
      const t = cs.frame / cs.len;
      const k = Math.sin(Math.min(1, t) * Math.PI);
      fov = CAMERA.fovY * (1 - 0.16 * k);
      const boss = w.fighters.find((f) => f.id === cs.bossId);
      if (boss) lookShift = (boss.x - camX) * 0.45 * k;
    }
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(camX + this.shake.x + lookShift, CAMERA_OFFSET.y + this.shake.y, CAMERA_OFFSET.z);
    this.camera.lookAt(camX + this.shake.x * 0.5 + lookShift, CAMERA_OFFSET.lookY + this.shake.y * 0.5, CAMERA_OFFSET.lookZ);

    // Lamp proxies: the nearest lamps get the real point lights.
    if (this.env) {
      const lamps = this.env.look.lamps;
      const near = lamps
        .filter((l) => Math.abs(l.x - camX) < 16)
        .sort((a, b) => Math.abs(a.x - camX) - Math.abs(b.x - camX))
        .slice(0, this.points.length);
      this.points.forEach((p, i) => {
        const l = near[i];
        if (!l) {
          p.intensity = 0;
          return;
        }
        p.position.set(l.x, l.y, l.z);
        p.color.set(l.color);
        p.distance = l.distance;
        const flick = l.flicker ? 1 - l.flicker * (0.5 + 0.5 * Math.sin(this.time * 17 + l.x) * Math.sin(this.time * 9.3 + l.z)) : 1;
        p.intensity = l.intensity * flick;
      });
      this.env.update({ time: this.time, dt, camX, world: w, fx: this.fx });
    }

    // Characters
    this.fx.shadows.begin();
    const seen = new Set<number>();
    for (const f of w.fighters) {
      if (f.removeMe) continue;
      let v = this.chars.get(f.id);
      let fresh = false;
      if (!v) {
        const def = getFighterDef(f.def);
        v = this.acquire(def.model, def.palette);
        this.chars.set(f.id, v);
        fresh = true;
      }
      seen.add(f.id);
      this.syncFighter(f, v, alpha, dt, fresh, w);
    }
    for (const [id, v] of this.chars) {
      if (!seen.has(id)) {
        this.release(v);
        this.chars.delete(id);
        for (const t of this.trails) if (t.owner === id) t.reset();
      }
    }
    this.updateTrails(w);

    // Projectiles
    const pseen = new Set<number>();
    for (const p of w.projectiles) {
      pseen.add(p.id);
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      const z = lerp(p.pz, p.z, alpha);
      if (p.kind === 'shockwave') {
        let ring = this.projRings.get(p.id);
        if (!ring) {
          ring = this.fx.rings.acquire() ?? undefined;
          if (ring) this.projRings.set(p.id, ring);
        }
        if (ring) this.fx.rings.place(ring, p.x, p.z, Math.max(0.3, p.radius), 0xffa040, 2.2, 0.1, 0.0);
        // dust churned up along the wavefront
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          this.fx.smoke.spawn({ x: p.x + Math.cos(a) * p.radius, y: 0.15, z: p.z + Math.sin(a) * p.radius, vy: 1.2, life: 0.45, size: 0.25, sizeEnd: 0.6, color: this.fx.dust, alpha: 0.28, cell: 3, drag: 2 });
          this.fx.sparks.spawn({ x: p.x + Math.cos(a) * p.radius, y: 0.2, z: p.z + Math.sin(a) * p.radius, vy: 2, life: 0.25, size: 0.06, color: 0xffb060, intensity: 2.5, cell: 0 });
        }
        continue;
      }
      let o = this.projViews.get(p.id);
      if (!o) {
        o = jarGroup();
        this.scene.add(o);
        this.projViews.set(p.id, o);
      }
      o.position.set(x, y, z);
      o.rotation.z = -p.age * 0.3 * Math.sign(p.vx || 1);
      this.fx.shadows.add(x, z, 0.2, 0.14, y, 0.6);
      if (p.kind === 'lobJar') {
        let ring = this.projRings.get(p.id);
        if (!ring) {
          ring = this.fx.rings.acquire() ?? undefined;
          if (ring) this.projRings.set(p.id, ring);
        }
        if (ring) this.fx.rings.place(ring, p.targetX, p.targetZ, 0.8 + 0.1 * Math.sin(this.time * 18), 0xff3a2a, 1.4, 0.16, 0.6, 10);
      }
    }
    for (const [id, o] of this.projViews) {
      if (!pseen.has(id)) {
        o.removeFromParent();
        this.projViews.delete(id);
      }
    }
    for (const [id, r] of this.projRings) {
      if (!pseen.has(id)) {
        this.fx.rings.release(r);
        this.projRings.delete(id);
      }
    }

    // Ground items (weapons)
    const iseen = new Set<number>();
    for (const it of w.items) {
      iseen.add(it.id);
      let v = this.itemViews.get(it.id);
      if (!v) {
        const obj = new THREE.Group();
        const mesh = createWeaponMesh(it.type);
        mesh.position.set(0, 0, 0);
        if (it.type === 'jar') {
          mesh.children[0]!.position.set(0, 0.185, 0);
        } else {
          mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + 0.3);
          mesh.position.y = 0.06;
        }
        obj.add(mesh);
        this.scene.add(obj);
        v = { obj };
        this.itemViews.set(it.id, v);
      }
      const x = lerp(it.px, it.x, alpha);
      const y = lerp(it.py, it.y, alpha);
      const z = lerp(it.pz, it.z, alpha);
      v.obj.position.set(x, y, z);
      const ending = it.lifetime >= 0 && it.lifetime - it.age < 150;
      v.obj.visible = !ending || Math.floor(this.time * 12) % 2 === 0;
      if (y > 0.01) v.obj.rotation.y += dt * 8;
      this.fx.shadows.add(x, z, it.type === 'staff' ? 0.9 : 0.35, 0.18, y, 0.5);
      if (Math.random() < dt * 0.8) this.fx.glint(x + (Math.random() - 0.5) * 0.4, y + 0.15, z + 0.1, 0xffe8a0, 0.5);
    }
    for (const [id, v] of this.itemViews) {
      if (!iseen.has(id)) {
        v.obj.removeFromParent();
        this.itemViews.delete(id);
      }
    }

    this.fx.shadows.end();
    this.fx.update(dt);
    this.hitboxes.update(w);

    // Screen fades for environment transitions + flashes.
    const T = w.level.transition;
    let fade = 0;
    if (T) {
      if (T.phase === 'fade') fade = Math.min(1, T.frame / TRANSITION.fadeFrames);
      else if (T.phase === 'enter') fade = Math.max(0, 1 - T.frame / 30);
    }
    this.post.fade = fade;
    this.post.flash = this.fx.flash;
  }

  private updateTrails(w: World): void {
    const used = new Set<Trail>();
    for (const f of w.fighters) {
      const v = this.chars.get(f.id);
      if (!v) continue;
      const bladed = f.def === 'apep' || f.weapon === 'khopesh' || f.weapon === 'staff';
      let emitting = false;
      if (bladed && f.state === 'attack' && f.move) {
        const md = getMove(f.move.id);
        const blade = !!md.weapon || f.def === 'apep' || md.clip.startsWith('khopesh') || md.clip === 'staff_swing' || md.clip === 'br_dash_slash';
        emitting = blade && md.hits.length > 0 && f.move.frame >= md.startup - 2 && f.move.frame <= md.startup + md.active + 2;
      }
      let t = this.trails.find((tr) => tr.owner === f.id);
      if (!t && emitting) {
        t = this.trails.find((tr) => tr.owner === -1 || !tr.mesh.visible);
        if (t) {
          t.reset();
          t.owner = f.id;
          t.setColor(f.def === 'apep' ? 0xc070ff : f.team === 0 ? 0x9ff6ff : 0xff6a50, f.weapon === 'staff' ? 0.8 : 1.4);
        }
      }
      if (!t) continue;
      used.add(t);
      if (v.bladePoints(this.tmpA, this.tmpB)) t.push(this.tmpA, this.tmpB, emitting);
      else t.push(this.tmpA, this.tmpB, false);
    }
    for (const t of this.trails) if (!used.has(t)) {
      t.reset();
      t.owner = -1;
    }
  }

  render(dt: number): void {
    this.renderer.info.reset();
    this.post.render(dt);
    this.lastDrawCalls = this.renderer.info.render.calls;
    this.lastTriangles = this.renderer.info.render.triangles;
    if (this.adaptive) this.adapt(dt);
  }

  /** Simple dynamic resolution: keep ~60 fps on slower GPUs. */
  private adapt(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    this.adaptTimer += dt;
    if (this.adaptTimer < 2 || this.frameTimes.length < 60) return;
    this.adaptTimer = 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
    let next = this.pixelRatio;
    if (p50 > 1 / 52) next = Math.max(0.6, this.pixelRatio - 0.1);
    else if (p50 < 1 / 75) next = Math.min(this.maxPixelRatio, this.pixelRatio + 0.05);
    if (Math.abs(next - this.pixelRatio) > 1e-3) {
      this.pixelRatio = next;
      this.resize(this.width, this.height);
    }
  }
}
