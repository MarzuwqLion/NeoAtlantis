/**
 * Placeholder sound effects, synthesised sample-by-sample into AudioBuffers
 * at start-up. Replace any of them by dropping files into public/audio and
 * listing them in manifest.json (see README).
 */

type Gen = (t: number, i: number) => number;

class Rng {
  private s = 1234567;
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s / 2147483647) * 2 - 1;
  }
}

function env(t: number, a: number, d: number): number {
  if (t < a) return t / a;
  return Math.exp(-(t - a) / d);
}

/** One-pole low-pass and high-pass helpers operating on a running state. */
class Filter {
  private lp = 0;
  private hp = 0;
  private prev = 0;
  low(x: number, k: number): number {
    this.lp += (x - this.lp) * k;
    return this.lp;
  }
  high(x: number, k: number): number {
    this.hp = k * (this.hp + x - this.prev);
    this.prev = x;
    return this.hp;
  }
}

function make(ctx: BaseAudioContext, dur: number, gen: Gen, gain = 0.8): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(dur * sr));
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = gen(i / sr, i);
    d[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const k = peak > 0 ? gain / peak : 1;
  for (let i = 0; i < n; i++) d[i] = d[i]! * k;
  // short fade out to avoid clicks
  const f = Math.min(n, Math.floor(sr * 0.005));
  for (let i = 0; i < f; i++) d[n - 1 - i] = d[n - 1 - i]! * (i / f);
  return buf;
}

const TAU = Math.PI * 2;

