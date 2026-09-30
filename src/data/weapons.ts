/**
 * Weapons and projectiles.
 */
import type { WeaponType, ProjectileKind } from '../sim/types';
import type { WeaponDef, ProjectileDef } from './defs';

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  khopesh: {
    name: 'KHOPESH',
    durability: 14,
    move: 'khopesh_1',
    thrown: false,
    groundLifetime: 900,
    reach: 0.75,
  },
  staff: {
    name: 'WAS STAFF',
    durability: 9,
    move: 'staff_swing',
    thrown: false,
    groundLifetime: 900,
    reach: 0.85,
  },
  jar: {
    name: 'CLAY JAR',
    durability: 1,
    move: 'jar_throw',
    thrown: true,
    groundLifetime: 900,
    reach: 0.7,
  },
};

export const PROJECTILES: Record<ProjectileKind, ProjectileDef> = {
  /** Jar thrown by the player: flies along the lane, shatters on impact. */
  jar: {
    gravity: 0.0045,
    radius: 0.32,
    height: 0.55,
    speedX: 0.23,
    speedY: 0.055,
    maxAge: 150,
    hit: {
      box: { x0: -0.32, x1: 0.32, y0: -0.3, y1: 0.3 },
      zRange: 0.45,
      damage: 16,
      type: 'knockdown',
      launchX: 0.12,
      launchY: 0.13,
      spark: 'shatter',
      hitstop: 9,
      shake: 0.3,
    },
  },
  /** Jar lobbed by throwers: arcs to the player's position, splashes on landing. */
  lobJar: {
    gravity: 0.0085,
    radius: 0.3,
    height: 0.5,
    lob: { perMeter: 5.2, min: 32, max: 58 },
    maxAge: 200,
    hit: {
      box: { x0: -0.3, x1: 0.3, y0: -0.3, y1: 0.3 },
      zRange: 0.4,
      damage: 9,
      type: 'knockdown',
      launchX: 0.1,
      launchY: 0.12,
      spark: 'shatter',
      hitstop: 8,
    },
    splash: {
      radius: 0.95,
      zRange: 0.5,
      hit: {
        box: { x0: 0, x1: 0, y0: 0, y1: 0.6 },
        damage: 9,
        type: 'knockdown',
        launchX: 0.1,
        launchY: 0.12,
        spark: 'shatter',
        hitstop: 8,
      },
    },
  },
  /** Mid-boss ground slam: an expanding ring you have to jump. */
  shockwave: {
    gravity: 0,
    radius: 0,
    height: 0.6,
    maxAge: 90,
    ring: { speed: 0.125, maxRadius: 9.5, thickness: 0.6 },
    hit: {
      box: { x0: 0, x1: 0, y0: 0, y1: 0.6 },
      damage: 12,
      type: 'knockdown',
      launchX: 0.12,
      launchY: 0.13,
      spark: 'energy',
      hitstop: 8,
      shake: 0.3,
    },
  },
};
