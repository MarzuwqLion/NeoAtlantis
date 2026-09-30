/**
 * Living set dressing: fish schools, swaying kelp, bobbing crowds, water,
 * god rays and glass. Instanced where there are many of something.
 */
import * as THREE from 'three';
import { SHARED } from '../materials';
import { lathe } from '../characters/shapes';

// ---------------------------------------------------------------------------
// Fish schools (CPU-steered, instanced)
// ---------------------------------------------------------------------------
export interface SchoolSpec {
  cx: number;
  cy: number;
  cz: number;
  /** Horizontal travel range (x) and speed. */
  range: number;
  speed: number;
  count: number;
  size: number;
  spread: [number, number, number];
}

function fishGeometry(): THREE.BufferGeometry {
  const body = lathe(
    [
      [0.001, -0.5],
      [0.1, -0.35],
      [0.16, -0.05],
      [0.12, 0.25],
      [0.04, 0.45],
      [0.001, 0.5],
    ],
    8,
  );
  body.rotateZ(-Math.PI / 2); // nose toward +X
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.45, 0, 0, -0.75, 0.2, 0, -0.75, -0.2, 0], 3));
  tail.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const b = body.toNonIndexed();
  b.deleteAttribute('uv');
  const merged = new THREE.BufferGeometry();
  const pa = [...(b.getAttribute('position').array as Float32Array), ...(tail.getAttribute('position').array as Float32Array)];
  const na = [...(b.getAttribute('normal').array as Float32Array), ...(tail.getAttribute('normal').array as Float32Array)];
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(na, 3));
  return merged;
}

