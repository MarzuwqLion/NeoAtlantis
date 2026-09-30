/**
 * Standalone animation viewer (index.html?viewer). Also scriptable through
 * window.__viewer for automated screenshots.
 */
import * as THREE from 'three';
import { AnimViewer } from '../debug/AnimViewer';
import { PostPipeline } from '../render/post';
import { setMaxAnisotropy } from '../render/textures';
import { fitApp } from './layout';

declare global {
  interface Window {
    __viewer?: AnimViewer;
  }
}

export function startViewer(): void {
  const app = document.getElementById('app')!;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
  const layout = fitApp(app);
  renderer.setSize(layout.width, layout.height, false);
  const viewer = new AnimViewer(renderer, document.getElementById('ui')!);
  const post = new PostPipeline(renderer, viewer.scene, viewer.camera, layout.width, layout.height);
  post.grade.bloomStrength = 0.5;
  viewer.setAspect(layout.width / layout.height);
  window.addEventListener('resize', () => {
    const l = fitApp(app);
    renderer.setSize(l.width, l.height, false);
    post.setSize(l.width, l.height);
    viewer.setAspect(l.width / l.height);
  });
  window.__viewer = viewer;
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    viewer.update(dt);
    post.render(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
