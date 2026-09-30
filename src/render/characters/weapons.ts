/**
 * Weapon meshes: khopesh, was-staff and clay jar. Held weapons are parented
 * to the right hand bone; the same meshes are used for ground items.
 * Hand space: fist centre around y = -0.07, forward = +Z.
 */
import * as THREE from 'three';
import type { WeaponType } from '../../sim/types';
import { khopeshGeometry } from './models';
import { cone, cyl, lathe, wedge, xf } from './shapes';
import { jarTexture } from '../textures';

let mats: Record<string, THREE.Material> | null = null;

function materials(): Record<string, THREE.Material> {
  if (mats) return mats;
  mats = {
    blade: new THREE.MeshStandardMaterial({ color: 0xd8c38a, metalness: 0.95, roughness: 0.22 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xb27a3a, metalness: 0.9, roughness: 0.35 }),
    wrap: new THREE.MeshStandardMaterial({ color: 0x3a2418, metalness: 0.0, roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5b3a22, metalness: 0.0, roughness: 0.65 }),
    lapis: new THREE.MeshStandardMaterial({ color: 0x2c5fa8, metalness: 0.2, roughness: 0.3 }),
    clay: new THREE.MeshStandardMaterial({ map: jarTexture(), metalness: 0, roughness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5ff2ff).multiplyScalar(2.2) }),
  };
  return mats;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const me = new THREE.Mesh(g, m);
  me.castShadow = false;
  return me;
}

export function createWeaponMesh(type: WeaponType): THREE.Group {
  const M = materials();
  const g = new THREE.Group();
  g.name = `weapon:${type}`;
  if (type === 'khopesh') {
    g.add(mesh(khopeshGeometry(0.6), M.blade!));
    // Grip wrap and pommel sit in the fist.
    const grip = cyl(0.022, 0.022, 0.16, 8);
    grip.rotateX(Math.PI / 2 + 0.35);
    g.add(mesh(grip, M.wrap!));
    const pommel = new THREE.SphereGeometry(0.03, 10, 8);
    pommel.translate(0, 0.03, -0.075);
    g.add(mesh(pommel, M.bronze!));
    g.position.set(0, -0.07, 0.0);
  } else if (type === 'staff') {
    // Was-sceptre: long shaft, angled animal head on top, fork at the base.
    const len = 2.1;
    const shaft = cyl(0.028, 0.028, len, 10);
    shaft.rotateX(Math.PI / 2);
    shaft.translate(0, 0, len * 0.5 - len * 0.32);
    g.add(mesh(shaft, M.wood!));
    const bands = [0.2, 0.5, 0.9];
    for (const b of bands) {
      const band = cyl(0.036, 0.036, 0.05, 10);
      band.rotateX(Math.PI / 2);
      band.translate(0, 0, len * b - len * 0.32);
      g.add(mesh(band, M.bronze!));
    }
    const head = wedge([[-0.02, 0], [0.16, 0.05], [0.16, 0.09], [-0.03, 0.06]], 0.045);
    xf(head, { p: [0, 0, len * 0.68], r: [0, -90, 0] });
    g.add(mesh(head, M.bronze!));
    const eye = new THREE.SphereGeometry(0.016, 8, 6);
    eye.translate(0.025, 0.06, len * 0.68 + 0.1);
    g.add(mesh(eye, M.glow!));
    for (const s of [-1, 1]) {
      const prong = cone(0.018, 0.14, 6);
      xf(prong, { p: [s * 0.035, 0, -len * 0.32 - 0.06], r: [-90, 0, s * 18] });
      g.add(mesh(prong, M.bronze!));
    }
    g.position.set(0, -0.07, 0.0);
  } else {
    const jar = jarGroup();
    jar.position.set(0, -0.2 + 0.185, 0.06);
    g.add(jar);
  }
  return g;
}

/** Painted clay jar centred on its middle (0.37 m tall). */
export function jarGroup(): THREE.Group {
  const M = materials();
  const g = new THREE.Group();
  const jar = lathe(
    [
      [0.001, 0],
      [0.08, 0.02],
      [0.13, 0.12],
      [0.12, 0.24],
      [0.065, 0.31],
      [0.06, 0.35],
      [0.075, 0.37],
    ],
    18,
  );
  jar.translate(0, -0.185, 0);
  g.add(mesh(jar, M.clay!));
  const lip = new THREE.TorusGeometry(0.07, 0.012, 6, 16);
  lip.rotateX(Math.PI / 2);
  lip.translate(0, 0.185, 0);
  g.add(mesh(lip, M.clay!));
  return g;
}
