/**
 * Instanced camera-facing particles (one draw call per system). Supports
 * rotation, size/colour/alpha over life, gravity, drag and velocity-aligned
 * streaks. Particle sprites come from a 2x2 atlas: 0 dot, 1 star, 2 ring, 3 smoke.
 */
import * as THREE from 'three';
import { particleAtlas } from '../textures';

export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  sizeEnd?: number;
  color: THREE.ColorRepresentation;
  colorEnd?: THREE.ColorRepresentation;
  /** HDR multiplier on colour (additive sparks bloom above 1). */
  intensity?: number;
  alpha?: number;
  alphaEnd?: number;
  cell?: 0 | 1 | 2 | 3;
  gravity?: number;
  drag?: number;
  rot?: number;
  rotSpeed?: number;
  stretch?: number;
}

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute float iSize;
attribute vec4 iColor;
attribute float iRot;
attribute float iCell;
attribute float iStretch;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 corner = position.xy;
  vec2 ax = vec2(cos(iRot), sin(iRot));
  vec2 ay = vec2(-ax.y, ax.x);
  float len = 1.0;
  if (iStretch > 0.0) {
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    float sp = length(vv.xy);
    if (sp > 1e-4) {
      ax = vv.xy / sp;
      ay = vec2(-ax.y, ax.x);
      len = 1.0 + sp * iStretch;
    }
  }
  mv.xy += ax * corner.x * iSize * len + ay * corner.y * iSize;
  gl_Position = projectionMatrix * mv;
  vColor = iColor;
  float col = mod(iCell, 2.0);
  float row = floor(iCell / 2.0);
  vUv = (corner + 0.5) * 0.5 + vec2(col * 0.5, (1.0 - row) * 0.5);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = vColor.a * t.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb * t.rgb, a);
}
`;

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  c0: THREE.Color;
  c1: THREE.Color;
  a0: number;
  a1: number;
  cell: number;
  g: number;
  drag: number;
  rot: number;
  rs: number;
  stretch: number;
}

export class ParticleSystem {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly pool: P[] = [];
  private readonly live: P[] = [];
  private readonly aPos: THREE.InstancedBufferAttribute;
  private readonly aVel: THREE.InstancedBufferAttribute;
  private readonly aSize: THREE.InstancedBufferAttribute;
  private readonly aColor: THREE.InstancedBufferAttribute;
  private readonly aRot: THREE.InstancedBufferAttribute;
  private readonly aCell: THREE.InstancedBufferAttribute;
  private readonly aStretch: THREE.InstancedBufferAttribute;

  constructor(
    readonly max: number,
    additive: boolean,
    renderOrder = 10,
  ) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    const mk = (n: number): THREE.InstancedBufferAttribute => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aPos = mk(3);
    this.aVel = mk(3);
    this.aSize = mk(1);
    this.aColor = mk(4);
    this.aRot = mk(1);
    this.aCell = mk(1);
    this.aStretch = mk(1);
    this.geo.setAttribute('iPos', this.aPos);
    this.geo.setAttribute('iVel', this.aVel);
    this.geo.setAttribute('iSize', this.aSize);
    this.geo.setAttribute('iColor', this.aColor);
    this.geo.setAttribute('iRot', this.aRot);
    this.geo.setAttribute('iCell', this.aCell);
    this.geo.setAttribute('iStretch', this.aStretch);
    this.geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: particleAtlas() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    for (let i = 0; i < max; i++) {
      this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a0: 1, a1: 0, cell: 0, g: 0, drag: 0, rot: 0, rs: 0, stretch: 0 });
    }
  }

  get count(): number {
    return this.live.length;
  }

  spawn(s: ParticleSpawn): void {
    const p = this.pool.pop() ?? this.live.shift();
    if (!p) return;
    p.x = s.x;
    p.y = s.y;
    p.z = s.z;
    p.vx = s.vx ?? 0;
    p.vy = s.vy ?? 0;
    p.vz = s.vz ?? 0;
    p.life = s.life;
    p.max = s.life;
    p.s0 = s.size;
    p.s1 = s.sizeEnd ?? s.size;
    const k = s.intensity ?? 1;
    p.c0.set(s.color).multiplyScalar(k);
    p.c1.set(s.colorEnd ?? s.color).multiplyScalar(k);
    p.a0 = s.alpha ?? 1;
    p.a1 = s.alphaEnd ?? 0;
    p.cell = s.cell ?? 0;
    p.g = s.gravity ?? 0;
    p.drag = s.drag ?? 0;
    p.rot = s.rot ?? 0;
    p.rs = s.rotSpeed ?? 0;
    p.stretch = s.stretch ?? 0;
    this.live.push(p);
  }

  update(dt: number): void {
    let n = 0;
    const pos = this.aPos.array as Float32Array;
    const vel = this.aVel.array as Float32Array;
    const size = this.aSize.array as Float32Array;
    const col = this.aColor.array as Float32Array;
    const rot = this.aRot.array as Float32Array;
    const cell = this.aCell.array as Float32Array;
    const str = this.aStretch.array as Float32Array;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.live[i] = this.live[this.live.length - 1]!;
        this.live.pop();
        this.pool.push(p);
        continue;
      }
      p.vy -= p.g * dt;
      if (p.drag > 0) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.vz *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rs * dt;
    }
    for (const p of this.live) {
      const t = 1 - p.life / p.max;
      pos[n * 3] = p.x;
      pos[n * 3 + 1] = p.y;
      pos[n * 3 + 2] = p.z;
      vel[n * 3] = p.vx;
      vel[n * 3 + 1] = p.vy;
      vel[n * 3 + 2] = p.vz;
      size[n] = p.s0 + (p.s1 - p.s0) * t;
      col[n * 4] = p.c0.r + (p.c1.r - p.c0.r) * t;
      col[n * 4 + 1] = p.c0.g + (p.c1.g - p.c0.g) * t;
      col[n * 4 + 2] = p.c0.b + (p.c1.b - p.c0.b) * t;
      col[n * 4 + 3] = p.a0 + (p.a1 - p.a0) * t;
      rot[n] = p.rot;
      cell[n] = p.cell;
      str[n] = p.stretch;
      n++;
    }
    this.geo.instanceCount = n;
    for (const a of [this.aPos, this.aVel, this.aSize, this.aColor, this.aRot, this.aCell, this.aStretch]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }

  clear(): void {
    while (this.live.length) this.pool.push(this.live.pop()!);
    this.geo.instanceCount = 0;
  }
}
