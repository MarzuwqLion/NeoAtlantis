/**
 * Audio manager: named sound events and music slots, driven by
 * public/audio/manifest.json. Any entry without a file falls back to a
 * synthesised placeholder, so the game is never silent.
 */
import { synthesizeAll } from './synth';
import { MusicSynth } from './music';

export interface AudioManifest {
  sfx: Record<string, string[]>;
  music: Record<string, string>;
}

export interface PlayOptions {
  volume?: number;
  rate?: number;
  /** -1 left .. 1 right */
  pan?: number;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private readonly files = new Map<string, AudioBuffer[]>();
  private readonly musicFiles = new Map<string, AudioBuffer>();
  private synth = new Map<string, AudioBuffer>();
  private synthMusic: MusicSynth | null = null;
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private currentSlot = '';
  private loading: Promise<void> | null = null;
  readonly volumes = { master: 0.9, music: 0.5, sfx: 0.9 };
  /** Throttle identical sounds fired in the same few milliseconds. */
  private readonly lastPlayed = new Map<string, number>();

  get ready(): boolean {
    return !!this.ctx;
  }

  /** Must be called from a user gesture (the "press any button" screen). */
  unlock(): Promise<void> {
    if (this.loading) {
      void this.ctx?.resume();
      return this.loading;
    }
    this.loading = this.init();
    return this.loading;
  }

  private async init(): Promise<void> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    void ctx.resume();
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.volumes.sfx;
    this.sfxBus.connect(this.master);
    this.synth = synthesizeAll(ctx);
    this.synthMusic = new MusicSynth(ctx, this.musicBus);
    await this.loadManifest();
  }

  private async loadManifest(): Promise<void> {
    let manifest: AudioManifest | null = null;
    try {
      const res = await fetch('audio/manifest.json', { cache: 'no-cache' });
      if (res.ok) manifest = (await res.json()) as AudioManifest;
    } catch {
      manifest = null;
    }
    if (!manifest || !this.ctx) return;
    const ctx = this.ctx;
    const load = async (path: string): Promise<AudioBuffer | null> => {
      try {
        const r = await fetch(`audio/${path}`);
        if (!r.ok) return null;
        return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch {
        return null;
      }
    };
    const jobs: Promise<void>[] = [];
    for (const [name, paths] of Object.entries(manifest.sfx ?? {})) {
      for (const p of paths ?? []) {
        if (!p) continue;
        jobs.push(
          load(p).then((buf) => {
            if (!buf) return;
            const list = this.files.get(name) ?? [];
            list.push(buf);
            this.files.set(name, list);
          }),
        );
      }
    }
    for (const [slot, path] of Object.entries(manifest.music ?? {})) {
      if (!path) continue;
      jobs.push(
        load(path).then((buf) => {
          if (buf) this.musicFiles.set(slot, buf);
        }),
      );
    }
    await Promise.all(jobs);
    // If the current slot got a real track after loading, switch to it.
    if (this.currentSlot && this.musicFiles.has(this.currentSlot)) {
      const s = this.currentSlot;
      this.currentSlot = '';
      this.playMusic(s);
    }
  }

  play(name: string, o: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.025) return;
    this.lastPlayed.set(name, now);
    const list = this.files.get(name);
    const buf = list && list.length ? list[Math.floor(Math.random() * list.length)]! : this.synth.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = o.volume ?? 1;
    let node: AudioNode = src.connect(g);
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      node = node.connect(p);
    }
    node.connect(this.sfxBus);
    src.start();
  }

  playMusic(slot: string): void {
    if (slot === this.currentSlot) return;
    this.currentSlot = slot;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.stopFileMusic(0.6);
    const file = this.musicFiles.get(slot);
    if (file) {
      this.synthMusic?.stop(0.4);
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
      src.connect(g).connect(this.musicBus);
      src.start();
      this.musicSrc = src;
      this.musicGain = g;
    } else {
      this.synthMusic?.play(slot);
    }
  }

  stopMusic(fade = 0.8): void {
    this.currentSlot = '';
    this.stopFileMusic(fade);
    this.synthMusic?.stop(fade);
  }

  private stopFileMusic(fade: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicSrc || !this.musicGain) return;
    const src = this.musicSrc;
    const g = this.musicGain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    src.stop(ctx.currentTime + fade + 0.05);
    this.musicSrc = null;
    this.musicGain = null;
  }

  /** Duck the music while paused. */
  setPaused(paused: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(paused ? this.volumes.music * 0.3 : this.volumes.music, ctx.currentTime + 0.25);
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes.master = master;
    this.volumes.music = music;
    this.volumes.sfx = sfx;
    if (this.master) this.master.gain.value = master;
    if (this.musicBus) this.musicBus.gain.value = music;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
  }
}
