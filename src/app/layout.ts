/**
 * Letterboxes the game to a fixed 16:9 frame and exposes the unit size (1% of
 * the frame height) to CSS as --u.
 */
import { CAMERA } from '../data/tuning';

export interface Layout {
  width: number;
  height: number;
}

export function fitApp(app: HTMLElement): Layout {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  let w = ww;
  let h = Math.round(ww / CAMERA.aspect);
  if (h > wh) {
    h = wh;
    w = Math.round(wh * CAMERA.aspect);
  }
  app.style.width = `${w}px`;
  app.style.height = `${h}px`;
  document.documentElement.style.setProperty('--u', `${h / 100}px`);
  return { width: w, height: h };
}
