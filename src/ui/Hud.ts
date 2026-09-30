/**
 * In-game HUD (HTML/CSS overlay): player health / lives / score / weapon,
 * name and bar of the last enemy hit, combo counter, boss bar, GO arrow,
 * stage title card and boss name card.
 */
import type { World } from '../sim/types';
import { getFighterDef } from '../data/fighters';
import { getEnv } from '../data/level';
import { WEAPONS } from '../data/weapons';
import { MIDBOSS, FINALBOSS } from '../data/bosses';
import { findFighter } from '../sim/fighter';

const FALCON_SVG = `<svg viewBox="0 0 64 64"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset="1" stop-color="#c8862a"/></linearGradient></defs><path d="M10 34 C10 18 22 8 36 8 C48 8 56 16 56 26 L46 28 L52 34 L40 34 C40 44 34 54 22 56 C16 50 10 44 10 34 Z" fill="#f2eee4" stroke="#1a2130" stroke-width="2"/><path d="M36 8 C48 8 56 16 56 26 L46 28 Z" fill="url(#hg)"/><path d="M14 26 C20 14 30 12 40 14 L36 22 Z" fill="#2c5fa8"/><circle cx="38" cy="24" r="3.4" fill="#5ff2ff"/><path d="M30 30 L26 44 M34 30 C38 36 36 42 32 44" stroke="#5ff2ff" stroke-width="2" fill="none"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpLag: HTMLDivElement;
  private readonly lives: HTMLDivElement;
  private readonly score: HTMLDivElement;
  private readonly weapon: HTMLDivElement;
  private readonly enemy: HTMLDivElement;
  private readonly enemyName: HTMLDivElement;
  private readonly enemyFill: HTMLDivElement;
  private readonly combo: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private readonly bossName: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossLag: HTMLDivElement;
  private readonly go: HTMLDivElement;
  private readonly stageCard: HTMLDivElement;
  private readonly stageNum: HTMLDivElement;
  private readonly stageTitle: HTMLDivElement;
  private readonly bossCard: HTMLDivElement;
  private readonly bossCardName: HTMLDivElement;
  private readonly bossCardTitle: HTMLDivElement;
  private lagHp = 1;
  private lagBoss = 1;
  private lastScore = -1;
  private lastLives = -1;
  private lastEnemy = '';
  private comboShow = 0;
  private lastCombo = 0;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent);
    const p1 = el('div', 'hud-p1', this.root);
    el('div', 'hud-portrait', p1, FALCON_SVG);
    const info = el('div', 'hud-info', p1);
    const top = el('div', 'hud-row', info);
    el('div', 'hud-name', top, 'HERU');
    this.lives = el('div', 'hud-lives', top);
    this.score = el('div', 'hud-score', top);
    const bar = el('div', 'hud-bar', info);
    this.hpLag = el('div', 'hud-bar-lag', bar);
    this.hpFill = el('div', 'hud-bar-fill', bar);
    el('div', 'hud-bar-ticks', bar);
    this.weapon = el('div', 'hud-weapon', info);
    this.enemy = el('div', 'hud-enemy', info);
    this.enemyName = el('div', 'hud-enemy-name', this.enemy);
    const ebar = el('div', 'hud-ebar', this.enemy);
    this.enemyFill = el('div', 'hud-ebar-fill', ebar);
    this.combo = el('div', 'hud-combo', this.root);
    this.boss = el('div', 'hud-boss', this.root);
    this.bossName = el('div', 'hud-boss-name', this.boss);
    const bb = el('div', 'hud-boss-bar', this.boss);
    this.bossLag = el('div', 'hud-boss-lag', bb);
    this.bossFill = el('div', 'hud-boss-fill', bb);
    this.go = el('div', 'hud-go', this.root, 'GO<span class="hud-go-arrow">&#10148;</span>');
    this.stageCard = el('div', 'stage-card', this.root);
    this.stageNum = el('div', 'stage-card-num', this.stageCard);
    el('div', 'stage-card-line', this.stageCard);
    this.stageTitle = el('div', 'stage-card-title', this.stageCard);
    this.bossCard = el('div', 'boss-card', this.root);
    el('div', 'boss-card-warn', this.bossCard, 'WARNING');
    this.bossCardName = el('div', 'boss-card-name', this.bossCard);
    this.bossCardTitle = el('div', 'boss-card-title', this.bossCard);
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  update(w: World, dt: number): void {
    const slot = w.players[0];
    if (!slot) return;
    const me = findFighter(w, slot.fighterId);
    const hp = me ? Math.max(0, me.hp / me.maxHp) : 0;
    this.hpFill.style.width = `${hp * 100}%`;
    this.hpFill.classList.toggle('low', hp < 0.3);
    this.lagHp = Math.max(hp, this.lagHp - dt * 0.35);
    this.hpLag.style.width = `${this.lagHp * 100}%`;
    if (slot.lives !== this.lastLives) {
      this.lastLives = slot.lives;
      this.lives.textContent = `×${slot.lives}`;
    }
    if (slot.score !== this.lastScore) {
      this.lastScore = slot.score;
      this.score.textContent = String(slot.score).padStart(7, '0');
    }
    // Weapon + durability pips
    if (me && me.weapon) {
      const wd = WEAPONS[me.weapon];
      const pips = wd.thrown ? '' : `<span class="pips">${'<i></i>'.repeat(Math.max(0, me.weaponDurability))}</span>`;
      const html = `${wd.name}${pips}`;
      if (this.weapon.innerHTML !== html) this.weapon.innerHTML = html;
      this.weapon.style.opacity = '1';
    } else {
      this.weapon.style.opacity = '0';
    }
    // Last enemy hit
    const t = slot.lastTargetTimer > 0 ? findFighter(w, slot.lastTargetId) : undefined;
    if (t && t.kind !== 'boss') {
      const def = getFighterDef(t.def);
      if (def.name !== this.lastEnemy) {
        this.lastEnemy = def.name;
        this.enemyName.textContent = def.name;
      }
      this.enemyFill.style.width = `${Math.max(0, t.hp / t.maxHp) * 100}%`;
      this.enemy.style.opacity = '1';
    } else {
      this.enemy.style.opacity = '0';
    }
    // Combo counter
    if (slot.comboCount >= 3 && slot.comboTimer > 0) {
      if (slot.comboCount !== this.lastCombo) {
        this.combo.innerHTML = `<b>${slot.comboCount}</b> HITS`;
        this.combo.classList.remove('pop');
        void this.combo.offsetWidth;
        this.combo.classList.add('pop');
        this.lastCombo = slot.comboCount;
      }
      this.comboShow = 1;
    } else {
      this.comboShow = Math.max(0, this.comboShow - dt * 2);
      if (slot.comboTimer <= 0) this.lastCombo = 0;
    }
    this.combo.style.opacity = String(this.comboShow);
    // Boss bar
    const boss = w.level.bossId >= 0 ? findFighter(w, w.level.bossId) : undefined;
    if (boss && !w.level.cutscene) {
      const def = getFighterDef(boss.def);
      const title = boss.def === 'sobekhan' ? MIDBOSS.title : FINALBOSS.title;
      const phase = boss.boss && boss.boss.phase === 2 ? ' <em>II</em>' : '';
      const html = `${def.name}<span>${title}</span>${phase}`;
      if (this.bossName.innerHTML !== html) this.bossName.innerHTML = html;
      const f = Math.max(0, boss.hp / boss.maxHp);
      this.bossFill.style.width = `${f * 100}%`;
      this.lagBoss = Math.max(f, this.lagBoss - dt * 0.25);
      this.bossLag.style.width = `${this.lagBoss * 100}%`;
      this.boss.classList.add('on');
    } else {
      this.boss.classList.remove('on');
      this.lagBoss = 1;
    }
    // GO arrow
    this.go.classList.toggle('on', w.level.goTimer > 0 || (w.level.exitOpen && !w.level.transition && !w.level.active));
    // Stage title card
    const env = getEnv(w.level.env);
    const showStage = w.level.titleTimer > 0 && w.level.titleTimer < 240;
    if (showStage) {
      this.stageNum.textContent = env.stage;
      this.stageTitle.textContent = env.name;
    }
    this.stageCard.classList.toggle('on', showStage && w.level.titleTimer > 25);
    // Boss name card during the intro
    const cs = w.level.cutscene;
    if (cs && boss) {
      const data = boss.def === 'sobekhan' ? MIDBOSS : FINALBOSS;
      this.bossCardName.textContent = getFighterDef(boss.def).name;
      this.bossCardTitle.textContent = data.title;
      this.bossCard.classList.toggle('on', cs.frame >= data.cardAt && cs.frame < cs.len - 18);
    } else {
      this.bossCard.classList.remove('on');
    }
  }
}
