// DOM snapshotting: rasterize an element into a 2D canvas. Two consumers share this
// one pipeline: the WebGL glitch shader's picture texture (default opts — frozen frame
// gets smeared, fidelity doesn't matter) and the screenshot tool (ShotOpts — "honest
// snapshot" fidelity, doc 07 §4.2).
// Route: clone the subtree → serialize into <svg><foreignObject> → decode via <img> →
// drawImage.
// Three walls that must be climbed (all hit in practice):
//   1. An SVG decoded through <img> runs in "secure static mode" and loads no external
//      resources — every url(...) in the stylesheets (woff2 in @font-face etc.) must be
//      inlined as a data URL, and <img> tags in the clone likewise. Site-wide CSS/fonts
//      are inlined once on first use and cached from then on.
//   2. url() relative paths resolve against *their own stylesheet* (dev cssText shows
//      ../media/…); resolving against the page URL 404s — so each sheet uses sheet.href
//      as its base. Skip #fragment refs (SVG filter references, not fetchable) and check
//      response.ok, so a 404 page is never used as a font.
//   3. The SVG image must go through a data: URL, never blob: — Chromium flags
//      foreignObject SVGs from blob URLs as cross-origin tainted, and a tainted canvas
//      cannot be uploaded as a WebGL texture (a decade-old trap; data URLs don't
//      trigger it).
// Also: the snapshot document has no <body>, so body's base typography is re-applied on
// the wrapper div.
// Any failure returns null — the caller abandons this episode and leaves the real page
// alone.

/** Screenshot passes (doc 07 §1.2): everything cloneNode cannot carry. Default
 *  (no opts) keeps the glitch path byte-identical. */
export type ShotOpts = {
  /** Draw each live canvas's bitmap into its clone twin — cloned canvases are blank,
   *  and every canvas on the desktop (nes / laser card / repair game) is imperative. */
  copyCanvas?: boolean;
  /** Replace <video> with a canvas holding the current frame (secure static mode
   *  renders no <video> anyway; the glitch path just deletes them). */
  videoFrames?: boolean;
  /** Replace <img> with a canvas of the CURRENT frame via drawImage — GIFs freeze
   *  where they visibly are, unlike the fetch+re-encode path which decodes frame 0. */
  imgLive?: boolean;
  /** Mirror form state: input value/checked; textarea → equivalent div (value text
   *  + internal scroll offset); select → selected options. */
  mirrorForm?: boolean;
  /** Mirror scroll offsets: wrap scrolled children in a translated div (a detached
   *  clone renders scrolled back to the top). */
  mirrorScroll?: boolean;
};

/** Pair live/clone descendants of the same selector; cloneNode preserves document
 *  order, so index pairing is exact. */
function pairAll<T extends Element>(live: HTMLElement, clone: HTMLElement, sel: string) {
  const ls = Array.from(live.querySelectorAll<T>(sel));
  const cs = Array.from(clone.querySelectorAll(sel));
  const out: { l: T; c: T }[] = [];
  ls.forEach((l, i) => {
    const c = cs[i];
    if (c) out.push({ l, c: c as T });
  });
  return out;
}

function copyCanvases(live: HTMLElement, clone: HTMLElement) {
  for (const { l, c } of pairAll<HTMLCanvasElement>(live, clone, "canvas")) {
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    try {
      // 1:1 at the live intrinsic size: aspect ratio, object-fit and inline
      // image-rendering (pixelated pixel art) all carry over through the copied
      // attributes/styles, and the SVG engine then does the display scaling.
      // WebGL sources need preserveDrawingBuffer at creation (site rule) or read blank.
      ctx.drawImage(l, 0, 0);
    } catch {
      // Cross-origin canvas: leave blank rather than taint the whole shot.
    }
  }
}

function replaceVideos(live: HTMLElement, clone: HTMLElement) {
  for (const { l, c } of pairAll<HTMLVideoElement>(live, clone, "video")) {
    const cv = document.createElement("canvas");
    cv.width = l.videoWidth || 300;
    cv.height = l.videoHeight || 150;
    const ctx = cv.getContext("2d");
    if (ctx) {
      try {
        if (l.videoWidth) ctx.drawImage(l, 0, 0);
        else {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, cv.width, cv.height);
        }
      } catch {
        // Undecodable frame: keep the black canvas box.
      }
    }
    cv.className = c.className;
    const style = c.getAttribute("style");
    if (style) cv.setAttribute("style", style);
    c.replaceWith(cv);
  }
}

/** Carry an element's class + inline style onto a canvas that replaces it. */
function canvasTwinOf(img: Element, w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  cv.className = img.className;
  const style = img.getAttribute("style");
  if (style) cv.setAttribute("style", style);
  return cv;
}

