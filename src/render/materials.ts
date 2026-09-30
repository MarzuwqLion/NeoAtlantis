/**
 * Shared material factories.
 *
 * Characters use MeshStandardMaterial patched with a rim light, a hit flash
 * and an ordered-dither fade (so fading never needs transparency sorting).
 * Environment materials get animated water caustics projected in world space.
 * All patches share compiled programs via customProgramCacheKey.
 */
import * as THREE from 'three';

/** Uniforms shared by every environment material (updated once per frame). */
export const SHARED = {
  uTime: { value: 0 },
  uCausticColor: { value: new THREE.Color(0.35, 0.75, 0.9) },
  uCausticStrength: { value: 0.6 },
  uCausticScale: { value: 0.22 },
  uCausticSpeed: { value: 0.55 },
};

const BAYER = /* glsl */ `
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + int(q.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
`;

export interface CharacterUniforms {
  uFlash: { value: number };
  uFade: { value: number };
  uGlow: { value: number };
  uRimColor: { value: THREE.Color };
  uRimStrength: { value: number };
  uTint: { value: THREE.Color };
  uGlowColor: { value: THREE.Color };
}

export function createCharacterUniforms(): CharacterUniforms {
  return {
    uFlash: { value: 0 },
    uFade: { value: 1 },
    uGlow: { value: 0 },
    uRimColor: { value: new THREE.Color(0.55, 0.8, 1.0) },
    uRimStrength: { value: 0.8 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uGlowColor: { value: new THREE.Color(1.0, 0.45, 0.15) },
  };
}

function attachUniforms(shader: THREE.WebGLProgramParametersWithUniforms, u: CharacterUniforms): void {
  shader.uniforms.uFlash = u.uFlash;
  shader.uniforms.uFade = u.uFade;
  shader.uniforms.uGlow = u.uGlow;
  shader.uniforms.uRimColor = u.uRimColor;
  shader.uniforms.uRimStrength = u.uRimStrength;
  shader.uniforms.uTint = u.uTint;
  shader.uniforms.uGlowColor = u.uGlowColor;
}

const CHAR_HEADER = /* glsl */ `
uniform float uFlash;
uniform float uFade;
uniform float uGlow;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform vec3 uTint;
uniform vec3 uGlowColor;
${BAYER}
`;

/** Lit character surface (cloth, skin, armour, metal). */
export function characterStandard(params: THREE.MeshStandardMaterialParameters, u: CharacterUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...params });
  m.onBeforeCompile = (shader) => {
    attachUniforms(shader, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CHAR_HEADER}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n  if (uFade < 0.999 && bayer4(gl_FragCoord.xy) >= uFade) discard;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          float rim = pow(rimF, 2.6);
          outgoingLight *= uTint;
          outgoingLight += uRimColor * rim * uRimStrength * (0.6 + 0.4 * rimF);
          outgoingLight += uGlowColor * (rim * 1.6 + 0.12) * uGlow;
          outgoingLight = mix(outgoingLight, vec3(1.25, 1.18, 1.08), uFlash);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'char-std-v3';
  return m;
}

/** Emissive trim (eyes, glyph lines, energy). Unlit, HDR so it blooms. */
export function characterGlow(intensity: number, u: CharacterUniforms): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(intensity, intensity, intensity) });
  m.onBeforeCompile = (shader) => {
    attachUniforms(shader, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CHAR_HEADER}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n  if (uFade < 0.999 && bayer4(gl_FragCoord.xy) >= uFade) discard;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= (1.0 + uGlow * 1.6);
        outgoingLight = mix(outgoingLight, vec3(2.0, 1.9, 1.7), uFlash * 0.6);
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'char-glow-v2';
  return m;
}

/** Inverted-hull outline for characters (extruded along bind-pose normals, then skinned). */
export function characterOutline(width: number, color: THREE.ColorRepresentation, u: CharacterUniforms): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const uOutline = { value: width };
  m.onBeforeCompile = (shader) => {
    attachUniforms(shader, u);
    shader.uniforms.uOutline = uOutline;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uOutline;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CHAR_HEADER}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n  if (uFade < 0.999 && bayer4(gl_FragCoord.xy) >= uFade) discard;`,
      )
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, uGlowColor * 1.4, clamp(uGlow, 0.0, 1.0) * 0.85);\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'char-outline-v3';
  return m;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const CAUSTIC_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uCausticColor;
uniform float uCausticStrength;
uniform float uCausticScale;
uniform float uCausticSpeed;
varying vec3 vCausticPos;
varying vec3 vCausticN;
float causticPattern(vec2 uv, float time) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 2.0);
}
`;

export interface EnvMaterialOptions {
  /** Multiplier on the shared caustic strength for this material. */
  caustics?: number;
}

/** Add world-space animated caustics to a standard material. */
export function withCaustics<T extends THREE.MeshStandardMaterial>(m: T, opts: EnvMaterialOptions = {}): T {
  const local = { value: opts.caustics ?? 1 };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.uTime = SHARED.uTime;
    shader.uniforms.uCausticColor = SHARED.uCausticColor;
    shader.uniforms.uCausticStrength = SHARED.uCausticStrength;
    shader.uniforms.uCausticScale = SHARED.uCausticScale;
    shader.uniforms.uCausticSpeed = SHARED.uCausticSpeed;
    shader.uniforms.uCausticLocal = local;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticPos;\nvarying vec3 vCausticN;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 cw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw;
          #endif
          cw = modelMatrix * cw;
          vCausticPos = cw.xyz;
          vec3 cn = objectNormal;
          #ifdef USE_INSTANCING
            cn = mat3(instanceMatrix) * cn;
          #endif
          vCausticN = normalize(mat3(modelMatrix) * cn);
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CAUSTIC_GLSL}\nuniform float uCausticLocal;`)
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 cn = normalize(vCausticN);
          float up = clamp(cn.y, 0.0, 1.0);
          vec2 cuv = mix(vec2(vCausticPos.x + vCausticPos.z * 0.6, vCausticPos.y * 1.3), vCausticPos.xz, up) * uCausticScale;
          float t = uTime * uCausticSpeed;
          float c = causticPattern(cuv, t) * 0.7 + causticPattern(cuv * 1.37 + 3.1, t * 1.21 + 2.0) * 0.5;
          float face = mix(0.45, 1.0, up);
          outgoingLight += uCausticColor * c * uCausticStrength * uCausticLocal * face * (0.35 + diffuseColor.rgb);
        }
        #include <opaque_fragment>`,
      );
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}-caustics-v2`;
  return m;
}

/** Standard environment surface with caustics. */
export function envStandard(params: THREE.MeshStandardMaterialParameters, opts: EnvMaterialOptions = {}): THREE.MeshStandardMaterial {
  return withCaustics(new THREE.MeshStandardMaterial(params), opts);
}

/** Emissive-only surface (neon, lamps). HDR so it blooms. */
export function envGlow(color: THREE.ColorRepresentation, intensity: number, params: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, ...params });
}
