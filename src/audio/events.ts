/**
 * Maps simulation events to named sound events. Names match the keys in
 * public/audio/manifest.json and the synthesised placeholders.
 */
import type { SimEvent, World } from '../sim/types';
import type { AudioManager } from './AudioManager';
import { viewHalfWidthAt } from '../sim/view';

export const SFX_NAMES = [
  'hit_light', 'hit_heavy', 'hit_knockdown', 'hit_blade', 'hit_blunt', 'hit_armor',
  'whiff', 'whiff_heavy', 'jump', 'land', 'throw', 'shatter', 'dash', 'leap',
  'weapon_pickup', 'weapon_break', 'enemy_death', 'player_hurt', 'player_death', 'respawn',
  'boss_intro', 'boss_roar', 'charge_windup', 'charge_go', 'wall_crash', 'shockwave', 'glint', 'power_up', 'door',
  'go', 'stage_clear', 'level_clear', 'game_over', 'tick',
  'ui_move', 'ui_confirm', 'ui_back', 'pause',
] as const;

export const MUSIC_SLOTS = ['title', 'env_docks', 'env_bazaar', 'env_tube', 'env_temple', 'boss_mid', 'boss_final', 'level_clear', 'game_over'] as const;

function panFor(w: World, x: number): number {
  return Math.max(-0.8, Math.min(0.8, (x - w.camera.x) / (viewHalfWidthAt(0) * 1.2)));
}

function rate(): number {
  return 0.94 + Math.random() * 0.12;
}

export function playEventSounds(a: AudioManager, e: SimEvent, w: World): void {
  switch (e.type) {
    case 'hit': {
      const pan = panFor(w, e.x);
      let name = 'hit_light';
      if (e.blocked) name = 'hit_armor';
      else if (e.spark === 'blade') name = 'hit_blade';
      else if (e.spark === 'shatter') name = 'shatter';
      else if (e.hitType === 'knockdown') name = 'hit_knockdown';
      else if (e.hitType === 'heavy') name = e.spark === 'blunt' ? 'hit_blunt' : 'hit_heavy';
      a.play(name, { pan, rate: rate() });
      if (e.spark === 'blade' && e.hitType !== 'light') a.play('hit_heavy', { pan, volume: 0.5, rate: rate() });
      const t = w.fighters.find((f) => f.id === e.target);
      if (t && t.player >= 0 && !e.blocked) a.play('player_hurt', { pan, volume: 0.8, rate: rate() });
      break;
    }
    case 'whiff': {
      const f = w.fighters.find((o) => o.id === e.id);
      a.play(e.heavy ? 'whiff_heavy' : 'whiff', { pan: f ? panFor(w, f.x) : 0, volume: f && f.player >= 0 ? 0.8 : 0.55, rate: rate() });
      break;
    }
    case 'sfx':
      a.play(e.name, { pan: panFor(w, e.x) });
      break;
    case 'jump': {
      const f = w.fighters.find((o) => o.id === e.id);
      a.play('jump', { volume: f && f.player >= 0 ? 0.6 : 0.3, pan: f ? panFor(w, f.x) : 0 });
      break;
    }
    case 'land': {
      const f = w.fighters.find((o) => o.id === e.id);
      a.play('land', { volume: e.heavy ? 1 : 0.45, rate: f && f.kind === 'boss' ? 0.7 : rate(), pan: f ? panFor(w, f.x) : 0 });
      break;
    }
    case 'bounce':
      a.play('land', { volume: 0.7, pan: panFor(w, e.x), rate: 0.9 });
      break;
    case 'death':
      if (e.kind === 'player') a.play('player_death');
      else a.play('enemy_death', { volume: 0.7, rate: rate() });
      break;
    case 'weaponPickup':
      a.play('weapon_pickup');
      break;
    case 'weaponBreak':
      a.play('weapon_break', { pan: panFor(w, e.x) });
      break;
    case 'throw':
      a.play('throw', { volume: 0.7 });
      break;
    case 'shatter':
      a.play('shatter', { pan: panFor(w, e.x), rate: rate() });
      break;
    case 'shockwave':
      a.play('shockwave', { volume: e.big ? 0.9 : 1 });
      break;
    case 'telegraph': {
      const f = w.fighters.find((o) => o.id === e.id);
      if (f) a.play('glint', { volume: f.kind === 'boss' ? 0.6 : 0.3, pan: panFor(w, f.x) });
      break;
    }
    case 'spawn':
      if (e.from === 'door') a.play('door', { volume: 0.6 });
      break;
    case 'bossIntro':
      a.play('boss_intro');
      break;
    case 'bossPhase':
      a.play('power_up');
      a.play('boss_roar', { rate: 1.3, volume: 0.7 });
      break;
    case 'bossDefeated':
      a.play('hit_knockdown', { rate: 0.7 });
      a.play('boss_roar', { rate: 0.8, volume: 0.8 });
      break;
    case 'respawn':
      a.play('respawn');
      break;
    case 'go':
      a.play('go');
      break;
    case 'gameOver':
      a.play('game_over');
      break;
    case 'levelClear':
      a.play('level_clear');
      break;
    default:
      break;
  }
}
