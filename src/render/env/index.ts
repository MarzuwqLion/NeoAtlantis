import { getEnv } from '../../data/level';
import type { EnvironmentView } from './types';
import { buildDocks } from './docks';
import { buildBazaar } from './bazaar';
import { buildTube } from './tube';
import { buildTemple } from './temple';

export function buildEnvironment(index: number): EnvironmentView {
  const env = getEnv(index);
  switch (env.id) {
    case 'docks':
      return buildDocks(env);
    case 'bazaar':
      return buildBazaar(env);
    case 'tube':
      return buildTube(env);
    case 'temple':
      return buildTemple(env);
  }
}

export type { EnvironmentView } from './types';
