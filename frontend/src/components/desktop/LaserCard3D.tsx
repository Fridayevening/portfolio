"use client";

// Interactive 3D inspection of the rendered laser card — the in-window port of the
// proto demo (proto/laser-card-blender/web/example-glb.html). The GLB carries geometry,
// print textures and glass materials only: the strip lights / aurora wall Cycles had
// live here as a PMREM environment (glass needs something to refract), and the
// exporter-dropped thin-film iridescence is restored on load. The iridescence recipe
// (noise thickness map + ripple normals + ring aurora plate) was tuned against the
// Blender frontal still in a /tmp harness — see docs/06-imgtool-imglab.md. The canvas
// lifecycle is fully imperative — StrictMode double-mounts kill JSX canvases.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useI18n } from "@/lib/i18n/LanguageContext";

// Backdrop: the catalog sweep — of the proto's three presets it gives the glass shell
// its strongest definition (bright field the refraction reads as a darker shape).
function pool(c0: string, c1: string, c2: string) {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 900;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(450, 400, 60, 450, 450, 560);
  g.addColorStop(0, c0);
  g.addColorStop(0.5, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 900, 900);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- procedural noise (value-noise fbm) ------------------------------------
// Bakes the two maps the GLB exporter severs from the Cycles material: the noise-driven
// thin-film thickness (color pools) and the wave-scale bump (wavy reflections).

function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, oct: number, seed: number) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f, y * f, seed + i);
    tot += amp;
    amp *= 0.5;
    f *= 2.05;
  }
  return v / tot;
}

// Thickness pools: low-frequency domain-warped fbm (~1.3 cycles across the face, so a
// couple of LARGE pools, not an even wash), sharpened with pow so most of the shell
// sits quiet while a few pools run rich, then windowed to [0.38, 0.62] — the same Map
// Range band scene.py uses, which keeps the pools in the cyan/green interference
// orders instead of spending area on flat pink.
function thicknessTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const wx = fbm(u * 2, v * 2, 2, 11) - 0.5;
      const wy = fbm(u * 2 + 5.2, v * 2 + 1.3, 2, 17) - 0.5;
      const n = Math.pow(fbm(u * 1.3 + 0.7 * wx, v * 1.3 + 0.7 * wy, 3, 3), 2.2);
      // window [0.30, 0.58]: one notch below Blender's Map Range (0.38) — three's film
      // model runs ~40° redder than Cycles at equal thickness; the lower window
      // lands the pools back in the cyan/green family the still has.
      const g = Math.round(Math.min(1, Math.max(0, 0.30 + 0.28 * n)) * 255);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ripple normals: gentle wave-scale fbm (35 cycles, strength 1.5) -> height ->
// derivative normals. Strong/dense ripples shred the pools into the "even water
// texture" look; this strength keeps a slow flowing streak in the reflections while
// the pools stay coherent.
function rippleNormalTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = fbm((x / S) * 35, (y / S) * 35, 4, 29);
  const strength = 1.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const xl = h[y * S + ((x - 1 + S) % S)], xr = h[y * S + ((x + 1) % S)];
      const yd = h[((y - 1 + S) % S) * S + x], yu = h[((y + 1) % S) * S + x];
      let nx = (xl - xr) * strength, ny = (yd - yu) * strength;
      const len = Math.hypot(nx, ny, 1);
      nx /= len; ny /= len;
      const i = (y * S + x) * 4;
      img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ring aurora: dark center, bright tinted rim. A frontal face reflects the plate's