function mirrorForms(live: HTMLElement, clone: HTMLElement) {
  for (const { l, c } of pairAll<HTMLInputElement>(live, clone, "input")) {
    if (l.type === "checkbox" || l.type === "radio") {
      if (l.checked) c.setAttribute("checked", "");
      else c.removeAttribute("checked");
    } else if (l.type !== "button" && l.type !== "submit" && l.type !== "reset") {
      c.setAttribute("value", l.value);
    }
  }
  // Textareas are replaced by div replicas: cloneNode loses the value, and the
  // internal scroll offset can't be reproduced on a native textarea at all.
  for (const { l, c } of pairAll<HTMLTextAreaElement>(live, clone, "textarea")) {
    const cs = getComputedStyle(l);
    const div = document.createElement("div");
    // Full computed style = pixel-identical box without re-resolving classes; the
    // appended longhands override the resolved overflow with a clipping one.
    div.setAttribute(
      "style",
      cs.cssText + ";white-space:pre-wrap;overflow-wrap:break-word;overflow:hidden;",
    );
    const pad =
      parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
    const inner = document.createElement("div");
    inner.setAttribute(
      "style",
      `width:${Math.max(0, l.clientWidth - pad)}px;transform:translateY(${-l.scrollTop}px);`,
    );
    inner.textContent = l.value;
    div.appendChild(inner);
    c.replaceWith(div);
  }
  for (const { l, c } of pairAll<HTMLSelectElement>(live, clone, "select")) {
    Array.from(l.options).forEach((o, i) => {
      const k = c.options[i];
      if (!k) return;
      if (o.selected) k.setAttribute("selected", "");
      else k.removeAttribute("selected");
    });
  }
}

function mirrorScroll(live: HTMLElement, clone: HTMLElement) {
  // Layout properties the wrapper must inherit so wrapped children keep arranging
  // the same way (flex lists, grid lists). Padding stays on the container.
  const CARRY = [
    "display",
    "flex-direction",
    "flex-wrap",
    "row-gap",
    "column-gap",
    "align-items",
    "justify-content",
    "grid-template-columns",
    "grid-template-rows",
    "grid-auto-flow",
  ];
  const ls = Array.from(live.querySelectorAll<HTMLElement>("*"));
  const cs = Array.from(clone.querySelectorAll<HTMLElement>("*"));
  ls.forEach((ln, i) => {
    const st = ln.scrollTop;
    const sl = ln.scrollLeft;
    // Textareas are handled by mirrorForms (their scroll is internal, no children).
    if ((!st && !sl) || ln instanceof HTMLTextAreaElement) return;
    const cn = cs[i];
    if (!cn) return;
    const style = getComputedStyle(ln);
    const wrap = document.createElement("div");
    wrap.setAttribute(
      "style",
      `transform:translate(${-sl}px,${-st}px);` +
        CARRY.map((p) => `${p}:${style.getPropertyValue(p)};`).join(""),
    );
    while (cn.firstChild) wrap.appendChild(cn.firstChild);
    cn.appendChild(wrap);
    cn.style.overflow = "hidden";
  });
}

let cssCache: Promise<string> | null = null;

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(b);
  });

/** Site-wide CSS with every external reference inlined (woff2 etc. url() → data URL);
 *  cached and reused. */
function inlinedCss(): Promise<string> {
  if (!cssCache) {
    cssCache = (async () => {
      // Each sheet carries its own URL base.
      const sheets: { text: string; base: string }[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          let text = "";
          for (const rule of Array.from(sheet.cssRules)) text += rule.cssText + "\n";
          sheets.push({ text, base: sheet.href ?? document.baseURI });
        } catch {
        }
      }
      const re = /url\((['"]?)([^'")]+)\1\)/g;
      const data = new Map<string, string>();
      const jobs: Promise<void>[] = [];
      for (const { text, base } of sheets) {
        text.replace(re, (_m, _q: string, u: string) => {
          if (!u.startsWith("data:") && !u.startsWith("#")) {
            const abs = new URL(u, base).href;
            if (!data.has(abs)) {
              data.set(abs, "");
              jobs.push(
                fetch(abs)
                  .then(async (r) => {
                    if (r.ok) data.set(abs, await blobToDataUrl(await r.blob()));
                  })
                  .catch(() => {}),
              );
            }
          }
          return "";
        });
      }
      await Promise.all(jobs);
      return sheets
        .map(({ text, base }) =>
          text.replace(re, (m, q: string, u: string) => {
            if (u.startsWith("data:") || u.startsWith("#")) return m;
            const d = data.get(new URL(u, base).href);
            return d ? `url("${d}")` : m;
          }),
        )
        .join("\n");
    })();
  }
  return cssCache;
}

/** Prewarm: inline the CSS/fonts while idle. */
export function warmSnapshot() {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => void inlinedCss());
  } else {
    setTimeout(() => void inlinedCss(), 1500);
  }
}

// Re-encoded <img> cache, keyed by URL. Inlining raw image files can drag megabytes
// into the SVG — one 6 MB GIF bloated it to 9.7 MB and its decode alone cost 200 ms
// of main-thread time per snapshot. The frozen frame gets smeared by glitch effects
// anyway, so a display-size re-encode is visually identical.
const thumbCache = new Map<string, string>();

