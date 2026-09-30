/**
 * Procedural reflection environment: a gradient dome with a few bright
 * panels, prefiltered with PMREM. Gives gold and metal something to reflect
 * so they read as metal, tinted per environment.
 */
import * as THREE from 'three';

export interface EnvMapOptions {
  top: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  bottom: THREE.ColorRepresentation;
  panels: { color: THREE.ColorRepresentation; intensity: number; pos: [number, number, number]; size: [number, number] }[];
}

export function makeEnvMap(renderer: THREE.WebGLRenderer, o: EnvMapOptions): THREE.Texture {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const top = new THREE.Color(o.top);
  const hor = new THREE.Color(o.horizon);
  const bot = new THREE.Color(o.bottom);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    if (y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.7));
    else c.copy(hor).lerp(bot, Math.pow(-y, 0.5));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  scene.add(dome);
  for (const p of o.panels) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(p.size[0], p.size[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide }),
    );
    m.position.set(p.pos[0], p.pos[1], p.pos[2]);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.03);
  pm.dispose();
  geo.dispose();
  scene.traverse((o2) => {
    const m = o2 as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  return rt.texture;
}
