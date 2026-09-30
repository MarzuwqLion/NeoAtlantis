/**
 * Ground-plane effects: blob shadows (how the player reads depth lane and
 * jump height), expanding rings (shockwaves, respawn blasts) and target
 * markers (lobbed jar landing spots, boss leap targets).
 */
import * as THREE from 'three';

const SHADOW_VERT = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const SHADOW_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.35, 1.0, d);
  a *= a;
  gl_FragColor = vec4(uColor, a * vAlpha);
}
`;

export class BlobShadows {
  readonly mesh: THREE.InstancedMesh;
  private readonly alpha: THREE.InstancedBufferAttribute;
  private n = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  readonly material: THREE.ShaderMaterial;

  constructor(readonly max = 96) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alpha);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x020306) } },
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  /** Add a shadow at ground point (x, groundY, z). Height fades and shrinks it. */
  add(x: number, z: number, radiusX: number, radiusZ: number, height: number, strength = 0.75, groundY = 0.012): void {
    if (this.n >= this.max) return;
    const h = Math.max(0, height);
    const k = 1 / (1 + h * 0.45);
    this.v.set(x, groundY, z);
    this.s.set(radiusX * 2 * k, radiusZ * 2 * k, 1);
    this.m.compose(this.v, this.q, this.s);
    this.mesh.setMatrixAt(this.n, this.m);
    (this.alpha.array as Float32Array)[this.n] = strength * Math.max(0.25, k);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}

const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uThickness;
uniform float uTime;
uniform float uFill;
uniform float uDash;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;
  float edge = smoothstep(1.0, 1.0 - uThickness, d) * smoothstep(1.0 - uThickness * 2.5, 1.0 - uThickness, d);
  float a = edge;
  float ang = atan(p.y, p.x);
  float n = 0.75 + 0.25 * sin(ang * 13.0 + uTime * 9.0) * sin(ang * 7.0 - uTime * 5.0);
  a *= n;
  if (uDash > 0.0) a *= step(0.0, sin(ang * uDash + uTime * 4.0));
  a += uFill * (1.0 - smoothstep(0.0, 1.0, d)) * 0.35;
  if (d > 1.0) discard;
  gl_FragColor = vec4(uColor * a, a * uAlpha);
}
`;

export interface RingHandle {
  mesh: THREE.Mesh;
  uniforms: { uColor: { value: THREE.Color }; uAlpha: { value: number }; uThickness: { value: number }; uTime: { value: number }; uFill: { value: number }; uDash: { value: number } };
  active: boolean;
}

/** Pool of flat glowing rings on the ground. */
export class GroundRings {
  readonly group = new THREE.Group();
  private readonly pool: RingHandle[] = [];
  private readonly anims: { h: RingHandle; t: number; life: number; r0: number; r1: number; a0: number; x: number; z: number }[] = [];

  constructor(size = 24) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < size; i++) {
      const uniforms = {
        uColor: { value: new THREE.Color(1, 1, 1) },
        uAlpha: { value: 1 },
        uThickness: { value: 0.12 },
        uTime: { value: 0 },
        uFill: { value: 0 },
        uDash: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.pool.push({ mesh, uniforms, active: false });
    }
  }

  acquire(): RingHandle | null {
    const h = this.pool.find((p) => !p.active);
    if (!h) return null;
    h.active = true;
    h.mesh.visible = true;
    return h;
  }

  release(h: RingHandle): void {
    h.active = false;
    h.mesh.visible = false;
  }

  place(h: RingHandle, x: number, z: number, radius: number, color: THREE.ColorRepresentation, alpha: number, thickness = 0.12, fill = 0, dash = 0): void {
    h.mesh.position.set(x, 0.02, z);
    h.mesh.scale.set(radius * 2, 1, radius * 2);
    h.uniforms.uColor.value.set(color);
    h.uniforms.uAlpha.value = alpha;
    h.uniforms.uThickness.value = thickness;
    h.uniforms.uFill.value = fill;
    h.uniforms.uDash.value = dash;
  }

  /** Fire-and-forget expanding ring. */
  burst(x: number, z: number, r0: number, r1: number, life: number, color: THREE.ColorRepresentation, alpha = 1.5): void {
    const h = this.acquire();
    if (!h) return;
    this.place(h, x, z, r0, color, alpha, 0.18);
    this.anims.push({ h, t: 0, life, r0, r1, a0: alpha, x, z });
  }

  update(dt: number, time: number): void {
    for (const p of this.pool) p.uniforms.uTime.value = time;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i]!;
      a.t += dt;
      const u = Math.min(1, a.t / a.life);
      const e = 1 - (1 - u) * (1 - u);
      const r = a.r0 + (a.r1 - a.r0) * e;
      a.h.mesh.scale.set(r * 2, 1, r * 2);
      a.h.uniforms.uAlpha.value = a.a0 * (1 - u);
      a.h.uniforms.uThickness.value = 0.18 * (1 - u * 0.6);
      if (u >= 1) {
        this.release(a.h);
        this.anims.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const a of this.anims) this.release(a.h);
    this.anims.length = 0;
    for (const p of this.pool) this.release(p);
  }
}
