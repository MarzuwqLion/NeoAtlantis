/**
 * The level: Neo Atlantis. Four environments, each with locked encounters
 * made of waves. Spawn z is normalised (-1 = back edge of the lane, +1 = front).
 * x offsets on door / drop spawns are relative to the encounter lock point.
 *
 * A wave starts once `whenRemaining` or fewer enemies of the encounter are
 * still alive, after `delay` frames. Each spawn can be delayed further.
 */
import type { EnvDef } from './defs';

export const LEVEL_NAME = 'NEO ATLANTIS';

export const ENVIRONMENTS: EnvDef[] = [
  // -------------------------------------------------------------------------
  // 1. Harbor Docks — grunts and the first weapon.
  // -------------------------------------------------------------------------
  {
    id: 'docks',
    name: 'HARBOR DOCKS',
    stage: 'STAGE 1',
    length: 100,
    zMin: -3.0,
    zMax: 3.0,
    music: 'env_docks',
    startX: 3,
    healOnEnter: 0.5,
    doors: [{ x: 43 }, { x: 60 }, { x: 88 }],
    items: [
      { type: 'staff', x: 21, z: 0.4 },
      { type: 'jar', x: 45, z: -0.4 },
      { type: 'jar', x: 64, z: 0.5 },
    ],
    encounters: [
      {
        name: 'Pier Gate',
        trigger: 12,
        lockX: 18,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'grunt', from: 'right', z: -0.3 },
              { type: 'grunt', from: 'right', z: 0.5, delay: 45 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt', from: 'left', z: 0.2 },
              { type: 'grunt', from: 'right', z: -0.6, delay: 30 },
            ],
          },
        ],
      },
      {
        name: 'Cargo Stacks',
        trigger: 34,
        lockX: 40,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'grunt', from: 'right', z: 0 },
              { type: 'grunt', from: 'door', x: 3, z: -1, delay: 30 },
              { type: 'grunt', from: 'left', z: 0.6, delay: 60 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt', from: 'right', z: -0.4, weapon: 'staff' },
              { type: 'grunt', from: 'right', z: 0.5, delay: 40 },
            ],
          },
        ],
      },
      {
        name: 'Submarine Pens',
        trigger: 56,
        lockX: 62,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'grunt', from: 'right', z: -0.5 },
              { type: 'grunt', from: 'left', z: 0.5, delay: 20 },
              { type: 'grunt', from: 'right', z: 0.3, delay: 60 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt_elite', from: 'right', z: 0 },
              { type: 'grunt', from: 'door', x: -2, z: -1, delay: 20 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt', from: 'left', z: -0.2 },
              { type: 'grunt', from: 'right', z: 0.6, delay: 30 },
              { type: 'grunt', from: 'drop', x: 2, z: 0, delay: 60 },
            ],
          },
        ],
      },
      {
        name: 'Crane Yard',
        trigger: 78,
        lockX: 85,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'grunt', from: 'right', z: -0.3, weapon: 'staff' },
              { type: 'grunt', from: 'drop', x: -3, z: 0.4, delay: 30 },
              { type: 'grunt', from: 'drop', x: 3, z: -0.5, delay: 45 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt_elite', from: 'right', z: 0.2 },
              { type: 'grunt', from: 'left', z: -0.5, delay: 30 },
              { type: 'grunt', from: 'door', x: 3, z: -1, delay: 60 },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. Bazaar Avenue — blade runners, throwers, mid-boss.
  // -------------------------------------------------------------------------
  {
    id: 'bazaar',
    name: 'BAZAAR AVENUE',
    stage: 'STAGE 2',
    length: 112,
    zMin: -3.0,
    zMax: 3.0,
    music: 'env_bazaar',
    startX: 3,
    healOnEnter: 0.5,
    doors: [{ x: 20 }, { x: 41 }, { x: 64 }, { x: 70 }],
    items: [
      { type: 'khopesh', x: 26, z: -0.2 },
      { type: 'jar', x: 50, z: 0.5 },
      { type: 'staff', x: 74, z: 0 },
    ],
    encounters: [
      {
        name: 'Spice Row',
        trigger: 12,
        lockX: 18,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'grunt', from: 'right', z: -0.4 },
              { type: 'bladeRunner', from: 'right', z: 0.4, delay: 40 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'bladeRunner', from: 'left', z: -0.3 },
              { type: 'grunt', from: 'door', x: 2, z: -1, delay: 30 },
              { type: 'grunt', from: 'right', z: 0.6, delay: 50 },
            ],
          },
        ],
      },
      {
        name: 'Glyph Market',
        trigger: 36,
        lockX: 43,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'thrower', from: 'right', z: -0.6 },
              { type: 'grunt', from: 'right', z: 0.3, delay: 20 },
              { type: 'grunt', from: 'left', z: 0, delay: 40 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'thrower', from: 'left', z: 0.6 },
              { type: 'bladeRunner', from: 'right', z: -0.2, delay: 30 },
              { type: 'grunt', from: 'door', x: -2, z: -1, delay: 50 },
            ],
          },
        ],
      },
      {
        name: 'Lantern Square',
        trigger: 60,
        lockX: 67,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'bladeRunner', from: 'right', z: -0.5 },
              { type: 'bladeRunner', from: 'left', z: 0.5, delay: 30 },
              { type: 'thrower', from: 'right', z: 0, delay: 60 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt', from: 'door', x: 3, z: -1 },
              { type: 'grunt', from: 'door', x: -3, z: -1, delay: 20 },
              { type: 'grunt_elite', from: 'right', z: 0.3, delay: 40 },
            ],
          },
        ],
      },
      {
        name: 'Warden Gate',
        trigger: 88,
        lockX: 97,
        boss: 'sobekhan',
        bossX: 3.6,
        waves: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. Transit Tube — bruisers, acrobats, the moving tram.
  // -------------------------------------------------------------------------
  {
    id: 'tube',
    name: 'TRANSIT TUBE',
    stage: 'STAGE 3',
    length: 108,
    zMin: -2.6,
    zMax: 2.6,
    music: 'env_tube',
    startX: 3,
    healOnEnter: 0.5,
    doors: [{ x: 17 }, { x: 91 }],
    items: [
      { type: 'jar', x: 26, z: 0.4 },
      { type: 'staff', x: 58, z: -0.3 },
      { type: 'khopesh', x: 80, z: 0.2 },
    ],
    encounters: [
      {
        name: 'Departure Hall',
        trigger: 12,
        lockX: 18,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'bruiser', from: 'right', z: 0 },
              { type: 'grunt', from: 'left', z: -0.5, delay: 30 },
              { type: 'grunt', from: 'right', z: 0.6, delay: 50 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt', from: 'door', x: -1, z: -1 },
              { type: 'thrower', from: 'right', z: 0.5, delay: 40 },
            ],
          },
        ],
      },
      {
        name: 'Tram Line',
        trigger: 32,
        lockX: 42,
        tram: true,
        waves: [
          {
            whenRemaining: 0,
            delay: 130,
            spawns: [
              { type: 'acrobat', from: 'leap', z: 0 },
              { type: 'grunt', from: 'drop', x: -2, z: -0.4, delay: 30 },
              { type: 'grunt', from: 'drop', x: 3, z: 0.5, delay: 50 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'acrobat', from: 'leap', z: 0.3 },
              { type: 'bladeRunner', from: 'drop', x: 1, z: -0.5, delay: 30 },
            ],
          },
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'bruiser', from: 'drop', x: 2, z: 0 },
              { type: 'grunt', from: 'drop', x: -3, z: 0.6, delay: 40 },
            ],
          },
        ],
      },
      {
        name: 'Seabed Crossing',
        trigger: 64,
        lockX: 71,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'acrobat', from: 'leap', z: -0.4 },
              { type: 'acrobat', from: 'leap', z: 0.5, delay: 40 },
              { type: 'thrower', from: 'right', z: 0, delay: 60 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'bruiser', from: 'right', z: -0.3 },
              { type: 'bladeRunner', from: 'left', z: 0.4, delay: 30 },
              { type: 'grunt', from: 'right', z: 0.7, delay: 50 },
            ],
          },
        ],
      },
      {
        name: 'Palace Station',
        trigger: 86,
        lockX: 94,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'bruiser', from: 'right', z: 0.3 },
              { type: 'acrobat', from: 'leap', z: -0.5, delay: 30 },
              { type: 'grunt', from: 'right', z: -0.2, delay: 50 },
              { type: 'grunt', from: 'left', z: 0.6, delay: 70 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'bladeRunner', from: 'right', z: -0.4 },
              { type: 'bladeRunner', from: 'left', z: 0.4, delay: 30 },
              { type: 'thrower', from: 'door', x: -3, z: -1, delay: 60 },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. Temple Palace — mixed waves and the final boss in the throne room.
  // -------------------------------------------------------------------------
  {
    id: 'temple',
    name: 'TEMPLE PALACE',
    stage: 'STAGE 4',
    length: 118,
    zMin: -3.2,
    zMax: 3.2,
    music: 'env_temple',
    startX: 3,
    healOnEnter: 0.5,
    doors: [{ x: 20 }, { x: 47 }, { x: 72 }],
    items: [
      { type: 'khopesh', x: 28, z: 0 },
      { type: 'staff', x: 52, z: 0.4 },
      { type: 'jar', x: 76, z: -0.4 },
      { type: 'jar', x: 79, z: 0.3 },
    ],
    encounters: [
      {
        name: 'Hall of Kings',
        trigger: 12,
        lockX: 18,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'grunt_elite', from: 'right', z: -0.3 },
              { type: 'grunt_elite', from: 'left', z: 0.4, delay: 20 },
              { type: 'bladeRunner', from: 'right', z: 0.6, delay: 50 },
              { type: 'acrobat', from: 'leap', z: 0, delay: 80 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'bruiser', from: 'right', z: 0 },
              { type: 'thrower', from: 'left', z: -0.5, delay: 30 },
              { type: 'grunt', from: 'door', x: 2, z: -1, delay: 50 },
            ],
          },
        ],
      },
      {
        name: 'Lotus Gallery',
        trigger: 38,
        lockX: 45,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'acrobat', from: 'leap', z: -0.4 },
              { type: 'acrobat', from: 'leap', z: 0.4, delay: 30 },
              { type: 'bladeRunner', from: 'right', z: 0.2, delay: 50 },
              { type: 'bladeRunner', from: 'left', z: -0.6, delay: 70 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'grunt', from: 'door', x: -3, z: -1 },
              { type: 'grunt', from: 'door', x: 2, z: -1, delay: 20 },
              { type: 'grunt_elite', from: 'right', z: 0.5, delay: 40 },
              { type: 'thrower', from: 'right', z: -0.6, delay: 60 },
            ],
          },
        ],
      },
      {
        name: 'Sanctum Stair',
        trigger: 64,
        lockX: 71,
        waves: [
          {
            whenRemaining: 0,
            delay: 20,
            spawns: [
              { type: 'bruiser', from: 'right', z: -0.4 },
              { type: 'thrower', from: 'right', z: 0.2, delay: 30 },
              { type: 'bruiser', from: 'left', z: 0.5, delay: 60 },
            ],
          },
          {
            whenRemaining: 1,
            delay: 30,
            spawns: [
              { type: 'bladeRunner', from: 'right', z: 0 },
              { type: 'acrobat', from: 'leap', z: -0.4, delay: 30 },
              { type: 'grunt_elite', from: 'right', z: 0.6, delay: 50 },
              { type: 'grunt_elite', from: 'left', z: -0.2, delay: 70 },
            ],
          },
        ],
      },
      {
        name: 'Throne Room',
        trigger: 92,
        lockX: 103,
        boss: 'apep',
        bossX: 4.2,
        waves: [],
      },
    ],
  },
];

export function getEnv(index: number): EnvDef {
  const env = ENVIRONMENTS[index];
  if (!env) throw new Error(`Unknown environment index ${index}`);
  return env;
}
