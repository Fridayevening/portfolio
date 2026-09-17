// WebGL glitch renderer: one frozen-frame texture + a fullscreen quad. The whole look
// is the TikTok-style red/cyan tear:
//   · red/cyan — full-screen horizontal R/B channel split plus pure-red / pure-cyan
//     luminance ghosts (offset samples tinted by luminance, lerped toward the pure
//     color; the two ghosts combine with max)
// (Snow, edge fraying, band sweeps, tear strips, hum bars, head-switch noise, and
// whole-line flashes were all deliberately cut on feedback — don't re-add them.) Every
// quantity is a continuous function of time, evolving smoothly at 60fps; amplitudes are
// fed in by the SignalGlitch envelope.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPic;
uniform vec2 uRes;      // canvas size in pixels
uniform float uTime;    // seconds since this episode started
uniform float uEnv;     // master envelope 0..1
uniform float uSeed;    // drawn once per episode
uniform float uTear;    // horizontal tear amplitude (px)
uniform float uChroma;  // chroma-split baseline (px)
uniform float uSplit;   // TikTok-style split amplitude (px, full-screen)
uniform float uGhost;   // red/cyan ghost blend 0..1
uniform float uSnow;    // snow amount 0..1
uniform float uVJit;    // vertical jitter (px)
uniform float uRoll;    // vertical-roll wrap (fraction of frame height, signed)

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;

  // Vertical roll: whole-frame wrap (fract = true wrap, bottom edge folds to the top).
  float yR = fract(uv.y + uRoll);
  // Vertical jitter: eased continuously per scanline block.
  float vj = (fbm(vec2(uSeed, yR * 110.0) + vec2(0.0, uTime * 2.2)) - 0.5) * uVJit / uRes.y;
  float y = fract(yR + vj);

  // — Line-level horizontal micro-drift: low-frequency and continuous, just enough to
  //   fray vertical edges — never a tear band.
  float drift = fbm(vec2(uSeed + 7.0, y * 7.0) - vec2(uTime * 0.4, 0.0)) - 0.5;
  float offPx = drift * uTear * 0.35;

  vec2 suv = vec2(uv.x + offPx / uRes.x, y);

  // — Red/cyan main effect: full-screen horizontal R/B split — a baseline (∝ micro-drift)
  //   plus the big TikTok split; purely horizontal, no bands, present on every episode.
  float caPx = uChroma + abs(offPx) * 0.05 + uSplit;
  vec2 caOff = vec2(caPx, 0.0) / uRes;
  vec3 col;
  col.r = texture2D(uPic, suv + caOff).r;
  col.g = texture2D(uPic, suv).g;
  col.b = texture2D(uPic, suv - caOff).b;

  // — Red/cyan ghosts (TikTok-logo feel): offset samples tinted pure red / pure cyan by
  //   luminance and lerped in (screen blending would wash out on bright backgrounds, so
  //   it must be mix). Each ghost reads the luminance from its own direction and the two
  //   combine with max — whichever source is brighter shows, no muddy average.
  float lr = min(dot(texture2D(uPic, suv + caOff * 2.4).rgb, vec3(0.3, 0.59, 0.11)) * 1.15, 1.0);
  float lb = min(dot(texture2D(uPic, suv - caOff * 2.4).rgb, vec3(0.3, 0.59, 0.11)) * 1.15, 1.0);
  vec3 ghostCol = max(vec3(1.0, 0.08, 0.3) * lr, vec3(0.1, 0.95, 1.0) * lb);
  col = mix(col, ghostCol, uGhost);

  // — Snow: fine grain + coarse interference + colored chroma noise, uniform across the
  //   screen, never banded.
  float fine = fbm(vec2(uv.x * 260.0, uv.y * 150.0) + vec2(uTime * 60.0, uTime * 38.0)) - 0.5;
  float coarse = fbm(vec2(uv.x * 34.0, uv.y * 22.0) - vec2(uTime * 13.0, uTime * 7.0)) - 0.5;
  col += (fine * 0.55 + coarse * 0.45) * uSnow * 0.55;
  col += (noise(vec2(uv.x * 180.0, uv.y * 120.0) + uTime * 50.0) - 0.5)
         * uSnow * vec3(0.10, 0.07, 0.11);

  // — Soft black edges only when sampling actually leaves [0,1] (no dark bands along the
  //   sides otherwise).
  float edgeX = clamp(suv.x * 400.0, 0.0, 1.0) * clamp((1.0 - suv.x) * 400.0, 0.0, 1.0);
  col *= edgeX;

  // Very light overall brightness breathing.
  col *= 1.0 + (uEnv - 0.5) * 0.03;

  gl_FragColor = vec4(col, 1.0);
}
`;

export type GlitchUniforms = {
  time: number;
  env: number;
  tear: number;
  chroma: number;
  split: number;
  ghost: number;
  snow: number;
  vjit: number;
  roll: number;
};

const UNIFORM_NAMES = [
  "uPic",
  "uRes",
  "uTime",
  "uEnv",
  "uSeed",
  "uTear",
  "uChroma",
  "uSplit",
  "uGhost",
  "uSnow",
  "uVJit",
  "uRoll",
] as const;

function compile(gl: WebGLRenderingContext, kind: number, src: string) {
  const sh = gl.createShader(kind);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

export class GlitchRenderer {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc: Partial<Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>> = {};

  constructor(canvas: HTMLCanvasElement, seed: number) {
    // preserveDrawingBuffer: probes and screenshots must be able to read pixels back
    // (negligible cost).
    const gl = canvas.getContext("webgl", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("no webgl");
    this.gl = gl;

    const prog = gl.createProgram();
    if (!prog) throw new Error("createProgram failed");
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
    }
    this.prog = prog;
    for (const n of UNIFORM_NAMES) this.loc[n] = gl.getUniformLocation(prog, n);

    // Fullscreen quad (drawn as a single triangle strip).
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform1i(this.loc.uPic!, 0);
    gl.uniform2f(this.loc.uRes!, canvas.width, canvas.height);
    gl.uniform1f(this.loc.uSeed!, seed);
  }

  /** Uploads the frozen frame (DOM is top-down; flip Y to match GL's y-up). */
  setPicture(src: HTMLCanvasElement) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  draw(u: GlitchUniforms) {
    const gl = this.gl;
    gl.uniform1f(this.loc.uTime!, u.time);
    gl.uniform1f(this.loc.uEnv!, u.env);
    gl.uniform1f(this.loc.uTear!, u.tear);
    gl.uniform1f(this.loc.uChroma!, u.chroma);
    gl.uniform1f(this.loc.uSplit!, u.split);
    gl.uniform1f(this.loc.uGhost!, u.ghost);
    gl.uniform1f(this.loc.uSnow!, u.snow);
    gl.uniform1f(this.loc.uVJit!, u.vjit);
    gl.uniform1f(this.loc.uRoll!, u.roll);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
