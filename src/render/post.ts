/**
 * Post-processing: HDR scene -> bloom -> final pass (exposure, ACES tone
 * mapping, per-environment colour grade, vignette, grain, fades and flashes).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface GradeSettings {
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  saturation: number;
  contrast: number;
  vignette: number;
  lift: THREE.Color;
  gamma: THREE.Color;
  gain: THREE.Color;
  tint: THREE.Color;
  grain: number;
}

export function defaultGrade(): GradeSettings {
  return {
    exposure: 1.0,
    bloomStrength: 0.7,
    bloomRadius: 0.55,
    bloomThreshold: 0.82,
    saturation: 1.08,
    contrast: 1.06,
    vignette: 0.32,
    lift: new THREE.Color(0, 0, 0),
    gamma: new THREE.Color(1, 1, 1),
    gain: new THREE.Color(1, 1, 1),
    tint: new THREE.Color(1, 1, 1),
    grain: 0.025,
  };
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uExposure: { value: 1 },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0.3 },
    uLift: { value: new THREE.Color(0, 0, 0) },
    uGamma: { value: new THREE.Color(1, 1, 1) },
    uGain: { value: new THREE.Color(1, 1, 1) },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uFade: { value: 0 },
    uFlash: { value: 0 },
    uGrain: { value: 0.02 },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform vec3 uLift;
    uniform vec3 uGamma;
    uniform vec3 uGain;
    uniform vec3 uTint;
    uniform float uFade;
    uniform float uFlash;
    uniform float uGrain;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;

    vec3 acesFitted(vec3 v) {
      const mat3 ACESInput = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 ACESOutput = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      v = ACESInput * v;
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      v = a / b;
      return clamp(ACESOutput * v, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
      c = acesFitted(c);
      c = toSRGB(c);
      c *= uTint;
      c = pow(max(vec3(0.0), c * uGain + uLift * (1.0 - c)), 1.0 / max(uGamma, vec3(0.01)));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;
      vec2 d = vUv - 0.5;
      d.x *= uAspect * 0.75;
      float vig = smoothstep(0.95, 0.25, length(d));
      c *= mix(1.0 - uVignette, 1.0, vig);
      float n = fract(sin(dot(vUv * (fract(uTime) + 1.37), vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain;
      c = mix(c, vec3(1.0, 0.97, 0.9), uFlash);
      c *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
};

export class PostPipeline {
  readonly composer: EffectComposer;
  readonly renderPass: RenderPass;
  readonly bloom: UnrealBloomPass;
  readonly final: ShaderPass;
  readonly grade: GradeSettings = defaultGrade();
  fade = 0;
  flash = 0;
  private time = 0;

  constructor(
    readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    samples = 4,
  ) {
    const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.7, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
  }

  setScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.bloom.setSize(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
    this.final.uniforms.uAspect!.value = w / Math.max(1, h);
  }

  render(dt: number): void {
    this.time += dt;
    const g = this.grade;
    this.bloom.strength = g.bloomStrength;
    this.bloom.radius = g.bloomRadius;
    this.bloom.threshold = g.bloomThreshold;
    const u = this.final.uniforms;
    u.uExposure!.value = g.exposure;
    u.uSaturation!.value = g.saturation;
    u.uContrast!.value = g.contrast;
    u.uVignette!.value = g.vignette;
    (u.uLift!.value as THREE.Color).copy(g.lift);
    (u.uGamma!.value as THREE.Color).copy(g.gamma);
    (u.uGain!.value as THREE.Color).copy(g.gain);
    (u.uTint!.value as THREE.Color).copy(g.tint);
    u.uGrain!.value = g.grain;
    u.uFade!.value = this.fade;
    u.uFlash!.value = this.flash;
    u.uTime!.value = this.time;
    this.composer.render(dt);
  }
}
