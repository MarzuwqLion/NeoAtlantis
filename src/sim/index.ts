/**
 * Public simulation API. The simulation is renderer-independent: it imports
 * nothing from three.js or the DOM and can run headless (tests, servers).
 */
export * from './types';
export { createWorld, step, carryOver } from './world';
export type { WorldOptions } from './world';
export { findFighter, isAlive, hurtHeight } from './fighter';
export { spawnEnemy } from './spawn';
export { hitActive, hitboxX, hitConnects, applyHit } from './combat';
export { viewHalfWidthAt, VIEW_HALF_WIDTH, CAMERA_OFFSET } from './view';
export { leadX } from './director';
