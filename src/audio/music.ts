/**
 * Placeholder music: a tiny step sequencer (bass, arp lead, pad, drums) with
 * one pattern per music slot. Real tracks listed in the manifest replace it.
 */

interface Song {
  bpm: number;
  root: number;
  scale: number[];
  bass: (number | null)[];
  lead: (number | null)[];
  pad: number[];
  kick: string;
  snare: string;
  hat: string;
  leadWave: OscillatorType;
  swing: number;
  cutoff: number;
}

const PHRYGIAN_DOM = [0, 1, 4, 5, 7, 8, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const HARM_MINOR = [0, 2, 3, 5, 7, 8, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const _ = null;

export const SONGS: Record<string, Song> = {
  title: {
    bpm: 84, root: 50, scale: PHRYGIAN_DOM,
    bass: [0, _, _, _, _, _, _, _, 5, _, _, _, 4, _, _, _],
    lead: [7, _, _, 9, _, _, 11, _, 9, _, _, 8, _, _, 7, _],
    pad: [0, 4, 7],
    kick: 'x.......x.......', snare: '................', hat: '....x.......x...',
    leadWave: 'triangle', swing: 0, cutoff: 900,
  },
  env_docks: {
    bpm: 100, root: 38, scale: MINOR,
    bass: [0, _, 0, _, _, 0, _, 7, 5, _, 5, _, _, 3, _, 4],
    lead: [_, _, 14, _, 12, _, _, 10, _, _, 11, _, 9, _, _, _],
    pad: [0, 3, 7],
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
    leadWave: 'square', swing: 0.08, cutoff: 1400,
  },
  env_bazaar: {
    bpm: 108, root: 40, scale: PHRYGIAN_DOM,
    bass: [0, _, 0, 1, _, 0, _, 4, 0, _, 0, 1, _, 4, 3, 1],
    lead: [7, 8, 7, 5, 4, _, 5, 4, 1, _, 0, _, 1, 4, 5, _],
    pad: [0, 4, 7],
    kick: 'x..x..x...x..x..', snare: '....x..x....x...', hat: 'x.xxx.xxx.xxx.xx',
    leadWave: 'sawtooth', swing: 0.12, cutoff: 1800,
  },
  env_tube: {
    bpm: 124, root: 45, scale: MINOR,
    bass: [0, 0, 7, 0, 0, 7, 0, 5, 0, 0, 7, 0, 3, 3, 5, 5],
    lead: [0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 11, 9, 7, 4],
    pad: [0, 3, 7],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    leadWave: 'square', swing: 0, cutoff: 2200,
  },
  env_temple: {
    bpm: 92, root: 36, scale: HARM_MINOR,
    bass: [0, _, _, 0, _, _, 1, _, 0, _, _, 0, _, 4, 5, 6],
    lead: [7, _, 8, _, 7, _, 6, _, 4, _, _, _, 6, _, 7, _],
    pad: [0, 3, 7],
    kick: 'x......xx.......', snare: '....x.......x..x', hat: 'x...x...x...x...',
    leadWave: 'triangle', swing: 0.05, cutoff: 1100,
  },
  boss_mid: {
    bpm: 138, root: 40, scale: PHRYGIAN_DOM,
    bass: [0, 0, 1, 0, 0, 0, 4, 3, 0, 0, 1, 0, 5, 4, 3, 1],
    lead: [7, _, 7, 8, 7, _, 4, _, 7, _, 8, 10, 11, 10, 8, 7],
    pad: [0, 1, 4],
    kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    leadWave: 'sawtooth', swing: 0, cutoff: 2600,
  },
  boss_final: {
    bpm: 150, root: 38, scale: HARM_MINOR,
    bass: [0, 0, 0, 1, 0, 0, 6, 5, 0, 0, 0, 1, 7, 6, 5, 4],
    lead: [7, 6, 7, 11, 12, 11, 7, 6, 4, 6, 7, 8, 7, 6, 4, 2],
    pad: [0, 3, 6],
    kick: 'x.xx..x.x.xx..x.', snare: '....x.......x.xx', hat: 'x.x.x.x.x.x.x.x.',
    leadWave: 'sawtooth', swing: 0, cutoff: 3000,
  },
  level_clear: {
    bpm: 112, root: 48, scale: MAJOR,
    bass: [0, _, 4, _, 5, _, 4, _, 0, _, 4, _, 5, _, 6, _],
    lead: [7, 9, 11, 14, 11, 9, 7, 4, 7, 9, 11, 14, 16, 14, 11, 9],
    pad: [0, 4, 7],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    leadWave: 'triangle', swing: 0, cutoff: 2400,
  },
  game_over: {
    bpm: 70, root: 45, scale: MINOR,
    bass: [0, _, _, _, 5, _, _, _, 3, _, _, _, 4, _, _, _],
    lead: [7, _, _, _, 5, _, _, _, 3, _, _, _, 2, _, _, _],
    pad: [0, 3, 7],
    kick: '................', snare: '................', hat: '................',
    leadWave: 'sine', swing: 0, cutoff: 700,
  },
};

function midiToHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export class MusicSynth {
  private song: Song | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private readonly bus: GainNode;
  private readonly noise: AudioBuffer;
  private bar = 0;

  constructor(private readonly ctx: AudioContext, out: AudioNode) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(out);
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  play(slot: string): void {
    const song = SONGS[slot] ?? SONGS.env_docks!;
    this.song = song;
    this.step = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    const g = this.bus.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.6);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(fade = 0.5): void {
    const g = this.bus.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
    window.setTimeout(() => {
      if (this.bus.gain.value < 0.01) {
        this.song = null;
        if (this.timer !== null) {
          window.clearInterval(this.timer);
          this.timer = null;
        }
      }
    }, fade * 1000 + 50);
  }

  private schedule(): void {
    const s = this.song;
    if (!s) return;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const i = this.step % 16;
      const swing = i % 2 === 1 ? s.swing * stepDur : 0;
      const t = this.nextTime + swing;
      this.playStep(s, i, t, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
  }

  private note(deg: number, s: Song, octave = 0): number {
    const len = s.scale.length;
    const o = Math.floor(deg / len);
    const d = ((deg % len) + len) % len;
    return s.root + 12 * (o + octave) + s.scale[d]!;
  }

  private playStep(s: Song, i: number, t: number, dur: number): void {
    // i - i - VI - iv style progression: bass and pad move, the lead motif stays.
    const shift = [0, 0, 5, 3][this.bar % 4]!;
    const b = s.bass[i];
    if (b !== null && b !== undefined) this.tone(midiToHz(this.note(b + shift, s)), t, dur * 1.8, 'sawtooth', 0.22, s.cutoff * 0.35);
    const l = s.lead[i];
    if (l !== null && l !== undefined && this.bar % 2 === 1) this.tone(midiToHz(this.note(l, s, 2)), t, dur * 1.6, s.leadWave, 0.07, s.cutoff);
    if (i === 0 && this.bar % 2 === 0) for (const p of s.pad) this.tone(midiToHz(this.note(p + shift, s, 1)), t, dur * 30, 'sawtooth', 0.035, 900, 0.8);
    if (s.kick[i] === 'x') this.kick(t);
    if (s.snare[i] === 'x') this.drumNoise(t, 0.16, 1800, 0.18, true);
    if (s.hat[i] === 'x') this.drumNoise(t, 0.04, 7000, 0.06, false);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack = 0.005): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  private drumNoise(t: number, dur: number, freq: number, vol: number, band: boolean): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = band ? 'bandpass' : 'highpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
