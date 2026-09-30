/**
 * Weapon swing trails: a ribbon between the blade base and tip over the last
 * few frames, fading along its length. Additive, so it blooms.
 */
import * as THREE from 'three';

const SAMPLES = 9;

export class Trail {
  readonly mesh: THREE.Mesh;
  private readonly base: THREE.Vector3[] = [];
  private readonly tip: THREE.Vector3[] = [];
  private readonly pos: Float32Array;
  private readonly alpha: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private count = 0;
  private fade = 0;
  active = false;
  owner = -1;

  constructor(color: THREE.ColorRepresentation) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(SAMPLES * 2 * 3);
    this.alpha = new Float32Array(SAMPLES * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vA;
        void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() { gl_FragColor = vec4(uColor * vA, vA); }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.visible = false;
    for (let i = 0; i < SAMPLES; i++) {
      this.base.push(new THREE.Vector3());
      this.tip.push(new THREE.Vector3());
    }
  }

  setColor(c: THREE.ColorRepresentation, intensity: number): void {
    ((this.mesh.material as THREE.ShaderMaterial).uniforms.uColor!.value as THREE.Color).set(c).multiplyScalar(intensity);
  }

  /** Push the current blade segment. `emitting` false lets the trail fade out. */
  push(base: THREE.Vector3, tip: THREE.Vector3, emitting: boolean): void {
    if (emitting) {
      for (let i = SAMPLES - 1; i > 0; i--) {
        this.base[i]!.copy(this.base[i - 1]!);
        this.tip[i]!.copy(this.tip[i - 1]!);
      }
      this.base[0]!.copy(base);
      this.tip[0]!.copy(tip);
      this.count = Math.min(SAMPLES, this.count + 1);
      this.fade = 1;
    } else {
      this.fade = Math.max(0, this.fade - 0.2);
    }
    this.rebuild();
  }

  reset(): void {
    this.count = 0;
    this.fade = 0;
    this.mesh.visible = false;
  }

  private rebuild(): void {
    const n = this.count;
    this.mesh.visible = n > 1 && this.fade > 0;
    if (!this.mesh.visible) return;
    for (let i = 0; i < SAMPLES; i++) {
      const j = Math.min(i, n - 1);
      const b = this.base[j]!;
      const t = this.tip[j]!;
      this.pos.set([b.x, b.y, b.z, t.x, t.y, t.z], i * 6);
      const a = i < n ? (1 - i / (n - 1 || 1)) * this.fade : 0;
      this.alpha[i * 2] = a * 0.1;
      this.alpha[i * 2 + 1] = a * 0.75;
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.getAttribute('aAlpha').needsUpdate = true;
  }
}