/** Rasterize an element into a canvas scaled by dpr; null on failure. */
export async function rasterizeElement(
  el: HTMLElement,
  dpr: number,
  opts?: ShotOpts,
): Promise<HTMLCanvasElement | null> {
  try {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w <= 0 || h <= 0) return null;
    // Scale contract: SVG user units = CSS pixels (width/height take the rect's CSS
    // size, and the wrapper div matches), while the canvas is ×dpr device pixels;
    // drawImage re-rasterizes the vector at the destination size, crisp and
    // uncompromised. If the SVG were also ×dpr, Retina content would end up shrunk to
    // half size in the canvas corner.

    const clone = el.cloneNode(true) as HTMLElement;
    if (opts?.videoFrames) {
      clone.querySelectorAll("audio").forEach((n) => n.remove());
      replaceVideos(el, clone);
    } else {
      clone.querySelectorAll("audio, video").forEach((n) => n.remove());
    }
    if (opts?.copyCanvas) copyCanvases(el, clone);
    if (opts?.mirrorScroll) mirrorScroll(el, clone);
    if (opts?.mirrorForm) mirrorForms(el, clone);
    // <img> → downscaled data URL (secure static mode accepts no external refs).
    // Display sizes come from the live element — the detached clone has no layout.
    const liveImgs = Array.from(el.querySelectorAll("img"));
    const cloneImgs = Array.from(clone.querySelectorAll("img"));
    await Promise.all(
      liveImgs.map(async (li, i) => {
        const img = cloneImgs[i];
        if (!img) return;
        const src = li.currentSrc || li.getAttribute("src") || "";
        if (!src || src.startsWith("data:")) return;
        if (opts?.imgLive) {
          // Live drawImage = the CURRENT frame (GIFs freeze in place) at full
          // resolution. Same-origin only: a cross-origin bitmap would taint the
          // output canvas at readback — the whole shot, not just this image.
          let sameOrigin = false;
          try {
            sameOrigin = new URL(src, document.baseURI).origin === location.origin;
          } catch {
            sameOrigin = false;
          }
          if (sameOrigin && li.naturalWidth && li.naturalHeight) {
            const cv = canvasTwinOf(img, li.naturalWidth, li.naturalHeight);
            const ctx = cv.getContext("2d");
            if (ctx) {
              ctx.drawImage(li, 0, 0);
              img.replaceWith(cv);
              return;
            }
          }
          // Cross-origin or undecoded → the re-encode path below.
        }
        try {
          const cached = thumbCache.get(src);
          if (cached) {
            img.src = cached;
            return;
          }
          const r = await fetch(src);
          if (!r.ok) return;
          const bmp = await createImageBitmap(await r.blob());
          const box = li.getBoundingClientRect();
          let tw = Math.max(1, Math.round(Math.min(box.width || bmp.width, bmp.width)));
          let th = Math.max(1, Math.round(Math.min(box.height || bmp.height, bmp.height)));
          const cap = Math.max(tw, th);
          if (cap > 512) {
            tw = Math.round((tw * 512) / cap);
            th = Math.round((th * 512) / cap);
          }
          const cv = document.createElement("canvas");
          cv.width = tw;
          cv.height = th;
          cv.getContext("2d")!.drawImage(bmp, 0, 0, tw, th);
          const url = cv.toDataURL("image/webp", 0.75);
          thumbCache.set(src, url);
          img.src = url;
        } catch {
        }
      }),
    );

    const css = await inlinedCss();
    // <style> content must be entity-escaped inside XML; body's base typography is
    // re-applied on the wrapper div.
    const xhtml = new XMLSerializer().serializeToString(clone);
    const safeCss = css.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    // The frozen frame renders in "base state": inside SVG-as-img, CSS animations replay
    // from 0%, and if an entrance animation's 0% is opacity:0 (e.g. clip-enter) the
    // element simply vanishes from the snapshot; breathing/swaying kinds parked at a
    // random step would also dim for no reason (the old version hand-removed
    // crt-flicker as a patch — this collects them all). Every entrance/exit in the site
    // is designed so "animations off = naturally visible" (the reduced-motion
    // fallback), so base state is the cleanest freeze.
    const freeze = "*{animation:none!important;transition:none!important}";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;` +
      `color:#0a0a0a;font-family:var(--font-mono);">` +
      `<style>${safeCss}</style><style>${freeze}</style>${xhtml}` +
      `</div></foreignObject></svg>`;

    // data: URL (blob: would taint the canvas — see the file header).
    const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg decode failed"));
      img.src = src;
    });
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    // Taint probe: reading one pixel throws right here if the canvas is polluted.
    ctx.getImageData(0, 0, 1, 1);
    return cv;
  } catch {
    return null;
  }
}