export function synthesizeAll(ctx: BaseAudioContext): Map<string, AudioBuffer> {
  const m = new Map<string, AudioBuffer>();
  const r = new Rng();
  const noise = (): number => r.next();

  const thump = (f0: number, f1: number, dur: number, decay: number): Gen => {
    let ph = 0;
    return (t) => {
      const f = f1 + (f0 - f1) * Math.exp(-t / (dur * 0.3));
      ph += (TAU * f) / ctx.sampleRate;
      return Math.sin(ph) * env(t, 0.002, decay);
    };
  };

  {
    const fl = new Filter();
    const th = thump(180, 70, 0.12, 0.05);
    m.set('hit_light', make(ctx, 0.16, (t, i) => th(t, i) * 0.9 + fl.high(fl.low(noise(), 0.35), 0.8) * env(t, 0.001, 0.025) * 0.9, 0.75));
  }
  {
    const fl = new Filter();
    const th = thump(220, 55, 0.2, 0.09);
    m.set('hit_heavy', make(ctx, 0.28, (t, i) => th(t, i) + fl.low(noise(), 0.25) * env(t, 0.001, 0.05) * 0.9, 0.85));
  }
  {
    const fl = new Filter();
    const th = thump(240, 40, 0.35, 0.16);
    m.set('hit_knockdown', make(ctx, 0.5, (t, i) => th(t, i) * 1.1 + fl.low(noise(), 0.18) * env(t, 0.001, 0.08) + Math.sin(TAU * 38 * t) * env(t, 0.01, 0.2) * 0.5, 0.9));
  }
  {
    const fl = new Filter();
    m.set('hit_blade', make(ctx, 0.3, (t) => fl.high(noise(), 0.9) * env(t, 0.001, 0.03) + (Math.sin(TAU * 2350 * t) * 0.3 + Math.sin(TAU * 3170 * t) * 0.25 + Math.sin(TAU * 4410 * t) * 0.15) * env(t, 0.001, 0.09), 0.7));
  }
  {
    const fl = new Filter();
    const th = thump(140, 50, 0.2, 0.1);
    m.set('hit_blunt', make(ctx, 0.3, (t, i) => th(t, i) + fl.low(noise(), 0.12) * env(t, 0.001, 0.06), 0.9));
  }
  {
    const fl = new Filter();
    m.set('hit_armor', make(ctx, 0.35, (t) => fl.high(noise(), 0.95) * env(t, 0.001, 0.02) * 0.6 + (Math.sin(TAU * 1180 * t) + Math.sin(TAU * 1770 * t) * 0.6) * env(t, 0.001, 0.12), 0.65));
  }
  const whoosh = (dur: number, f0: number, f1: number, amp = 0.6): AudioBuffer => {
    const fl = new Filter();
    return make(ctx, dur, (t) => {
      const u = t / dur;
      const k = (f0 + (f1 - f0) * Math.sin(u * Math.PI)) / 8000;
      return fl.low(fl.high(noise(), 0.7), Math.min(0.9, k)) * Math.sin(u * Math.PI) ** 1.5;
    }, amp);
  };
  m.set('whiff', whoosh(0.14, 1200, 3200, 0.5));
  m.set('whiff_heavy', whoosh(0.24, 600, 2000, 0.6));
  m.set('throw', whoosh(0.3, 800, 2600, 0.5));
  m.set('dash', whoosh(0.35, 500, 3800, 0.65));
  m.set('leap', whoosh(0.4, 400, 1800, 0.6));
  m.set('charge_go', whoosh(0.5, 300, 1400, 0.8));
  {
    let ph = 0;
    m.set('jump', make(ctx, 0.12, (t) => {
      ph += (TAU * (300 + t * 3000)) / ctx.sampleRate;
      return (Math.sin(ph) > 0 ? 0.4 : -0.4) * env(t, 0.002, 0.04);
    }, 0.35));
  }
  {
    const fl = new Filter();
    const th = thump(110, 45, 0.1, 0.05);
    m.set('land', make(ctx, 0.16, (t, i) => th(t, i) + fl.low(noise(), 0.1) * env(t, 0.001, 0.03) * 0.6, 0.55));
  }
  const pings = (notes: number[], step: number, decay: number, amp = 0.5): AudioBuffer =>
    make(ctx, notes.length * step + decay * 4, (t) => {
      let v = 0;
      notes.forEach((f, k) => {
        const tt = t - k * step;
        if (tt > 0) v += (Math.sin(TAU * f * tt) + Math.sin(TAU * f * 2.01 * tt) * 0.3) * env(tt, 0.002, decay);
      });
      return v;
    }, amp);
  m.set('weapon_pickup', pings([880, 1320], 0.06, 0.08));
  m.set('ui_move', pings([660], 0.03, 0.03, 0.3));
  m.set('ui_confirm', pings([660, 990], 0.05, 0.06, 0.45));
  m.set('ui_back', pings([660, 440], 0.05, 0.06, 0.4));
  m.set('pause', pings([440, 330], 0.06, 0.08, 0.4));
  m.set('go', pings([660, 0.001, 660], 0.12, 0.05, 0.5));
  m.set('glint', pings([2640, 3960], 0.03, 0.05, 0.3));
  m.set('respawn', pings([523, 659, 784, 1047], 0.07, 0.12, 0.5));
  m.set('stage_clear', pings([523, 659, 784, 1047, 784, 1047], 0.1, 0.18, 0.55));
  m.set('level_clear', pings([392, 523, 659, 784, 659, 784, 1047, 1318], 0.14, 0.3, 0.6));
  m.set('game_over', pings([523, 466, 415, 392, 311], 0.22, 0.25, 0.5));
  m.set('tick', pings([1200], 0.01, 0.02, 0.25));
  {
    const fl = new Filter();
    m.set('weapon_break', make(ctx, 0.5, (t) => fl.high(noise(), 0.85) * env(t, 0.001, 0.08) + Math.sin(TAU * (1600 - t * 1800) * t) * env(t, 0.001, 0.15) * 0.5, 0.7));
  }
  {
    const fl = new Filter();
    m.set('shatter', make(ctx, 0.45, (t) => {
      const grain = Math.sin(t * 180) > 0.6 ? 1 : 0.35;
      return fl.high(noise(), 0.8) * env(t, 0.001, 0.09) * grain;
    }, 0.7));
  }
  {
    let ph = 0;
    const fl = new Filter();
    m.set('enemy_death', make(ctx, 0.6, (t) => {
      ph += (TAU * (420 - t * 500)) / ctx.sampleRate;
      return Math.sin(ph) * env(t, 0.005, 0.2) * 0.6 + fl.low(noise(), 0.1) * env(t, 0.001, 0.25) * 0.4;
    }, 0.55));
  }
  {
    const th = thump(160, 80, 0.15, 0.07);
    let ph = 0;
    m.set('player_hurt', make(ctx, 0.25, (t, i) => {
      ph += (TAU * (140 + Math.sin(t * 60) * 20)) / ctx.sampleRate;
      return th(t, i) + ((ph % TAU) / TAU - 0.5) * env(t, 0.01, 0.06) * 0.4;
    }, 0.7));
  }
  {
    let ph = 0;
    m.set('player_death', make(ctx, 1.2, (t) => {
      ph += (TAU * (330 * Math.pow(0.35, t))) / ctx.sampleRate;
      return (Math.sin(ph) + Math.sin(ph * 1.5) * 0.4) * env(t, 0.01, 0.5);
    }, 0.6));
  }
  {
    const fl = new Filter();
    let ph1 = 0;
    let ph2 = 0;
    m.set('boss_intro', make(ctx, 2.6, (t) => {
      ph1 += (TAU * 55) / ctx.sampleRate;
      ph2 += (TAU * 82.4) / ctx.sampleRate;
      const saw = ((ph1 % TAU) / TAU - 0.5) + ((ph2 % TAU) / TAU - 0.5) * 0.8;
      const swell = Math.min(1, t / 1.2) * Math.exp(-Math.max(0, t - 1.6) / 0.5);
      return fl.low(saw, 0.08) * swell + Math.sin(TAU * 40 * t) * env(t, 0.001, 0.4) * 0.8;
    }, 0.85));
  }
  {
    const fl = new Filter();
    let ph = 0;
    m.set('boss_roar', make(ctx, 1.3, (t) => {
      ph += (TAU * (70 + Math.sin(t * 38) * 12)) / ctx.sampleRate;
      const growl = (ph % TAU) / TAU - 0.5;
      return (fl.low(noise(), 0.15) * 0.6 + growl * 0.8) * Math.sin(Math.min(1, t / 1.3) * Math.PI);
    }, 0.85));
  }
  {
    const fl = new Filter();
    m.set('charge_windup', make(ctx, 0.9, (t) => fl.low(noise(), 0.03 + t * 0.12) * Math.min(1, t * 2) * env(t, 0.6, 0.2), 0.7));
  }
  {
    const fl = new Filter();
    const th = thump(90, 30, 0.5, 0.3);
    m.set('wall_crash', make(ctx, 0.9, (t, i) => th(t, i) * 1.2 + fl.low(noise(), 0.3) * env(t, 0.001, 0.2), 0.95));
    m.set('shockwave', make(ctx, 1.0, (t, i) => th(t, i) + fl.low(noise(), 0.05) * env(t, 0.01, 0.4) * 1.2, 0.95));
  }
  {
    let ph = 0;
    m.set('power_up', make(ctx, 1.4, (t) => {
      ph += (TAU * (200 + t * t * 700)) / ctx.sampleRate;
      return ((ph % TAU) / TAU - 0.5) * Math.min(1, t * 3) * env(t, 1.0, 0.25) * 0.7 + Math.sin(ph * 2) * 0.3 * Math.min(1, t);
    }, 0.7));
  }
  {
    const fl = new Filter();
    m.set('door', make(ctx, 0.6, (t) => fl.low(noise(), 0.05) * env(t, 0.02, 0.2) + Math.sin(TAU * 60 * t) * env(t, 0.02, 0.2) * 0.4, 0.5));
  }
  return m;
}
