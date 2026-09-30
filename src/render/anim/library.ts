/**
 * Clip library per model: the shared humanoid set plus type-specific clips.
 */
import type { ClipLibrary, ClipSpec } from './pose';
import { compileLibrary } from './pose';
import { HUMANOID } from './clips/humanoid';
import { PLAYER_CLIPS, WEAPON_CLIPS } from './clips/player';
import { ACROBAT_CLIPS, BLADE_RUNNER_CLIPS, BRUISER_CLIPS, GRUNT_CLIPS, THROWER_CLIPS } from './clips/enemies';
import { APEP_CLIPS, SOBEKHAN_CLIPS } from './clips/bosses';

export const CLIP_SETS: Record<string, Record<string, ClipSpec>> = {
  heru: { ...HUMANOID, ...PLAYER_CLIPS, ...WEAPON_CLIPS },
  grunt: { ...HUMANOID, ...WEAPON_CLIPS, ...GRUNT_CLIPS },
  bladeRunner: { ...HUMANOID, ...WEAPON_CLIPS, ...BLADE_RUNNER_CLIPS },
  bruiser: { ...HUMANOID, ...BRUISER_CLIPS },
  thrower: { ...HUMANOID, ...WEAPON_CLIPS, ...THROWER_CLIPS },
  acrobat: { ...HUMANOID, ...ACROBAT_CLIPS },
  sobekhan: { ...HUMANOID, ...SOBEKHAN_CLIPS },
  apep: { ...HUMANOID, ...APEP_CLIPS },
};

const compiled = new Map<string, ClipLibrary>();

export function getClipLibrary(model: string): ClipLibrary {
  let lib = compiled.get(model);
  if (!lib) {
    const set = CLIP_SETS[model];
    if (!set) throw new Error(`No clip set for model ${model}`);
    lib = compileLibrary(set);
    compiled.set(model, lib);
  }
  return lib;
}