// middle (dark = the photo stays clean through the glass) while the grazing shell
// margins reflect the edges — that division is what lets the film IOR stay physical
// AND the rainbow read loud, instead of one gain knob washing out both.
function ringAuroraTexture() {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5, dy = y / S - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) / 0.5);
      const ang = Math.atan2(dy, dx);
      const hue = 170 + 190 * (ang / Math.PI / 2 + 0.5); // spectral sweep cyan..green..pink
      const lum = 0.06 + 0.94 * Math.pow(Math.max(0, (r - 0.3) / 0.7), 1.4);
      const sat = 0.5 * Math.pow(r, 0.5);
      const ch = (h: number) =>
        Math.min(255, Math.max(0, 255 * (lum + sat * Math.cos(((h - hue) * Math.PI) / 180))));
      const i = (y * S + x) * 4;
      img.data[i] = ch(0);
      img.data[i + 1] = ch(120);
      img.data[i + 2] = ch(240);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function LaserCard3D({ glb, downloadName }: { glb: Blob; downloadName: string }) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    // preserveDrawingBuffer (site rule, doc 07 §4.2): the drawing buffer is cleared
    // after compositing, so the screenshot pipeline — which reads canvases back
    // asynchronously — would otherwise capture this window blank.
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // AgX matches the Blender still's view transform — its highlight desaturation is
    // what makes the film colors read as soft pastel (sunlight-on-oil-film) instead
    // of a saturated holographic sticker; ACES keeps them neon by comparison.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = pool("#d8d2e4", "#b2acc4", "#85809a");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0, 3.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.8;
    controls.maxDistance = 6;

    // Environment: black room + strip lights + ring aurora wall, PMREM-baked. Gains
    // follow scene.py's watt ratios (900:700:600:1200) and the sweep sits at its fixed
    // high/far spot so its glare lands on the shell's top margin, not the photo.
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x000000);
    const strip = (color: number, k: number, w: number, h: number, pos: THREE.Vector3) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }),
      );
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    strip(0xff9ed2, 3.8, 5.0, 0.55, new THREE.Vector3(-3.2, 1.6, 2.4));
    strip(0x7fe8ff, 2.9, 5.0, 0.45, new THREE.Vector3(3.4, 0.4, 1.8));
    strip(0xb28cff, 2.5, 4.0, 0.7, new THREE.Vector3(0.6, 3.6, -2.6));
    strip(0xfff6ee, 5.0, 7.0, 0.28, new THREE.Vector3(-0.4, 3.4, 5.5));
    const auroraTex = ringAuroraTexture();
    const aurora = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 11),
      new THREE.MeshBasicMaterial({ map: auroraTex, color: new THREE.Color(1, 1, 1).multiplyScalar(5) }),
    );
    aurora.position.set(0.2, 0.3, 5.2);
    aurora.lookAt(0, 0, 0);
    env.add(aurora);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(env, 0.05).texture;
    scene.environment = envTex;
    pmrem.dispose();
    // Everything in the env scene is baked into envTex now — free its GPU side.
    env.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (mesh.material as THREE.MeshBasicMaterial).dispose();
    });
    auroraTex.dispose();

    let card: THREE.Group | null = null;
    let shellMat: THREE.MeshPhysicalMaterial | null = null;

    void glb.arrayBuffer().then((buf) => {
      if (cancelled) return;
      new GLTFLoader().parse(
        buf,
        "",
        (gltf) => {
          if (cancelled) return;
          card = gltf.scene;
          card.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const m = mesh.material as THREE.MeshPhysicalMaterial;
            // Blender 5.2's exporter drops Principled Thin Film (KHR iridescence never
            // lands in the file) and severs the noise/normal links — restore both, plus
            // the thickness map: without it three pins the whole shell at the range max
            // (one flat tint instead of color pools). Roughness 0.13 ≈ Cycles 0.26 GGX.
            if (m.transmission > 0) {
              m.iridescence = 1;
              m.iridescenceIOR = 1.32;
              m.iridescenceThicknessRange = [130, 560];
              m.iridescenceThicknessMap = thicknessTexture();
              m.normalMap = rippleNormalTexture();
              m.roughness = 0.13;
              shellMat = m;
            }
            // BLEND-alpha safety net (scene.py patches MASK, older glbs may not): three's
            // transmission pass skips transparent objects, so a BLEND card would vanish
            // behind the glass; r186 also zeroes depthWrite for BLEND, making the front
            // plate paint over the back one from behind.
            if (m.transparent && m.map) {
              m.transparent = false;
              m.alphaTest = 0.5;
              m.depthWrite = true;
            }
            // Print plates are emission-only: any diffuse base gets tinted by the env.
            if (m.emissiveMap) {
              m.color.set(0x000000);
              m.specularIntensity = 0;
              m.roughness = 1;
            }
          });
          scene.add(card);
        },
        (err) => console.error("laser-card glb parse failed", err),
      );
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const clock = new THREE.Clock();
    const n = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const toCam = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      if (card) card.rotation.y = Math.sin(t * 0.35) * 0.25;
      if (card && shellMat) {
        // View-angle ramp. The rainbow itself now runs at full strength even dead-frontal
        // (matching the Blender still, where the margins are colorful head-on); what the
        // ramp modulates is only the two frontal-wash guards: clearcoat (its IBL ignores
        // envMapIntensity, so a frontal value above ~0.2 glazes the photo) and the shell
        // IOR (the transmission shader samples the env directly — low IOR frontally keeps
        // the photo clean, full 1.5 once tilted).
        card.getWorldQuaternion(q);
        n.set(0, 0, 1).applyQuaternion(q).normalize();
        toCam.copy(camera.position).sub(card.position).normalize();
        const facing = n.dot(toCam);
        const k = THREE.MathUtils.smoothstep(1 - facing, 0.1, 0.5);
        shellMat.clearcoat = 0.15 + 0.75 * k;
        shellMat.ior = 1.1 + 0.4 * k;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      envTex.dispose();
      if (card) {
        card.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const m = mesh.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        });
      }
      scene.clear();
      (scene.background as THREE.Texture).dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // repeated toggles must not accumulate WebGL contexts
      host.removeChild(renderer.domElement);
    };
  }, [glb]);

  return (
    <div ref={hostRef} className="relative flex-1 min-h-0 bevel-thin-in bg-black overflow-hidden">
      <span className="absolute bottom-[6px] left-0 right-0 text-center text-[10px] text-[#ddd8c8]/40 pointer-events-none">
        {t("laser3d.controls")}
      </span>
      <button
        type="button"
        className="absolute top-[6px] right-[6px] bevel-thin-out bg-chrome px-3 py-[2px] text-[11px] press"
        onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(glb);
          a.download = downloadName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 10_000); // the download needs the URL alive briefly
        }}
      >
        {t("laser3d.download")}
      </button>
    </div>
  );
}