export class FishSchools {
  readonly mesh: THREE.InstancedMesh;
  private readonly fish: { s: SchoolSpec; ox: number; oy: number; oz: number; ph: number; sp: number }[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(schools: SchoolSpec[], color: THREE.ColorRepresentation, emissive: THREE.ColorRepresentation) {
    let n = 0;
    for (const s of schools) n += s.count;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6, emissive, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = SHARED.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.9;
          transformed.z += sin(uTime * 9.0 + ph + transformed.x * 3.0) * 0.08 * smoothstep(0.1, -0.7, transformed.x);`,
        );
    };
    mat.customProgramCacheKey = () => 'fish-v1';
    this.mesh = new THREE.InstancedMesh(fishGeometry(), mat, n);
    this.mesh.frustumCulled = false;
    let seed = 7;
    const r = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed % 10000) / 10000;
    };
    for (const s of schools) {
      for (let i = 0; i < s.count; i++) {
        this.fish.push({ s, ox: (r() - 0.5) * s.spread[0], oy: (r() - 0.5) * s.spread[1], oz: (r() - 0.5) * s.spread[2], ph: r() * Math.PI * 2, sp: 0.85 + r() * 0.3 });
      }
    }
  }

  update(time: number, offsetX = 0): void {
    let i = 0;
    for (const f of this.fish) {
      const s = f.s;
      const t = time * s.speed * f.sp * 0.1 + f.ph * 0.02;
      // ping-pong along x with gentle vertical waves
      const u = (t % 2 + 2) % 2;
      const dirRight = u < 1;
      const px = s.cx - s.range / 2 + s.range * (dirRight ? u : 2 - u) + f.ox + offsetX;
      const py = s.cy + f.oy + Math.sin(time * 0.7 + f.ph) * 0.3;
      const pz = s.cz + f.oz + Math.cos(time * 0.5 + f.ph) * 0.4;
      this.v.set(px, py, pz);
      this.e.set(0, dirRight ? 0 : Math.PI, Math.sin(time + f.ph) * 0.1);
      this.q.setFromEuler(this.e);
      this.sc.setScalar(s.size);
      this.m.compose(this.v, this.q, this.sc);
      this.mesh.setMatrixAt(i++, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Kelp / swaying plants (GPU sway)
// ---------------------------------------------------------------------------
export function kelpField(positions: [number, number, number, number][], color: THREE.ColorRepresentation, glow: THREE.ColorRepresentation): THREE.InstancedMesh {
  const g = new THREE.PlaneGeometry(0.35, 1, 1, 10);
  g.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: glow, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.51;
        float k = position.y * position.y;
        transformed.x += sin(uTime * 0.9 + ph + position.y * 2.0) * 0.35 * k;
        transformed.z += cos(uTime * 0.7 + ph * 1.3) * 0.15 * k;`,
      );
  };
  mat.customProgramCacheKey = () => 'kelp-v1';
  const mesh = new THREE.InstancedMesh(g, mat, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach(([x, y, z, h], i) => {
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i * 1.7) % 3, 0)), new THREE.Vector3(1, h, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Background crowd (instanced silhouettes that bob and sway)
// ---------------------------------------------------------------------------
export function crowd(positions: [number, number, number][], colors: THREE.ColorRepresentation[]): THREE.InstancedMesh {
  const bodyG = lathe(
    [
      [0.001, 0],
      [0.2, 0.05],
      [0.24, 0.6],
      [0.2, 1.1],
      [0.26, 1.35],
      [0.12, 1.45],
      [0.001, 1.46],
    ],
    10,
  );
  const head = new THREE.SphereGeometry(0.13, 10, 8);
  head.translate(0, 1.62, 0);
  const hat = new THREE.ConeGeometry(0.16, 0.2, 8);
  hat.translate(0, 1.8, -0.02);
  const parts = [bodyG.toNonIndexed(), head.toNonIndexed(), hat.toNonIndexed()];
  const pos: number[] = [];
  const nor: number[] = [];
  for (const p of parts) {
    pos.push(...(p.getAttribute('position').array as Float32Array));
    nor.push(...(p.getAttribute('normal').array as Float32Array));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 2.3 + instanceMatrix[3].z * 1.1;
        transformed.y += abs(sin(uTime * 2.2 + ph)) * 0.05;
        transformed.x += sin(uTime * 0.8 + ph) * 0.06 * (position.y / 1.8);`,
      );
  };
  mat.customProgramCacheKey = () => 'crowd-v1';
  const mesh = new THREE.InstancedMesh(g, mat, positions.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  positions.forEach(([x, y, z], i) => {
    const s = 0.9 + ((i * 37) % 10) / 40;
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ((i * 53) % 7) * 0.4 - 1.2, 0)), new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(colors[i % colors.length]!));
  });
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Water surface
// ---------------------------------------------------------------------------
export function water(w: number, d: number, deep: THREE.ColorRepresentation, shallow: THREE.ColorRepresentation, sky: THREE.ColorRepresentation): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, d, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED.uTime,
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uSky: { value: new THREE.Color(sky) },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
    },
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float h(vec2 p) {
        return sin(p.x * 1.7 + uTime * 1.3) * 0.5 + sin(p.y * 2.3 - uTime * 1.1) * 0.5 + sin((p.x + p.y) * 3.1 + uTime * 2.0) * 0.3 + sin((p.x - p.y) * 5.3 - uTime * 2.6) * 0.15;
      }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.05;
        vec3 n = normalize(vec3(h(p + vec2(e, 0.0)) - h(p - vec2(e, 0.0)), 6.0, h(p + vec2(0.0, e)) - h(p - vec2(0.0, e))));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, 0.35 + 0.25 * n.x);
        col = mix(col, uSky * 1.6, fres * 0.8);
        float glint = pow(max(0.0, dot(reflect(-v, n), normalize(vec3(0.3, 1.0, 0.2)))), 60.0);
        col += vec3(1.0, 0.9, 0.7) * glint * 2.5;
        float lines = smoothstep(0.93, 1.0, sin(p.x * 2.0 + h(p * 0.7) * 2.0 + uTime) * 0.5 + 0.5);
        col += uSky * lines * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(g, mat);
  return mesh;
}

// ---------------------------------------------------------------------------
// God rays: slanted additive light shafts with drifting noise.
// ---------------------------------------------------------------------------
export function godRays(specs: { x: number; y: number; z: number; w: number; h: number; tilt: number }[], color: THREE.ColorRepresentation, strength: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: SHARED.uTime, uColor: { value: new THREE.Color(color).multiplyScalar(strength) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        vUv = uv;
        vSeed = modelMatrix[3].x * 0.13;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        float fall = smoothstep(0.0, 0.6, vUv.y) * (0.35 + 0.65 * vUv.y);
        float bands = 0.55 + 0.45 * sin(vUv.x * 17.0 + uTime * 0.6 + vSeed * 10.0) * sin(vUv.x * 7.0 - uTime * 0.35 + vSeed);
        float a = edge * fall * bands;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const s of specs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    m.position.set(s.x, s.y, s.z);
    m.rotation.z = s.tilt;
    m.renderOrder = 5;
    group.add(m);
  }
  return group;
}

export function glassMaterial(tint: THREE.ColorRepresentation, opacity = 0.18): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: tint,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.6,
  });
}

/** Dark gradient backdrop plane (distant ocean / abyss). */
export function backdrop(w: number, h: number, top: THREE.ColorRepresentation, bottom: THREE.ColorRepresentation, glow: THREE.ColorRepresentation): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) }, uGlow: { value: new THREE.Color(glow) }, uTime: SHARED.uTime },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform vec3 uGlow;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
        float shafts = pow(max(0.0, sin(vUv.x * 40.0 + sin(vUv.x * 7.0 + uTime * 0.2) * 3.0)), 12.0) * smoothstep(0.35, 1.0, vUv.y);
        c += uGlow * shafts * 0.25;
        float glowBand = exp(-pow((vUv.y - 0.18) * 5.0, 2.0));
        c += uGlow * glowBand * 0.35;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.renderOrder = -10;
  return m;
}
