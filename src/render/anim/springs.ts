/**
 * Spring-driven secondary motion for cloth strips, sashes, tails and
 * headdress lappets. Each chain segment end is a Verlet particle pulled
 * toward where the rigid pose would put it; bones are then rotated to point
 * at the simulated particles. Runs at a fixed 60 Hz sub-step.
 */
import * as THREE from 'three';
import type { ChainDef } from '../characters/rig';

const _origin = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _pq = new THREE.Quaternion();
const _pqInv = new THREE.Quaternion();
const _local = new THREE.Vector3();

export class SpringChainSim {
  private readonly pos: THREE.Vector3[];
  private readonly prev: THREE.Vector3[];
  private acc = 0;
  private primed = false;

  constructor(readonly chain: ChainDef) {
    this.pos = chain.bones.map(() => new THREE.Vector3());
    this.prev = chain.bones.map(() => new THREE.Vector3());
  }

  reset(): void {
    this.primed = false;
  }

  /** `scale` is the character's world scale (so gravity stays consistent). */
  update(dt: number): void {
    const { bones, lengths, restDirs, params } = this.chain;
    if (!this.primed) {
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i]!;
        b.quaternion.identity();
        b.updateMatrixWorld(true);
        b.getWorldPosition(_origin);
        b.parent!.getWorldQuaternion(_pq);
        _dir.copy(restDirs[i]!).applyQuaternion(_pq);
        this.pos[i]!.copy(_origin).addScaledVector(_dir, lengths[i]!);
        this.prev[i]!.copy(this.pos[i]!);
      }
      this.primed = true;
    }
    this.acc = Math.min(this.acc + dt, 0.1);
    const h = 1 / 60;
    let steps = 0;
    while (this.acc >= h && steps < 4) {
      this.acc -= h;
      steps++;
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i]!;
        b.quaternion.identity();
        b.updateMatrixWorld(true);
        b.getWorldPosition(_origin);
        b.parent!.getWorldQuaternion(_pq);
        _dir.copy(restDirs[i]!).applyQuaternion(_pq);
        _target.copy(_origin).addScaledVector(_dir, lengths[i]!);
        const p = this.pos[i]!;
        const pr = this.prev[i]!;
        _vel.subVectors(p, pr).multiplyScalar(params.damping);
        pr.copy(p);
        p.add(_vel);
        p.y -= params.gravity * h * h;
        p.lerp(_target, params.stiffness);
        // Keep the segment length.
        _dir.subVectors(p, _origin);
        const len = _dir.length();
        if (len > 1e-6) p.copy(_origin).addScaledVector(_dir, lengths[i]! / len);
        else p.copy(_target);
        this.orient(i);
      }
    }
    if (steps === 0) for (let i = 0; i < bones.length; i++) this.orient(i);
  }

  private orient(i: number): void {
    const b = this.chain.bones[i]!;
    b.parent!.getWorldQuaternion(_pq);
    _pqInv.copy(_pq).invert();
    b.getWorldPosition(_origin);
    _local.subVectors(this.pos[i]!, _origin).applyQuaternion(_pqInv).normalize();
    b.quaternion.setFromUnitVectors(this.chain.restDirs[i]!, _local);
    b.updateMatrixWorld(true);
  }
}
