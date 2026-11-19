"use strict";

// ---------- Persisted settings (localStorage; degrades to defaults if blocked) ----------
const SETTINGS_KEY = "mandelbrot-settings";
const SETTINGS = (() => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch (e) { return {}; }
})();
function saveSetting(key, value) {
  SETTINGS[key] = value;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); }
  catch (e) { /* storage blocked (some file:// origins) → session-only */ }
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const statusEl = $("status");
const zoomBadge = $("zoomBadge");

// Zoom factor relative to the default view (DEFAULTS.rectW spans the whole set = 1x).
// Compact formatting: fixed decimals while shallow, scientific once it blows past 1e6.
function formatZoom(z) {
  if (z >= 1e6)      return z.toExponential(1).replace("e+", "e");
  if (z >= 100)      return Math.round(z).toLocaleString();
  // Trailing zeros trimmed via +(): 1.00→1, 2.50→2.5, 1.23→1.23.
  if (z >= 10)       return String(+z.toFixed(1));
  return String(+z.toFixed(2));
}
function updateZoomBadge() {
  zoomBadge.textContent = `Zoom: ${formatZoom(DEFAULTS.rectW / state.spanW)}x`;
}

// Transparent layer over the canvas for per-tile "computing" spinners.
const loadCanvas = $("loadCanvas");
const loadCtx = loadCanvas.getContext("2d");

// Transparent layer for the painted-descendant look-ahead markers (under the
// spinner layer, over the fractal).
const exploreCanvas = $("exploreCanvas");
const exploreCtx = exploreCanvas.getContext("2d");

// Offscreen buffer used to shift the rendered pixels during a pan drag.
const buffer = document.createElement("canvas");
const bctx = buffer.getContext("2d");

const els = {
  centerX: $("centerX"), centerY: $("centerY"),
  rectW: $("rectW"), rectH: $("rectH"),
  pxW: $("pxW"), pxH: $("pxH"),
  maxIter: $("maxIter"), escapeR: $("escapeR"), power: $("power"),
  palettePreset: $("palettePreset"), cycles: $("cycles"), offset: $("offset"),
  smooth: $("smooth"), interiorColor: $("interiorColor"),
  customStops: $("customStops"), stopList: $("stopList"), addStop: $("addStop"),
  autoPaint: $("autoPaintCenter"),
};

// Auto-paint the tile under the center reticle on every settled view change.
// Persisted per mode (see autoPaintSettingKey): defaults off in rooms. Off until a mode is entered (the lobby never
// paints). The reticle stays visible regardless — it marks the view center
// and wheel-zoom anchor, not just the paint target.
let autoPaintCenter = false;

const DEFAULTS = {
  centerX: -0.5, centerY: 0, rectW: 3.5, rectH: 2.625,
  pxW: 800, pxH: 600, maxIter: 500, escapeR: 2, power: 2,
};

// ---------- Color helpers ----------
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  const c = (v) => v.toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

// Preset gradients: array of {pos 0..1, color [r,g,b]}
const PRESETS = {
  classic: [
    { pos: 0.0, color: [0, 7, 100] },
    { pos: 0.16, color: [32, 107, 203] },
    { pos: 0.42, color: [237, 255, 255] },
    { pos: 0.6425, color: [255, 170, 0] },
    { pos: 0.8575, color: [0, 2, 0] },
    { pos: 1.0, color: [0, 7, 100] },
  ],
  fire: [
    { pos: 0.0, color: [0, 0, 0] },
    { pos: 0.25, color: [120, 20, 0] },
    { pos: 0.5, color: [230, 80, 0] },
    { pos: 0.75, color: [255, 200, 40] },
    { pos: 1.0, color: [255, 255, 220] },
  ],
  ice: [
    { pos: 0.0, color: [3, 8, 28] },
    { pos: 0.4, color: [20, 90, 170] },
    { pos: 0.7, color: [120, 200, 240] },
    { pos: 1.0, color: [240, 255, 255] },
  ],
  grayscale: [
    { pos: 0.0, color: [0, 0, 0] },
    { pos: 1.0, color: [255, 255, 255] },
  ],
  rainbow: [
    { pos: 0.0, color: [148, 0, 211] },
    { pos: 0.17, color: [75, 0, 130] },
    { pos: 0.33, color: [0, 0, 255] },
    { pos: 0.5, color: [0, 255, 0] },
    { pos: 0.67, color: [255, 255, 0] },
    { pos: 0.83, color: [255, 127, 0] },
    { pos: 1.0, color: [255, 0, 0] },
  ],
};

// Custom stops are stored separately and edited via UI.
let customStops = [
  { pos: 0.0, color: [10, 10, 40] },
  { pos: 0.5, color: [220, 60, 120] },
  { pos: 1.0, color: [255, 230, 120] },
];

function activeStops() {
  const preset = els.palettePreset.value;
  if (preset === "custom") return customStops;
  return PRESETS[preset] || PRESETS.classic;
}

// Build a 256-entry lookup table by interpolating gradient stops.
function buildPalette(stops) {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = sorted[0], hi = sorted[sorted.length - 1];
    for (let s = 0; s < sorted.length - 1; s++) {
      if (t >= sorted[s].pos && t <= sorted[s + 1].pos) {
        lo = sorted[s];
        hi = sorted[s + 1];
        break;
      }
    }
    const span = hi.pos - lo.pos || 1;
    const f = (t - lo.pos) / span;
    lut[i * 3] = lo.color[0] + (hi.color[0] - lo.color[0]) * f;
    lut[i * 3 + 1] = lo.color[1] + (hi.color[1] - lo.color[1]) * f;
    lut[i * 3 + 2] = lo.color[2] + (hi.color[2] - lo.color[2]) * f;
  }
  return lut;
}

// ============================================================================
// High-precision arithmetic (BigInt fixed-point)
// ----------------------------------------------------------------------------
// A value x is stored as a BigInt X with x ≈ X / 2^frac. The view *center* is
// kept this way so we can zoom far past the ~1e-14 limit of float64: at deep
// zoom the absolute coordinate needs hundreds of bits, but the per-pixel offset
// from center stays tiny and is handled in plain doubles (see perturbation).
// ============================================================================
const _dv = new DataView(new ArrayBuffer(8));

// Exact conversion of a double to fixed-point (round to nearest).
function fpFromDouble(d, frac) {
  if (d === 0 || !isFinite(d)) return 0n;
  _dv.setFloat64(0, d);
  const hi = _dv.getUint32(0), lo = _dv.getUint32(4);
  const sign = (hi >>> 31) ? -1n : 1n;
  let exp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo >>> 0);
  if (exp === 0) { exp = -1074; }            // subnormal
  else { mant |= 1n << 52n; exp = exp - 1075; } // 1023 bias + 52 mantissa bits
  let shift = exp + frac;                      // X = mant * 2^shift
  let X;
  if (shift >= 0) X = mant << BigInt(shift);
  else { const s = BigInt(-shift); X = (mant + (1n << (s - 1n))) >> s; }
  return sign * X;
}

function fpToDouble(X, frac) {
  if (X === 0n) return 0;
  const neg = X < 0n;
  let A = neg ? -X : X;
  const bits = A.toString(2).length;
  const shift = bits - 53;
  const mant = shift > 0 ? A >> BigInt(shift) : A << BigInt(-shift);
  const val = Number(mant) * Math.pow(2, shift - frac);
  return neg ? -val : val;
}

// Parse a decimal string (optionally with exponent) into fixed-point.
function fpFromDecimalString(s, frac) {
  s = (s || "").trim();
  if (!s) return 0n;
  let neg = false;
  if (s[0] === "-") { neg = true; s = s.slice(1); }
  else if (s[0] === "+") s = s.slice(1);
  let exp10 = 0;
  const eIdx = s.search(/[eE]/);
  if (eIdx >= 0) { exp10 = parseInt(s.slice(eIdx + 1), 10) || 0; s = s.slice(0, eIdx); }
  let [ip, fp = ""] = s.split(".");
  const digits = ((ip || "0") + fp).replace(/[^0-9]/g, "") || "0";
  const num = BigInt(digits);
  const F = BigInt(frac);
  const denomPow = fp.length - exp10; // value = num / 10^denomPow
  let X;
  if (denomPow <= 0) X = (num * 10n ** BigInt(-denomPow)) << F;
  else { const denom = 10n ** BigInt(denomPow); X = ((num << F) + denom / 2n) / denom; }
  return neg ? -X : X;
}

function fpToDecimalString(X, frac, digits) {
  const neg = X < 0n;
  const A = neg ? -X : X;
  const one = 1n << BigInt(frac);
  const ip = A / one;
  const fr = A % one;
  const fracStr = ((fr * 10n ** BigInt(digits)) / one).toString().padStart(digits, "0");
  return (neg ? "-" : "") + ip.toString() + (digits > 0 ? "." + fracStr : "");
}

// ---------- High-precision reference orbit (perturbation, power 2 only) ------
// Iterate Z -> Z^2 + C at full precision for the center C, storing each Z_n as
// a double (|Z_n| is O(1), so a double captures it well). Pixels are then
// computed relative to this orbit using only doubles.
function computeReferenceOrbit(cx, cy, frac, maxIter, escapeR) {
  const F = BigInt(frac);
  const Zx = new Float64Array(maxIter + 2);
  const Zy = new Float64Array(maxIter + 2);
  let zx = 0n, zy = 0n;
  const escSq = escapeR * escapeR;
  let n = 0;
  for (; n <= maxIter; n++) {
    const zxd = fpToDouble(zx, frac);
    const zyd = fpToDouble(zy, frac);
    Zx[n] = zxd; Zy[n] = zyd;
    if (zxd * zxd + zyd * zyd > escSq) { n++; break; }
    const zx2 = (zx * zx) >> F;
    const zy2 = (zy * zy) >> F;
    const xy = (zx * zy) >> F;
    zx = zx2 - zy2 + cx;
    zy = (xy << 1n) + cy;
  }
  return { Zx: Zx.slice(0, n), Zy: Zy.slice(0, n), refLen: n };
}

// ============================================================================
// View state: high-precision center + double span (square pixels)
// ============================================================================
const state = { cx: 0n, cy: 0n, frac: 64, spanW: DEFAULTS.rectW };

function initState() {
  state.frac = 64;
  state.spanW = DEFAULTS.rectW;
  state.cx = fpFromDecimalString(String(DEFAULTS.centerX), state.frac);
  state.cy = fpFromDecimalString(String(DEFAULTS.centerY), state.frac);
}

// Precision (in fraction bits) needed to resolve one pixel, plus guard bits.
function neededFrac(spanW, pxW) {
  let bits = Math.ceil(-Math.log2(spanW / pxW));
  if (!isFinite(bits)) bits = 64;
  return Math.min(4096, Math.max(64, bits + 40));
}

function rescaleState(newFrac) {
  if (newFrac === state.frac) return;
  if (newFrac > state.frac) {
    const d = BigInt(newFrac - state.frac);
    state.cx <<= d; state.cy <<= d;
  } else {
    const d = BigInt(state.frac - newFrac);
    state.cx >>= d; state.cy >>= d;
  }
  state.frac = newFrac;
}

function ensurePrecision() {
  const pxW = Math.max(16, parseFloat(els.pxW.value) || 800);
  rescaleState(neededFrac(state.spanW, pxW));
}

// Shift the center by real-plane offsets (small doubles) at full precision.
function applyCenterDelta(dxReal, dyReal) {
  state.cx += fpFromDouble(dxReal, state.frac);
  state.cy += fpFromDouble(dyReal, state.frac);
}

function syncFieldsFromState() {
  const pxW = Math.max(16, parseFloat(els.pxW.value) || 800);
  const pxH = Math.max(16, parseFloat(els.pxH.value) || 600);
  const scale = state.spanW / pxW;
  let digits = Math.ceil(-Math.log10(scale)) + 5;
  if (!isFinite(digits) || digits < 17) digits = 17;
  els.centerX.value = fpToDecimalString(state.cx, state.frac, digits);
  els.centerY.value = fpToDecimalString(state.cy, state.frac, digits);
  els.rectW.value = state.spanW;
  els.rectH.value = state.spanW * pxH / pxW;
}

// ---------- Rendering ----------
function readParams() {
  const num = (el, def) => {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : def;
  };
  return {
    pxW: Math.max(16, Math.min(4096, Math.round(num(els.pxW, DEFAULTS.pxW)))),
    pxH: Math.max(16, Math.min(4096, Math.round(num(els.pxH, DEFAULTS.pxH)))),
    maxIter: Math.max(1, Math.round(num(els.maxIter, DEFAULTS.maxIter))),
    escapeR: Math.max(1e-6, num(els.escapeR, DEFAULTS.escapeR)),
    power: num(els.power, DEFAULTS.power),
    cycles: Math.max(0.01, num(els.cycles, 1)),
    offset: num(els.offset, 0),
    smooth: els.smooth.checked,
    interior: hexToRgb(els.interiorColor.value),
  };
}

// ---------- Worker source (inlined so it also runs from file://) ------------
// Receives the reference orbit once per render ('ref' message), then renders
// tiles ('tile' message). Output is a Float32Array of *iteration values* (the
// smooth/continuous escape count; -1 = interior), NOT pixels — coloring is a
// cheap main-thread pass (see colorizePixels), so palette tweaks never trigger
// recompute and the values cache cleanly. For power==2 it uses perturbation +
// automatic rebasing (Zhuoran's method) so deep zooms stay accurate with double
// math; power!=2 falls back to direct double iteration (no precision at depth).
const WORKER_SRC = `
let REF = { Zx: null, Zy: null, refLen: 0 };

self.onmessage = function (e) {
  const m = e.data;
  if (m.type === "ref") { REF = { Zx: m.Zx, Zy: m.Zy, refLen: m.refLen }; return; }
  renderTile(m);
};

function renderTile(j) {
  const maxIter = j.maxIter, power = j.power;
  const escapeSq = j.escapeR * j.escapeR;
  const lnEscape = Math.log(j.escapeR);
  const lnPow = Math.log(Math.abs(power) || 2);
  const N = j.tilePx, tileScale = j.tileScale;
  // Perturbation works in offsets from the reference center: odx/ody is the
  // tile origin's offset (small doubles built via fixed-point on the main
  // thread), so we never form an absolute coordinate (catastrophic at depth).
  const odx = j.tileOriginDx, ody = j.tileOriginDy;
  const left = j.left, top = j.top;   // absolute origin, fallback (power!=2) only
  const usePerturb = (power === 2 && REF.Zx);
  const Zx = REF.Zx, Zy = REF.Zy, refLen = REF.refLen;
  const iter = new Float32Array(N * N);

  // Always returns the smooth/continuous value so toggling 'smooth' coloring is
  // free; the non-smooth look is recovered by flooring it at paint time.

  // --- Perturbation + rebasing: delta orbit relative to the reference. ---
  function perturb(dcx, dcy) {
    let dzx = 0, dzy = 0, refI = 0;
    for (let i = 0; i < maxIter; i++) {
      const Zxr = Zx[refI], Zyr = Zy[refI];
      const zx = Zxr + dzx, zy = Zyr + dzy;
      const zmag2 = zx * zx + zy * zy;
      if (zmag2 > escapeSq) {
        const logZn = Math.log(zmag2) / 2;
        return i + 1 - Math.log(logZn / lnEscape) / Math.LN2;
      }
      // dz_{n+1} = 2*Z_n*dz_n + dz_n^2 + dc
      const ndzx = 2 * (Zxr * dzx - Zyr * dzy) + (dzx * dzx - dzy * dzy) + dcx;
      const ndzy = 2 * (Zxr * dzy + Zyr * dzx) + (2 * dzx * dzy) + dcy;
      dzx = ndzx; dzy = ndzy;
      refI++;
      // Rebase: if the reference is about to run out, or the true value z is
      // smaller than the delta (the classic glitch condition), restart the
      // reference index and fold z back into the delta.
      if (refI >= refLen - 1) {
        dzx = Zx[refI] + dzx; dzy = Zy[refI] + dzy; refI = 0;
      } else {
        const fzx = Zx[refI] + dzx, fzy = Zy[refI] + dzy;
        if (fzx * fzx + fzy * fzy < dzx * dzx + dzy * dzy) {
          dzx = fzx; dzy = fzy; refI = 0;
        }
      }
    }
    return -1;
  }

  // --- Direct iteration (used for power != 2). ---
  function iterate(cx, cy) {
    let zx = 0, zy = 0, i = 0;
    let mag2 = 0;
    while (i < maxIter) {
      const r = Math.sqrt(zx * zx + zy * zy);
      if (r > 0) {
        const th = Math.atan2(zy, zx);
        const rd = Math.pow(r, power);
        zx = rd * Math.cos(power * th) + cx;
        zy = rd * Math.sin(power * th) + cy;
      } else { zx = cx; zy = cy; }
      mag2 = zx * zx + zy * zy;
      i++;
      if (mag2 > escapeSq) break;
    }
    if (i >= maxIter && mag2 <= escapeSq) return -1;
    const logZn = Math.log(mag2) / 2;
    return i + 1 - Math.log(logZn / lnEscape) / lnPow;
  }

  // Progressive refinement: compute a coarse subsample first (block-replicated so
  // the tile already looks complete), then fill in finer grids. Each stride
  // divides the previous, so the skip test computes every pixel exactly once
  // across all passes (no redundant work) — the final tile is identical to a
  // single full-res pass. The intermediate frames give an instant low-res preview
  // for the case the cheap ancestor placeholder can't cover: a big wheel-zoom that
  // jumps past every cached level, where otherwise you'd stare at a blank tile.
  const passes = (j.passes && j.passes.length) ? j.passes : [1];
  const sample = usePerturb
    ? (fx, fy) => perturb(odx + fx * tileScale, ody - fy * tileScale)
    : (fx, fy) => iterate(left + fx * tileScale, top - fy * tileScale);
  let prev = 0;
  for (let pi = 0; pi < passes.length; pi++) {
    const s = passes[pi];
    for (let ty = 0; ty < N; ty += s) {
      for (let tx = 0; tx < N; tx += s) {
        if (prev && tx % prev === 0 && ty % prev === 0) continue;  // done in a coarser pass
        const v = sample(tx + 0.5, ty + 0.5);
        const yEnd = ty + s < N ? ty + s : N, xEnd = tx + s < N ? tx + s : N;
        for (let by = ty; by < yEnd; by++) {
          const row = by * N;
          for (let bx = tx; bx < xEnd; bx++) iter[row + bx] = v;  // block-replicate
        }
      }
    }
    prev = s;
    if (pi === passes.length - 1) {
      self.postMessage({ jobId: j.jobId, gen: j.gen, key: j.key, iter: iter.buffer, final: true }, [iter.buffer]);
    } else {
      // Intermediate frame: send a copy so the worker keeps refining its buffer.
      const copy = new Float32Array(iter);
      self.postMessage({ jobId: j.jobId, gen: j.gen, key: j.key, iter: copy.buffer, final: false }, [copy.buffer]);
    }
  }
}
`;

// ---------- Worker pool ----------
// hardwareConcurrency reports logical *threads* (e.g. 32 on a 24-core/32-thread
// hybrid CPU), not physical cores. Default to all-but-one — leave a thread for
// the UI and the main-thread reference orbit — capped at 32. Tile compute is
// CPU-bound, so the optimum is roughly the core count and best found empirically
// (hyperthreads and E-cores scale sublinearly), hence the panel control.
const MAX_WORKERS = 64;
// Persisted choice wins; otherwise the smart default (all-but-one, capped at 32).
let NUM_WORKERS = SETTINGS.workers != null
  ? Math.max(1, Math.min(MAX_WORKERS, SETTINGS.workers))
  : Math.max(2, Math.min(
      // Phones/tablets throttle hard under sustained all-core load; 4 keeps
      // them responsive (still adjustable in the panel).
      window.matchMedia && matchMedia("(pointer: coarse)").matches ? 4 : 32,
      (navigator.hardwareConcurrency || 4) - 1));

let workers = [];
let idleWorkers = [];
let jobQueue = [];
let currentGen = 0;
let pendingTiles = 0;
let renderStart = 0;
let renderParams = null;
let currentLut = null;

// ============================================================================
// Tile pyramid (Google-Maps-style cache)
// ----------------------------------------------------------------------------
// The world is a quadtree: level L has 2^L x 2^L tiles, each TILE_PX square and
// spanning ROOT_SPAN/2^L in the complex plane. A tile is identified by
// (L, ix, iy) with ix/iy BigInt (deep zoom blows past 2^53). Each cached tile
// stores Float32 iteration values; neighbor/parent/child are *derived* from the
// key (arithmetic + a Map lookup) rather than stored as pointers — same O(1)
// access, no dangling references when tiles are evicted. ROOT_SPAN = 4 (a power
// of two) makes every tile boundary a dyadic rational, i.e. exact in fixed-point.
// ============================================================================
const TILE_PX = 256;            // pyramid tile resolution (px per side)
const ROOT_SPAN = 4;            // world span of level 0 (contains the whole set)
const MAX_CACHE_TILES = 384;    // in-memory LRU bound (~100 MB of Float32 values)
// Progressive tile passes: coarse subsample → finer, painted as they arrive so a
// deep wheel-zoom shows a blocky preview within a few ms instead of a blank tile.
// Strides must each divide the previous (so no pixel is computed twice); the last
// must be 1 (the exact full-res pass that gets cached).
const PROGRESSIVE_PASSES = [8, 2, 1];

let paramHash = "";             // tiles are only reusable within the same iter params
let currentCover = null;        // tiles covering the current view (for repaint)
const tileCache = new Map();    // key -> { key, iter, L, ix, iy, paramHash, ts }
const pendingKeys = new Set();  // keys with an in-flight compute job
const pendingDesc = new Map();  // key -> cover descriptor (where to paint the result)
let coverCount = 0, hitCount = 0, computeCount = 0, unexploredCount = 0; // status-line instrumentation
let lastCenter = { x: 0, y: 0 };   // view center as doubles, for late (paint-time) enqueues
let sessionComputed = 0, lastRenderMs = 0;          // info-panel instrumentation

// Scratch tile canvas: iteration values are colorized here, then drawImage()'d
// (and resampled) onto the viewport. Reused to avoid per-tile allocation.
const scratch = document.createElement("canvas");
scratch.width = TILE_PX; scratch.height = TILE_PX;
const sctx = scratch.getContext("2d");

// ---- Fixed-point pyramid geometry (frac bits, matching state.frac) ----
const rootLeftFp = (frac) => fpFromDecimalString("-2.5", frac); // ROOT_LEFT = -0.5 - 2
const rootTopFp = (frac) => fpFromDecimalString("2", frac);     // ROOT_TOP  =  0   + 2
// ROOT_SPAN = 4 = 2^2, so a level-L tile spans exactly 2^(frac+2-L) fixed-point units.
const tileSpanFp = (L, frac) => 1n << BigInt(frac + 2 - L);
// Floor division for BigInt (JS `/` truncates toward zero; we need toward -inf).
function floorDivBig(a, b) {
  let q = a / b;
  if ((a % b !== 0n) && ((a < 0n) !== (b < 0n))) q -= 1n;
  return q;
}
// Level whose tile pixels ~match the viewport's, so blits stay near 1:1.
// 6 = log2(TILE_PX) - log2(ROOT_SPAN) = 8 - 2.
const pickLevel = (spanW, pxW) => Math.max(0, Math.round(Math.log2(pxW / spanW) - 6));

// ---- Derived links (the neighbor/parent/child "references") ----
const tileKey = (L, ix, iy) => `${paramHash}|${L}:${ix}:${iy}`;
const parentKey = (L, ix, iy) => L > 0 ? tileKey(L - 1, ix >> 1n, iy >> 1n) : null;
const childKeys = (L, ix, iy) =>
  [tileKey(L + 1, ix * 2n, iy * 2n), tileKey(L + 1, ix * 2n + 1n, iy * 2n),
   tileKey(L + 1, ix * 2n, iy * 2n + 1n), tileKey(L + 1, ix * 2n + 1n, iy * 2n + 1n)];
const neighborKeys = (L, ix, iy) =>
  [tileKey(L, ix - 1n, iy), tileKey(L, ix + 1n, iy),
   tileKey(L, ix, iy - 1n), tileKey(L, ix, iy + 1n)];

// ---- LRU cache access ----
function cacheGet(key) {
  const t = tileCache.get(key);
  if (!t) return null;
  tileCache.delete(key); tileCache.set(key, t); // move to most-recently-used
  return t;
}
function cachePut(t) {
  tileCache.set(t.key, t);
  while (tileCache.size > MAX_CACHE_TILES) {
    tileCache.delete(tileCache.keys().next().value); // evict oldest
  }
}

// ============================================================================
// IndexedDB persistence: the memory LRU is the hot layer; this is the durable
// backing store so tiles survive reloads. Iteration values (Float32) and BigInt
// indices (as strings) structured-clone cleanly. Degrades to memory-only if the
// store can't be opened (some file:// configurations).
// ============================================================================
const DB_NAME = "mandelbrot-tiles", DB_STORE = "tiles";
let DB_MAX = SETTINGS.dbMax != null ? Math.max(1, SETTINGS.dbMax) : 1500;  // IndexedDB prune target; editable + persisted
// Always resolves (to the db, or null for memory-only) — never rejects, so the
// await in hydrateFromDB can't throw if indexedDB is missing/blocked (the open
// call itself can throw synchronously on some file:// origins).
const dbReady = new Promise((resolve) => {
  try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const os = req.result.createObjectStore(DB_STORE, { keyPath: "key" });
      os.createIndex("ts", "ts"); // oldest-first pruning
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { console.warn("IndexedDB unavailable — memory-only cache"); resolve(null); };
  } catch (e) {
    console.warn("IndexedDB unavailable — memory-only cache");
    resolve(null);
  }
});

function persistTile(t) {
  dbReady.then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put({
        key: t.key, iter: t.iter, L: t.L,
        ix: t.ix.toString(), iy: t.iy.toString(),
        paramHash: t.paramHash, ts: t.ts,
      });
      tx.oncomplete = () => maybePrune(db);
    } catch (e) { /* transient IDB error — tile stays in memory cache */ }
  });
}

function idbGet(db, key) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

// Resolve misses from IndexedDB: each hit is promoted into the memory cache and
// painted (if the view hasn't moved on); returns the descriptors still missing.
async function hydrateFromDB(misses, gen) {
  const db = await dbReady;
  if (!db || misses.length === 0) return misses;
  const still = [];
  await Promise.all(misses.map(async (d) => {
    const rec = await idbGet(db, d.key);
    if (rec && rec.paramHash === paramHash) {
      const t = {
        key: rec.key,
        iter: rec.iter instanceof Float32Array ? rec.iter : new Float32Array(rec.iter),
        L: rec.L, ix: BigInt(rec.ix), iy: BigInt(rec.iy),
        paramHash: rec.paramHash, ts: rec.ts,
      };
      cachePut(t);
      if (gen === currentGen) { blitTile(d, t); hitCount++; computeCount--; }
    } else {
      still.push(d);
    }
  }));
  return still;
}

let pruneBusy = false;
function maybePrune(db) {
  if (pruneBusy) return;
  pruneBusy = true;
  try {
    const tx = db.transaction(DB_STORE, "readwrite");
    const os = tx.objectStore(DB_STORE);
    os.count().onsuccess = (e) => {
      let excess = e.target.result - DB_MAX;
      if (excess <= 0) return;
      os.index("ts").openCursor().onsuccess = (ev) => { // oldest first
        const c = ev.target.result;
        if (c && excess > 0) { c.delete(); excess--; c.continue(); }
      };
    };
    tx.oncomplete = tx.onerror = () => { pruneBusy = false; };
  } catch (e) { pruneBusy = false; }
}

// ============================================================================
// Painted-tile set ("fog of war") + game rooms
// ----------------------------------------------------------------------------
// Tiles are only *computed* once painted (clicked). Painted keys are plain
// "L:ix:iy" — no paramHash, painting is a property of the *place*, so a tile
// stays revealed across iteration-parameter changes.
//
// Every shared map is a *room* (see server.js): students join with a code and
// a name, get a limited paint budget, and hunt for treasures the teacher (the
// room's host) hid on specific tiles. The server is the authority on budgets
// and discoveries; the client paints optimistically and re-fogs whatever the
// server rejects. Solo mode (file://, or no API) is an unlimited local-only map.
// ============================================================================
const SOLO_PAINTED_KEY = "mandelbrot-painted";   // pre-rooms key, kept for solo maps
const PAINTED_PERSIST_MAX = 20000;  // localStorage cap (deep-zoom keys are long)
const painted = new Set();
let paintedList = [];               // insertion order, for capped persistence
let paintedSeq = 0;                 // server sync cursor (next index to fetch)
const API_OK = location.protocol !== "file:";
let syncStatus = "not joined";
let pushQueue = [];                 // locally painted keys not yet POSTed
let pushTimer = 0;
let pushInFlight = 0;               // keys POSTed but not yet answered

// mode: null (lobby, nothing paints) | "solo" | "room".
const game = {
  mode: null, code: "", roomName: "", name: "", playerId: "",
  token: "", hostToken: "", isHost: false,
  remaining: 0,                     // optimistic: server value minus unsent paints
  startBudget: 0, players: [], objectives: [], objectiveCount: 0,
  foundSeen: null,                  // objective ids already announced (null until first sync)
};
let xray = false;                   // host only: see through fog locally (never shared)

const paintedKeyOf = (d) => `${d.L}:${d.ix}:${d.iy}`;
// Visible = revealed in *this* map. Cached tile data alone doesn't count: the
// tile cache is shared by every room this browser has visited.
const tileVisible = (L, ix, iy) => xray || painted.has(`${L}:${ix}:${iy}`);
const paintedStoreKey = () => game.mode === "room" ? `mandelbrot-painted:${game.code}` : SOLO_PAINTED_KEY;

function addPainted(key) {
  if (painted.has(key)) return false;
  painted.add(key);
  paintedList.push(key);
  return true;
}
function removePainted(keys) {
  const drop = new Set(keys);
  for (const k of drop) painted.delete(k);
  paintedList = paintedList.filter((k) => !drop.has(k));
  savePainted();
}
function loadPaintedLocal() {
  painted.clear(); paintedList = []; paintedSeq = 0;
  try {
    const s = JSON.parse(localStorage.getItem(paintedStoreKey()));
    if (s && Array.isArray(s.keys)) {
      for (const k of s.keys) addPainted(k);
      paintedSeq = s.seq || 0;
    }
  } catch (e) { /* fresh start */ }
}
function savePainted() {
  if (!game.mode) return;
  try {
    // If the cap dropped old keys, reset the cursor so the next session
    // re-fetches the full set from the server (the source of truth).
    const capped = paintedList.length > PAINTED_PERSIST_MAX;
    localStorage.setItem(paintedStoreKey(), JSON.stringify({
      seq: capped ? 0 : paintedSeq,
      keys: paintedList.slice(-PAINTED_PERSIST_MAX),
    }));
  } catch (e) { /* storage blocked (some file:// origins) → session-only */ }
}

// ---- Budget gate ----
function canPaint() {
  if (game.mode === "solo") return true;
  if (game.mode === "room") return game.isHost || game.remaining > 0;
  return false;
}
let outOfPaintAt = -Infinity;
function outOfPaint() {
  if (game.mode !== "room" || performance.now() - outOfPaintAt < 4000) return;
  outOfPaintAt = performance.now();
  toast("Out of paint! Ask your teacher for more.", "warn");
}
// Claim an unpainted tile: spend budget, mark it, queue it for the server.
// Returns false if it was already painted or the budget is empty.
function claimTile(pk) {
  if (painted.has(pk)) return false;
  if (!canPaint()) { outOfPaint(); return false; }
  addPainted(pk);
  if (game.mode === "room" && !game.isHost) game.remaining--;
  savePainted();
  schedulePush(pk);
  updateGameHud();
  return true;
}

// ---- Server sync ----
function apiHeaders() {
  const h = { "Content-Type": "application/json" };
  if (game.hostToken) h["X-Host-Token"] = game.hostToken;
  else if (game.token) h["X-Token"] = game.token;
  return h;
}
const roomUrl = (suffix) => `api/rooms/${game.code}/${suffix}`;
async function api(method, url, body) {
  const res = await fetch(url, {
    method, headers: apiHeaders(), body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Push local paints in small batches (a stroke paints many tiles quickly).
// One request at a time, so the server's `remaining` can be reconciled
// against exactly the paints it hasn't seen yet.
function schedulePush(key) {
  if (game.mode !== "room") return;
  pushQueue.push(key);
  if (!pushTimer) pushTimer = setTimeout(flushPush, 250);
}
async function flushPush() {
  pushTimer = 0;
  if (pushQueue.length === 0 || game.mode !== "room") return;
  if (pushInFlight) { pushTimer = setTimeout(flushPush, 150); return; }
  const batch = pushQueue;
  pushQueue = [];
  pushInFlight = batch.length;
  try {
    const data = await api("POST", roomUrl("paint"), { keys: batch });
    syncStatus = "connected";
    pushInFlight = 0;
    if (data.remaining != null) game.remaining = data.remaining - pushQueue.length;
    if (data.rejected && data.rejected.length) {
      removePainted(data.rejected);
      outOfPaint();
      render();                     // re-fog the tiles the server refused
    }
    if (data.discovered && data.discovered.length) mergeObjectives(data.discovered);
    updateGameHud();
  } catch (e) {
    pushInFlight = 0;
    pushQueue = batch.concat(pushQueue);  // retried by the next poll tick
    syncStatus = "offline — retrying";
  }
}

async function pollRoom() {
  if (game.mode !== "room") return;
  let data;
  try {
    data = await api("GET", roomUrl(`state?since=${paintedSeq}`));
  } catch (e) {
    syncStatus = "offline — retrying";
    if (e.status === 401 || e.status === 404) leaveRoom(e.status === 404 ? "That room no longer exists." : "Please join the room again.");
    return;
  }
  syncStatus = "connected";
  game.roomName = data.name;
  game.startBudget = data.startBudget;
  game.players = data.players || [];
  game.objectiveCount = data.objectiveCount || 0;
  if (data.you) {
    game.name = data.you.name;
    game.playerId = data.you.id;
    // Only trust the server's count when nothing of ours is unanswered.
    if (!pushInFlight) game.remaining = data.you.remaining - pushQueue.length;
  }
  const fresh = new Set();
  for (const k of data.keys || []) if (typeof k === "string" && addPainted(k)) fresh.add(k);
  const seq = Number(data.seq);
  if (Number.isFinite(seq) && (seq !== paintedSeq || fresh.size)) {
    paintedSeq = seq;
    savePainted();
  }
  setObjectives(data.objectives || []);
  if (fresh.size) revealPainted(fresh);
  updateGameHud();
  renderGamePanel();
  if (pushQueue.length && !pushTimer) pushTimer = setTimeout(flushPush, 100);
}

// ---- Objectives ("treasures") ----
// Students only receive found ones; the host receives all. Newly found ones
// (that this client hasn't announced yet) get a toast — skipped on the first
// sync so joining a room mid-game doesn't replay every past discovery.
function setObjectives(list) {
  const first = game.foundSeen === null;
  if (first) game.foundSeen = new Set();
  for (const o of list) {
    if (!o.found || game.foundSeen.has(o.id)) continue;
    game.foundSeen.add(o.id);
    if (!first) announceDiscovery(o);
  }
  game.objectives = list;
  drawExploreOverlay();
}
function mergeObjectives(found) {
  const byId = new Map(game.objectives.map((o) => [o.id, o]));
  for (const o of found) byId.set(o.id, o);
  setObjectives([...byId.values()]);
  renderGamePanel();
}
function announceDiscovery(o) {
  const mine = o.foundBy === game.name && !game.isHost;
  const who = mine ? "You" : o.foundBy;
  toast(`★ ${who} discovered “${o.name}”!${o.note ? " " + o.note : ""}`, mine ? "win" : "info", 9000);
}
function parseTileKey(key) {
  const [L, ix, iy] = key.split(":");
  return { L: Number(L), ix: BigInt(ix), iy: BigInt(iy) };
}

// ---- Presence: other students' hovered tiles, live ----
// Server-Sent Events carry everyone's hover (the server never sends the host's,
// so X-ray scouting can't leak treasures — and the host doesn't send at all).
// Our own hover goes up as a throttled POST plus a slow heartbeat, so a cursor
// holding still stays alive and one that vanished (crash, sleep) expires.
// Purely cosmetic: if EventSource fails, presence just stays empty.
const HOVER_THROTTLE_MS = 100, HOVER_BEAT_MS = 2000, PRESENCE_TTL_MS = 5000;
const presence = new Map();   // player id -> { name, key, t, hue }
let presenceSrc = null;       // EventSource
let hoverWant = null, hoverSent = null, hoverTimer = 0, hoverBeat = 0;

function openPresence() {
  if (game.mode !== "room" || typeof EventSource === "undefined") return;
  const q = game.hostToken ? `host=${encodeURIComponent(game.hostToken)}`
    : `token=${encodeURIComponent(game.token)}`;
  const es = new EventSource(roomUrl(`events?${q}`));
  presenceSrc = es;
  es.addEventListener("hover", (e) => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (!m.key) { presence.delete(m.id); return; }
    presence.set(m.id, { name: String(m.name || "?"), key: m.key, t: performance.now(), hue: hueFor(m.id) });
    startLoadAnim();
  });
  es.addEventListener("leave", (e) => {
    try { presence.delete(JSON.parse(e.data).id); } catch (err) { /* ignore */ }
  });
  // EventSource reconnects on its own (server sends retry: 3000); the
  // reconnect snapshot re-fills cursors, TTL clears ones that left meanwhile.
  if (!game.isHost) hoverBeat = setInterval(() => { if (hoverWant && !hoverTimer) flushHover(); }, HOVER_BEAT_MS);
}
function closePresence() {
  if (presenceSrc) presenceSrc.close();
  presenceSrc = null;
  clearInterval(hoverBeat); hoverBeat = 0;
  clearTimeout(hoverTimer); hoverTimer = 0;
  hoverWant = hoverSent = null;
  presence.clear();
}
function reportHover(key) {
  if (game.mode !== "room" || game.isHost || !presenceSrc) return;
  hoverWant = key;
  if (!hoverTimer && hoverWant !== hoverSent) hoverTimer = setTimeout(flushHover, HOVER_THROTTLE_MS);
}
function flushHover() {
  hoverTimer = 0;
  if (game.mode !== "room") return;
  hoverSent = hoverWant;
  api("POST", roomUrl("hover"), { key: hoverSent }).catch(() => { hoverSent = undefined; });  // resend on next change/beat
}
function expirePresence() {
  const cutoff = performance.now() - PRESENCE_TTL_MS;
  for (const [id, h] of presence) if (h.t < cutoff) presence.delete(id);
}
// Stable per-player hue (FNV-1a of the id), so a student keeps their color.
function hueFor(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}
// Remote hovers on the animated loadCanvas layer (redrawn every frame, so they
// track pans/zooms for free). A remote tile can be at another level than the
// view (level depends on each device's pxW): shallower → a big outline,
// deeper → clamped to a small visible box.
function drawRemoteHovers() {
  if (!presence.size || !currentCover || !renderParams) return;
  const p = renderParams, k = canvasPxPerCss(loadCanvas);
  loadCtx.save();
  loadCtx.font = `600 ${Math.round(11 * k)}px system-ui, sans-serif`;
  loadCtx.textBaseline = "top";
  for (const h of presence.values()) {
    let { x, y, size } = tileScreenRect(h.key);
    const min = 10 * k;
    if (size < min) { x -= (min - size) / 2; y -= (min - size) / 2; size = min; }
    if (x > p.pxW || y > p.pxH || x + size < 0 || y + size < 0) continue;
    const col = `hsl(${h.hue}, 90%, 65%)`;
    loadCtx.fillStyle = `hsla(${h.hue}, 90%, 65%, 0.10)`;
    loadCtx.fillRect(x, y, size, size);
    loadCtx.lineWidth = 2 * k;
    loadCtx.strokeStyle = col;
    loadCtx.strokeRect(x + k, y + k, size - 2 * k, size - 2 * k);
    // Name tag inside the tile's bottom edge (the top edge is where the
    // floating header/panels usually sit); just below a tile too small to hold it.
    const padX = 5 * k, tagH = 16 * k;
    const tw = loadCtx.measureText(h.name).width + padX * 2;
    const ty0 = size >= tagH * 2 ? y + size - tagH : y + size;
    const tx = Math.min(Math.max(x, 0), p.pxW - tw), ty = Math.min(Math.max(ty0, 0), p.pxH - tagH);
    loadCtx.fillStyle = col;
    loadCtx.fillRect(tx, ty, tw, tagH);
    loadCtx.fillStyle = "#0b0d12";
    loadCtx.fillText(h.name, tx + padX, ty + 2.5 * k);
  }
  loadCtx.restore();
}

// ---- Painting a tile (and placeholders) onto the viewport ----
// Colorize a cached tile's iteration values into the scratch canvas.
function colorizeToScratch(iter) {
  const out = new Uint8ClampedArray(TILE_PX * TILE_PX * 4);
  colorizePixels(iter, TILE_PX * TILE_PX, renderParams, currentLut, out);
  sctx.putImageData(new ImageData(out, TILE_PX, TILE_PX), 0, 0);
  return scratch;
}
function tileToScratch(t) { return colorizeToScratch(t.iter); }
// Blit a tile's iteration values to its viewport rect (+1 px overlap hides
// sub-pixel seams). Used for finished tiles and progressive intermediate frames.
function blitValues(d, iter) {
  const cnv = colorizeToScratch(iter);
  ctx.drawImage(cnv, 0, 0, TILE_PX, TILE_PX, d.destX, d.destY, d.destSize + 1, d.destSize + 1);
}
function blitTile(d, t) { blitValues(d, t.iter); }
// Until a tile is computed, upscale the nearest cached ancestor as a placeholder
// (the instant blurry-zoom you get in map apps). Walk up to 8 levels. Only
// ancestors revealed in this map qualify — the cache spans every room, and a
// ghost of another room's (or the host's x-ray) tile would leak the fog.
function blitPlaceholder(d) {
  for (let k = 1; k <= 8 && d.L - k >= 0; k++) {
    const ak = BigInt(k);
    if (!tileVisible(d.L - k, d.ix >> ak, d.iy >> ak)) continue;
    const at = cacheGet(tileKey(d.L - k, d.ix >> ak, d.iy >> ak));
    if (!at) continue;
    const mask = (1n << ak) - 1n;
    const sub = TILE_PX / Math.pow(2, k);                 // ancestor sub-rect size
    const sx = Number(d.ix & mask) * sub;                 // & gives floor-mod (BigInt 2's-comp)
    const sy = Number(d.iy & mask) * sub;
    const cnv = tileToScratch(at);
    ctx.drawImage(cnv, sx, sy, sub, sub, d.destX, d.destY, d.destSize + 1, d.destSize + 1);
    return;
  }
  // No ancestor available: leave the existing backdrop (pan preview / prior frame).
}

// ---- Look-ahead explore overlay ----
// Marks, inside every cover tile, which descendant tiles up to
// EXPLORE_LOOKAHEAD levels deeper are already painted — so you can see where
// exploration continues before you zoom. Nested painted levels nest their
// markers, fading with depth. Lives on its own canvas so worker results
// blitting onto the main canvas never erase it; redrawn on every render (the
// cover is the drawing frame) and on remote reveals.
const EXPLORE_LOOKAHEAD = 3;
const EXPLORE_STYLE = [[0.30, 0.07], [0.20, 0.045], [0.13, 0.03]]; // [stroke, fill] alpha per depth
function drawExploreOverlay() {
  exploreCtx.clearRect(0, 0, exploreCanvas.width, exploreCanvas.height);
  if (!currentCover) return;
  for (const d of currentCover.tiles) {
    for (let k = 1; k <= EXPLORE_LOOKAHEAD; k++) {
      const n = 1 << k;
      const sub = d.destSize / n;
      if (sub < 12) break;                       // too small to read
      const [sa, fa] = EXPLORE_STYLE[k - 1];
      const L = d.L + k;
      const baseIx = d.ix << BigInt(k), baseIy = d.iy << BigInt(k);
      exploreCtx.fillStyle = `rgba(255, 179, 71, ${fa})`;
      exploreCtx.strokeStyle = `rgba(255, 179, 71, ${sa})`;
      for (let jy = 0; jy < n; jy++) {
        for (let jx = 0; jx < n; jx++) {
          if (!painted.has(`${L}:${baseIx + BigInt(jx)}:${baseIy + BigInt(jy)}`)) continue;
          const x = d.destX + jx * sub, y = d.destY + jy * sub;
          exploreCtx.fillRect(x, y, sub, sub);
          exploreCtx.strokeRect(x + 0.5, y + 0.5, sub - 1, sub - 1);
        }
      }
    }
  }
  drawObjectiveMarkers();
}

// Treasure markers: a star at the objective tile's center (any zoom), plus the
// tile outline once it's big enough to see. Students only know found ones
// (gold); the host also sees hidden ones (violet, dashed). Positions use
// fixed-point subtraction from the view center like coverTiles, at a precision
// deep enough for the objective's level even when the view is shallower.
// Viewport rect (canvas px) of any tile key, at any level relative to the view.
function tileScreenRect(key) {
  const p = renderParams, vs = currentCover.viewScale;
  const t = parseTileKey(key);
  const f = Math.max(state.frac, t.L + 10);
  const up = BigInt(f - state.frac);
  const span = tileSpanFp(t.L, f);
  const odx = fpToDouble(rootLeftFp(f) + t.ix * span - (state.cx << up), f);
  const ody = fpToDouble(rootTopFp(f) - t.iy * span - (state.cy << up), f);
  const size = ROOT_SPAN * Math.pow(2, -t.L) / vs;
  return { x: odx / vs + p.pxW / 2, y: p.pxH / 2 - ody / vs, size };
}
// Canvas pixels per CSS pixel (object-fit: cover), for DPI-independent strokes/labels.
function canvasPxPerCss(cnv) {
  const p = renderParams, r = cnv.getBoundingClientRect();
  return r.width ? 1 / Math.max(r.width / p.pxW, r.height / p.pxH) : 1;
}
function drawObjectiveMarkers() {
  if (!currentCover || !renderParams || !game.objectives.length) return;
  const p = renderParams;
  const k = canvasPxPerCss(exploreCanvas);
  exploreCtx.save();
  exploreCtx.font = `600 ${Math.round(12 * k)}px system-ui, sans-serif`;
  exploreCtx.textBaseline = "middle";
  for (const o of game.objectives) {
    const { x, y, size } = tileScreenRect(o.key);
    const mx = x + size / 2, my = y + size / 2;
    const pad = 200 * k;
    if (mx < -pad || my < -pad || mx > p.pxW + pad || my > p.pxH + pad) continue;
    const rgb = o.found ? "255, 210, 80" : "200, 150, 255";
    if (size >= 10 * k) {
      exploreCtx.setLineDash(o.found ? [] : [6 * k, 5 * k]);
      exploreCtx.lineWidth = 2 * k;
      exploreCtx.strokeStyle = `rgba(${rgb}, 0.85)`;
      exploreCtx.strokeRect(x, y, size, size);
      exploreCtx.setLineDash([]);
    }
    const sr = 8 * k;
    exploreCtx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? sr * 0.45 : sr;
      exploreCtx.lineTo(mx + rr * Math.cos(a), my + rr * Math.sin(a));
    }
    exploreCtx.closePath();
    exploreCtx.fillStyle = `rgb(${rgb})`;
    exploreCtx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    exploreCtx.lineWidth = 1.5 * k;
    exploreCtx.fill();
    exploreCtx.stroke();
    exploreCtx.lineWidth = 3 * k;
    exploreCtx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    exploreCtx.strokeText(o.name, mx + sr + 4 * k, my);
    exploreCtx.fillStyle = `rgb(${rgb})`;
    exploreCtx.fillText(o.name, mx + sr + 4 * k, my);
  }
  exploreCtx.restore();
}

// Unpainted tile: near-black veil with a faint ghost of the nearest cached
// ancestor showing through (a hint of what's underneath), plus a subtle grid
// stroke marking it as a paintable cell. Painting clears the fog.
function blitUnexplored(d) {
  ctx.fillStyle = "#04060c";
  ctx.fillRect(d.destX, d.destY, d.destSize + 1, d.destSize + 1);
  ctx.globalAlpha = 0.15;
  blitPlaceholder(d);               // no-op when no ancestor is cached
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(140, 170, 255, 0.10)";
  ctx.strokeRect(d.destX + 0.5, d.destY + 0.5, d.destSize, d.destSize);
}

// ---- Per-tile "computing" spinner (on the separate loadCanvas layer) ----
// A tile that's queued/in-flight shows a dim wash + a spinning arc over its rect
// until the worker result paints the real pixels (which drops it from pendingKeys).
let loadAnimRaf = 0;
function drawTileSpinner(d, angle) {
  const x = d.destX, y = d.destY, size = d.destSize;
  const cx = x + size / 2, cy = y + size / 2;
  const r = Math.max(7, Math.min(size * 0.16, 24));
  const lw = Math.max(2, r * 0.24);
  loadCtx.fillStyle = "rgba(0, 0, 0, 0.16)";
  loadCtx.fillRect(x, y, size, size);
  loadCtx.lineWidth = lw;
  loadCtx.lineCap = "round";
  loadCtx.strokeStyle = "rgba(255, 255, 255, 0.18)";   // full track ring
  loadCtx.beginPath();
  loadCtx.arc(cx, cy, r, 0, Math.PI * 2);
  loadCtx.stroke();
  loadCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";    // spinning leading arc
  loadCtx.beginPath();
  loadCtx.arc(cx, cy, r, angle, angle + Math.PI * 0.6);
  loadCtx.stroke();
}
let hoverDesc = null;   // unpainted cover tile under the cursor (brush preview)
function drawHoverHighlight(d) {
  const ok = canPaint();          // red brush = this click won't paint (no budget)
  loadCtx.fillStyle = ok ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 80, 80, 0.08)";
  loadCtx.fillRect(d.destX, d.destY, d.destSize, d.destSize);
  loadCtx.lineWidth = 2;
  loadCtx.strokeStyle = ok ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 90, 90, 0.6)";
  loadCtx.strokeRect(d.destX + 1, d.destY + 1, d.destSize - 2, d.destSize - 2);
}
function loadAnimTick(ts) {
  loadCtx.clearRect(0, 0, loadCanvas.width, loadCanvas.height);
  if (hoverDesc && painted.has(paintedKeyOf(hoverDesc))) hoverDesc = null;
  expirePresence();
  if (pendingKeys.size === 0 && !hoverDesc && presence.size === 0) { loadAnimRaf = 0; return; }  // nothing left: stop
  const angle = (ts / 1000) * Math.PI * 1.8;               // ~0.9 rev/s
  for (const key of pendingKeys) {
    const d = pendingDesc.get(key);
    if (d) drawTileSpinner(d, angle);
  }
  drawRemoteHovers();
  if (hoverDesc) drawHoverHighlight(hoverDesc);
  loadAnimRaf = requestAnimationFrame(loadAnimTick);
}
function startLoadAnim() {
  if (!loadAnimRaf) loadAnimRaf = requestAnimationFrame(loadAnimTick);
}

// Build the set of tiles covering the current view, with their viewport rects.
function coverTiles(p) {
  const frac = state.frac;
  const L = pickLevel(state.spanW, p.pxW);
  const viewScale = state.spanW / p.pxW;               // world units per viewport px
  const spanH = viewScale * p.pxH;
  const halfWfp = fpFromDouble(state.spanW / 2, frac);
  const halfHfp = fpFromDouble(spanH / 2, frac);
  const rLeft = rootLeftFp(frac), rTop = rootTopFp(frac);
  const span = tileSpanFp(L, frac);
  const ixMin = floorDivBig((state.cx - halfWfp) - rLeft, span);
  const ixMax = floorDivBig((state.cx + halfWfp) - rLeft, span);
  const iyMin = floorDivBig(rTop - (state.cy + halfHfp), span);
  const iyMax = floorDivBig(rTop - (state.cy - halfHfp), span);
  const tileScale = (ROOT_SPAN / TILE_PX) * Math.pow(2, -L); // world units per tile px
  const destSize = TILE_PX * tileScale / viewScale;          // ~TILE_PX (near 1:1)
  const tiles = [];
  for (let iy = iyMin; iy <= iyMax; iy++) {
    for (let ix = ixMin; ix <= ixMax; ix++) {
      // Offset of this tile's top-left from the view center, in small doubles
      // (formed via fixed-point subtraction — never an absolute coordinate).
      const odx = fpToDouble((rLeft + ix * span) - state.cx, frac);
      const ody = fpToDouble(rTop - iy * span - state.cy, frac);
      tiles.push({
        L, ix, iy, key: tileKey(L, ix, iy),
        odx, ody, tileScale, destSize,
        destX: odx / viewScale + p.pxW / 2,
        destY: p.pxH / 2 - ody / viewScale,
      });
    }
  }
  return { L, viewScale, tiles };
}

// Map iteration values -> RGBA. The smooth/continuous value is always stored;
// non-smooth coloring just floors it. Pure post-processing, so it's cheap.
function colorizePixels(iter, count, p, lut, out) {
  const invMax = 1 / p.maxIter;
  for (let i = 0; i < count; i++) {
    let val = iter[i];
    let r, g, b;
    if (val < 0) { r = p.interior[0]; g = p.interior[1]; b = p.interior[2]; }
    else {
      if (!p.smooth) val = Math.floor(val);
      let t = (val * invMax) * p.cycles + p.offset;
      t = t - Math.floor(t);
      const o = ((t * 255) | 0) * 3;
      r = lut[o]; g = lut[o + 1]; b = lut[o + 2];
    }
    const j = i * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
}

// Recolor the current view from cached tiles — no worker compute. Wired to
// every palette control, so color edits are instant. The view is unchanged, so
// tile positions (currentCover) and keys stay valid; only the colors differ.
function repaint() {
  if (!currentCover || !renderParams) return;
  renderParams = readParams();
  currentLut = buildPalette(activeStops());
  for (const d of currentCover.tiles) {
    if (!tileVisible(d.L, d.ix, d.iy)) { blitUnexplored(d); continue; }
    const t = cacheGet(d.key);
    if (t && t.paramHash === paramHash) blitTile(d, t);
    else blitPlaceholder(d);
  }
}

let workerUrl = null;   // Blob URL for WORKER_SRC, built once and reused across rebuilds.
function initWorkers() {
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
  for (let i = 0; i < NUM_WORKERS; i++) {
    const w = new Worker(workerUrl);
    w.onmessage = (e) => onWorkerDone(w, e.data);
    workers.push(w);
    idleWorkers.push(w);
  }
}

// Resize the pool. Terminating discards any in-flight tiles, so we re-render:
// render() bumps the generation and clears the job/pending queues, cleanly
// recomputing the current view on the freshly-sized pool.
function setWorkerCount(n) {
  n = Math.max(1, Math.min(MAX_WORKERS, Math.round(n) || NUM_WORKERS));
  NUM_WORKERS = n;
  for (const w of workers) w.terminate();
  workers = [];
  idleWorkers = [];
  initWorkers();
  buildWorkerDots();
  refGen = -1;   // fresh workers have no reference orbit yet
  render();
}

function pumpWorker(w) {
  if (jobQueue.length === 0) { idleWorkers.push(w); return; }
  w.postMessage(jobQueue.shift());
}

function onWorkerDone(w, data) {
  // Progressive intermediate frame: the worker is still refining this tile, so
  // just paint the coarse preview if it's still current — don't cache and don't
  // pump (the worker isn't free until the final pass).
  if (!data.final) {
    if (data.gen === currentGen && pendingKeys.has(data.key)) {
      blitValues(pendingDesc.get(data.key), new Float32Array(data.iter));
    }
    return;
  }
  if (data.gen === currentGen && pendingKeys.has(data.key)) {
    const d = pendingDesc.get(data.key);
    const t = {
      key: data.key, iter: new Float32Array(data.iter),
      L: d.L, ix: d.ix, iy: d.iy, paramHash, ts: Date.now(),
    };
    cachePut(t);
    persistTile(t);                 // write-through to IndexedDB (stage 3)
    pendingKeys.delete(data.key);
    blitTile(d, t);                 // paint over the placeholder
    pendingTiles--;
    sessionComputed++;
    if (pendingTiles === 0) finishRender();
  }
  // Keep the worker busy regardless of whether the final result was stale.
  pumpWorker(w);
}

function finishRender() {
  overlay.hidden = true;
  const ms = Math.round(performance.now() - renderStart);
  lastRenderMs = ms;
  const p = renderParams;
  const zoom = Math.round(Math.log10(DEFAULTS.rectW / state.spanW));
  const mode = p.power === 2
    ? `perturbation, ${state.frac}-bit ref`
    : "direct doubles (power≠2: no deep precision)";
  const lvl = currentCover ? currentCover.L : "?";
  statusEl.textContent =
    `${coverCount} tiles (${hitCount} cached, ${computeCount} computed, ${unexploredCount} unexplored) · level ${lvl} · ` +
    `${p.pxW}×${p.pxH} in ${ms} ms · zoom ~1e${zoom} · ${mode}`;
}

// A transient render (opts.transient, used by animation frames) blits cache /
// placeholders / fog only — no IDB hydration, no compute enqueue — so a zoom or
// recenter animation never burns reference orbits and worker time on levels it
// flies straight past. The settling frame calls render() plainly to resolve.
// (render is also wired directly as a click listener; an Event has no
// .transient, so that path stays a full render.)
function render(opts) {
  const transient = !!(opts && opts.transient);
  const p = readParams();
  // Sync canvas resolution. Only resize when the dimensions actually change —
  // assigning canvas.width clears the canvas, and keeping the existing pixels
  // lets a pan's shifted backdrop show through until new tiles paint over it.
  els.pxW.value = p.pxW;
  els.pxH.value = p.pxH;
  if (canvas.width !== p.pxW) canvas.width = p.pxW;
  if (canvas.height !== p.pxH) canvas.height = p.pxH;
  // Keep the overlay layers the same resolution so their coords match tile rects.
  if (loadCanvas.width !== p.pxW) loadCanvas.width = p.pxW;
  if (loadCanvas.height !== p.pxH) loadCanvas.height = p.pxH;
  if (exploreCanvas.width !== p.pxW) exploreCanvas.width = p.pxW;
  if (exploreCanvas.height !== p.pxH) exploreCanvas.height = p.pxH;

  ensurePrecision();
  const centerXd = fpToDouble(state.cx, state.frac);
  const centerYd = fpToDouble(state.cy, state.frac);
  lastCenter = { x: centerXd, y: centerYd };
  hoverDesc = null;   // cover descriptors are about to be rebuilt
  syncFieldsFromState();
  updateZoomBadge();

  renderParams = p;
  paramHash = `${p.power}|${p.escapeR}|${p.maxIter}`;
  currentLut = buildPalette(activeStops());

  // Tiles covering the view. Cached ones paint immediately; misses get an
  // upscaled-ancestor placeholder now and a worker job to compute the exact tile.
  const cover = coverTiles(p);
  currentCover = cover;
  coverCount = cover.tiles.length;

  // Invalidate in-flight work; stale tile results are ignored (gen check).
  currentGen++;
  const gen = currentGen;
  jobQueue = [];
  pendingKeys.clear();
  pendingDesc.clear();
  pendingTiles = 0;
  renderStart = performance.now();

  // Auto-paint the reticle target: every settled view change (wheel glide, pan,
  // recenter, param edit all land here) reveals the tile under the center.
  // Marking it painted *before* the cover loop lets the normal miss path
  // resolve it in the same hydrate/compute batch as any other painted tile.
  if (autoPaintCenter && !transient) {
    const cd = tileAtCanvasPoint(cover, p.pxW / 2, p.pxH / 2);
    if (cd) claimTile(paintedKeyOf(cd));
  }

  // Only *visible* (painted in this map, or host x-ray) tiles are resolved
  // (cache → IDB → compute); the rest stay fogged until someone paints them.
  // Cached data alone doesn't reveal: the cache is shared across rooms.
  const misses = [];
  hitCount = 0;
  unexploredCount = 0;
  for (const d of cover.tiles) {
    if (!tileVisible(d.L, d.ix, d.iy)) { blitUnexplored(d); unexploredCount++; continue; }
    const t = cacheGet(d.key);
    if (t && t.paramHash === paramHash) { blitTile(d, t); hitCount++; }
    else { blitPlaceholder(d); misses.push(d); }
  }
  drawExploreOverlay();
  computeCount = misses.length;

  if (transient) { overlay.hidden = true; updateInfoPanel(); return; }

  // Try IndexedDB for the misses (async); whatever isn't there gets computed.
  hydrateFromDB(misses, gen).then((stillMissing) => {
    if (gen !== currentGen) return;     // view moved on while we awaited the DB
    if (stillMissing.length === 0) { finishRender(); return; }
    enqueueCompute(stillMissing, gen, p, centerXd, centerYd);
  });

  if (computeCount === 0) { overlay.hidden = true; finishRender(); }
  else overlay.hidden = false;

  updateInfoPanel();   // reflect the new cover/queue without waiting for the tick
}

// One reference orbit per generation, computed lazily on the first enqueue and
// reused by every later one in the same gen (each painted tile is a separate
// enqueue now, and the orbit is the expensive main-thread part).
let refGen = -1;
function broadcastRef(gen, p) {
  if (refGen === gen) return;
  const ref = p.power === 2
    ? computeReferenceOrbit(state.cx, state.cy, state.frac, p.maxIter, p.escapeR)
    : { Zx: null, Zy: null, refLen: 0 };
  for (const w of workers) {
    w.postMessage({ type: "ref", gen, Zx: ref.Zx, Zy: ref.Zy, refLen: ref.refLen });
  }
  refGen = gen;
}

// Compute the given missing tiles on the worker pool (perturbation reference is
// shared across the batch — iteration values don't depend on which reference
// produced them, so the view-center orbit serves every tile).
function enqueueCompute(misses, gen, p, centerXd, centerYd) {
  if (gen !== currentGen || misses.length === 0) return;
  broadcastRef(gen, p);
  let jobId = 0;
  for (const d of misses) {
    pendingKeys.add(d.key);
    pendingDesc.set(d.key, d);
    pendingTiles++;
    jobQueue.push({
      type: "tile", gen, jobId: jobId++, key: d.key,
      power: p.power, maxIter: p.maxIter, escapeR: p.escapeR,
      tilePx: TILE_PX, tileScale: d.tileScale, passes: PROGRESSIVE_PASSES,
      tileOriginDx: d.odx, tileOriginDy: d.ody,           // perturbation dc origin
      left: centerXd + d.odx, top: centerYd + d.ody,       // fallback absolute origin
    });
  }
  const idle = idleWorkers;
  idleWorkers = [];
  for (const w of idle) pumpWorker(w);
  startLoadAnim();   // spinners run until pendingKeys drains (worker results land)
}

// ---------- Interactions ----------
// Fractional cursor position within the canvas (0..1 on each axis).
function cursorFrac(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    fx: (e.clientX - rect.left) / rect.width,
    fy: (e.clientY - rect.top) / rect.height,
    rect,
  };
}

function spans() {
  const pxW = Math.max(16, parseFloat(els.pxW.value) || 800);
  const pxH = Math.max(16, parseFloat(els.pxH.value) || 600);
  return { spanW: state.spanW, spanH: state.spanW * pxH / pxW };
}

// ---- Painting (the primary verb): resolve one tile on demand ----
// Hit-test the cursor against the current cover's viewport rects. Uses the
// same naive rect→canvas-pixel mapping as pan/zoom (object-fit: cover is
// near-1:1 because pxW/pxH default to the device resolution).
function tileAt(e) {
  if (!currentCover) return null;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return tileAtCanvasPoint(currentCover, x, y);
}
function tileAtCanvasPoint(cover, x, y) {
  for (const d of cover.tiles) {
    if (x >= d.destX && x < d.destX + d.destSize &&
        y >= d.destY && y < d.destY + d.destSize) return d;
  }
  return null;
}

// Resolve an already-painted cover tile: memory cache → IDB → worker compute.
function resolveTile(d) {
  if (pendingKeys.has(d.key)) return;
  const t = cacheGet(d.key);
  if (t && t.paramHash === paramHash) { blitTile(d, t); return; }
  blitPlaceholder(d);
  computeCount++;
  const gen = currentGen;
  hydrateFromDB([d], gen).then((still) => {
    if (gen !== currentGen) return;
    enqueueCompute(still, gen, renderParams, lastCenter.x, lastCenter.y);
  });
}

function paintTile(d) {
  // Already painted (maybe still computing), or out of budget → nothing.
  if (!claimTile(paintedKeyOf(d))) return;
  if (!xray) resolveTile(d);     // under x-ray it's already resolving
}

// Fresh keys from other users: resolve any that sit in the current view.
// Deeper remote keys don't need resolving here, but they do move the
// look-ahead markers.
function revealPainted(freshKeys) {
  if (!currentCover || !renderParams) return;
  for (const d of currentCover.tiles) {
    if (freshKeys.has(paintedKeyOf(d)) && !xray) resolveTile(d);
  }
  drawExploreOverlay();
}

// Brush preview: outline the unpainted tile under the cursor (drawn by the
// loadCanvas anim tick, which also clears it once the tile gets painted).
function updateHover(e) {
  const d = tileAt(e);
  reportHover(d ? paintedKeyOf(d) : null);
  const nd = d && !painted.has(paintedKeyOf(d)) ? d : null;
  if ((nd && nd.key) !== (hoverDesc && hoverDesc.key)) {
    hoverDesc = nd;
    startLoadAnim();
  }
}

// Left click / left-drag *paints* tiles — the primary verb. Panning moves to
// right-/middle-drag or space+left-drag; wheel zooms; double-click re-centers.
let spaceDown = false;
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (e.target.closest && e.target.closest("input, select, textarea, button")) return;
  spaceDown = true;
  e.preventDefault();
});
window.addEventListener("keyup", (e) => { if (e.code === "Space") spaceDown = false; });

// ---- Keyboard panning (arrow keys / WASD) ----
// Held keys glide the view on transient frames (cache/fog blits only);
// releasing the last key does the settling full render. Ignored while a form
// control has focus — the inputs need their arrow keys and letters.
const PAN_KEYS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
};
const KEY_PAN_RATE = 0.6;          // viewport-widths per second
const heldPan = new Set();
let panRaf = 0, panLastT = 0;

function keyPanStep(now) {
  if (heldPan.size === 0) { panRaf = 0; render(); return; }   // settle
  const dt = Math.min(100, now - panLastT) / 1000;   // clamp hidden-tab gaps
  panLastT = now;
  let vx = 0, vy = 0;
  for (const k of heldPan) { vx += PAN_KEYS[k][0]; vy += PAN_KEYS[k][1]; }
  if (vx || vy) {
    const { spanW, spanH } = spans();
    const inv = 1 / Math.hypot(vx, vy);   // diagonals no faster than straights
    // Screen-down = imaginary-decreasing, hence the -vy.
    applyCenterDelta(vx * inv * KEY_PAN_RATE * dt * spanW,
                     -vy * inv * KEY_PAN_RATE * dt * spanH);
    render({ transient: true });
  }
  panRaf = requestAnimationFrame(keyPanStep);
}

window.addEventListener("keydown", (e) => {
  if (!PAN_KEYS[e.code]) return;
  if (e.target.closest && e.target.closest("input, select, textarea")) return;
  e.preventDefault();
  heldPan.add(e.code);
  if (!panRaf) { panLastT = performance.now(); panRaf = requestAnimationFrame(keyPanStep); }
});
window.addEventListener("keyup", (e) => { if (PAN_KEYS[e.code]) heldPan.delete(e.code); });
// Lost keyups (tab switch mid-hold) would pan forever — drop everything on blur.
window.addEventListener("blur", () => { heldPan.clear(); reportHover(null); });
canvas.addEventListener("mouseleave", () => reportHover(null));
document.addEventListener("visibilitychange", () => { if (document.hidden) reportHover(null); });

let drag = null;      // pan-drag state
let stroke = false;   // left-button paint stroke in progress
canvas.addEventListener("contextmenu", (e) => e.preventDefault());  // right-drag pans
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (e.button === 0 && !spaceDown) {
    stroke = true;
    const d = tileAt(e);
    if (d) paintTile(d);
    return;
  }
  drag = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
  canvas.style.cursor = "grabbing";
  // Snapshot the current image so we can slide it during the drag. The explore
  // overlay can't slide with it, so clear it until the mouseup render redraws.
  exploreCtx.clearRect(0, 0, exploreCanvas.width, exploreCanvas.height);
  buffer.width = canvas.width;
  buffer.height = canvas.height;
  bctx.drawImage(canvas, 0, 0);
});

window.addEventListener("mousemove", (e) => {
  if (stroke) {
    const d = tileAt(e);
    if (d) { paintTile(d); reportHover(paintedKeyOf(d)); }
    return;
  }
  if (!drag) { updateHover(e); return; }
  drag.dx = e.clientX - drag.startX;
  drag.dy = e.clientY - drag.startY;
  if (Math.abs(drag.dx) > 3 || Math.abs(drag.dy) > 3) drag.moved = true;

  // Live preview: redraw the snapshot shifted inside the (stationary) canvas.
  // Convert CSS-pixel drag into canvas-pixel offset (resolution may differ).
  const rect = canvas.getBoundingClientRect();
  const ox = drag.dx * (canvas.width / rect.width);
  const oy = drag.dy * (canvas.height / rect.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buffer, ox, oy);
});

window.addEventListener("mouseup", (e) => {
  if (stroke) { stroke = false; updateHover(e); return; }
  if (!drag) return;
  const d = drag;
  drag = null;
  canvas.style.cursor = "";

  // A plain pan-click (no movement) does nothing — only a drag pans.
  if (!d.moved) return;

  const { spanW, spanH } = spans();
  // Convert the pixel drag into a high-precision shift of the center.
  const rect = d.rect || canvas.getBoundingClientRect();
  applyCenterDelta(-(d.dx / rect.width) * spanW, (d.dy / rect.height) * spanH);
  render();
});

// Double-click smoothly re-centers the view on the cursor point (high precision).
// span (and thus state.frac via neededFrac) is constant here, so we can interpolate
// the BigInt center against the captured start without rescaling mid-flight.
let recenterRaf = 0;
canvas.addEventListener("dblclick", (e) => {
  e.preventDefault();
  // Touch double-taps are handled by the pointer code; some browsers still
  // synthesize a dblclick afterwards — don't recenter twice.
  if (performance.now() - lastTouchAt < 1000) return;
  const { fx, fy } = cursorFrac(e);
  recenterAt(fx, fy);
});
function recenterAt(fx, fy) {
  const { spanW, spanH } = spans();
  const dxReal = (fx - 0.5) * spanW;
  const dyReal = (0.5 - fy) * spanH;

  if (recenterRaf) cancelAnimationFrame(recenterRaf);
  const cx0 = state.cx, cy0 = state.cy, frac0 = state.frac;
  const t0 = performance.now();
  const DUR = 700;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const step = (now) => {
    const lin = Math.min(1, (now - t0) / DUR);
    const k = ease(lin);
    state.cx = cx0 + fpFromDouble(dxReal * k, frac0);
    state.cy = cy0 + fpFromDouble(dyReal * k, frac0);
    // Fly on cheap transient frames; resolve (hydrate/compute) on landing.
    render({ transient: lin < 1 });
    recenterRaf = lin < 1 ? requestAnimationFrame(step) : 0;
  };
  recenterRaf = requestAnimationFrame(step);
}

// ---- Touch / pen input (Pointer Events) ----
// Mouse keeps its own handlers above; these ignore pointerType "mouse".
// One finger paints (tap or drag), two fingers pan + pinch-zoom, double-tap
// re-centers. preventDefault on pointerdown suppresses the compatibility
// mouse events, so the mouse handlers never see touches.
//
// The first paint of a touch is deferred (TOUCH_PAINT_DELAY) so a pinch that
// starts with one finger slightly ahead of the other doesn't spend paint on
// the tile under it. Once a second finger lands, the gesture never paints
// again — even after one finger lifts — until every finger is up.
//
// Pinch is recomputed from the gesture-start state every frame (center, frac,
// span), so precision never accumulates error, and frames render transient
// (cache/fog only) like the wheel glide; release does the settling render().
const TOUCH_PAINT_DELAY = 110;      // ms before a still finger starts painting
const TAP_SLOP = 10;                // CSS px a tap may wander
const DOUBLE_TAP_MS = 320;
let lastTouchAt = 0;
const touches = new Map();          // pointerId -> { x, y } (client px)
let tg = null;                      // touch gesture state
let lastTap = null;                 // { t, x, y } for double-tap detection
let pinchRaf = 0;

function touchMid() {
  const [a, b] = [...touches.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}
function startTouchPaint() {
  if (!tg || tg.mode !== "pending") return;
  clearTimeout(tg.timer);
  tg.mode = "paint";
  const d = tileAt(tg.start);
  if (d) paintTile(d);
}
function pinchFrame() {
  pinchRaf = 0;
  if (!tg || tg.mode !== "pinch" || touches.size < 2) return;
  const m = touchMid();
  const rect = canvas.getBoundingClientRect();
  const s = Math.max(1e-3, m.d / Math.max(1, tg.d0));
  // Rebuild from the start state, then: new span = span0 / s, and shift the
  // center so the world point under the start midpoint sits under the live one.
  state.frac = tg.frac0; state.cx = tg.cx0; state.cy = tg.cy0;
  const spanW1 = tg.spanW0 / s, spanH1 = tg.spanH0 / s;
  state.spanW = spanW1;
  ensurePrecision();
  const f0x = (tg.m0.x - rect.left) / rect.width, f0y = (tg.m0.y - rect.top) / rect.height;
  const f1x = (m.x - rect.left) / rect.width, f1y = (m.y - rect.top) / rect.height;
  applyCenterDelta((f0x - 0.5) * tg.spanW0 - (f1x - 0.5) * spanW1,
                   (0.5 - f0y) * tg.spanH0 - (0.5 - f1y) * spanH1);
  render({ transient: true });
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  e.preventDefault();
  lastTouchAt = performance.now();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1) {
    tg = { mode: "pending", start: { clientX: e.clientX, clientY: e.clientY }, t0: lastTouchAt, moved: false };
    tg.timer = setTimeout(startTouchPaint, TOUCH_PAINT_DELAY);
  } else if (touches.size === 2 && tg && tg.mode !== "done") {
    // Second finger: switch to pinch/pan (no more painting this gesture).
    clearTimeout(tg.timer);
    if (recenterRaf) { cancelAnimationFrame(recenterRaf); recenterRaf = 0; }
    zoomAnim = null;
    const m = touchMid();
    const { spanW, spanH } = spans();
    tg = { mode: "pinch", m0: { x: m.x, y: m.y }, d0: m.d,
           cx0: state.cx, cy0: state.cy, frac0: state.frac, spanW0: spanW, spanH0: spanH };
    hoverDesc = null;
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse" || !touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!tg) return;
  if (tg.mode === "pending" &&
      Math.hypot(e.clientX - tg.start.clientX, e.clientY - tg.start.clientY) > TAP_SLOP) {
    tg.moved = true;
    startTouchPaint();
  }
  if (tg.mode === "paint") {
    const d = tileAt(e);
    if (d) paintTile(d);
  } else if (tg.mode === "pinch" && !pinchRaf) {
    pinchRaf = requestAnimationFrame(pinchFrame);
  }
});

function endTouch(e, cancelled) {
  if (e.pointerType === "mouse" || !touches.has(e.pointerId)) return;
  lastTouchAt = performance.now();
  if (tg && tg.mode === "pinch") {
    // First lift ends the pinch: apply the final finger positions (while both
    // are still tracked), resolve the destination, ignore the other finger.
    if (pinchRaf) { cancelAnimationFrame(pinchRaf); pinchRaf = 0; }
    pinchFrame();
    tg = { mode: "done" };
    render();
  }
  touches.delete(e.pointerId);
  if (!tg || touches.size > 0) return;
  const g0 = tg;
  tg = null;
  clearTimeout(g0.timer);
  if (cancelled || g0.mode === "done") return;
  // A quick, still tap: paint it (if the hold timer didn't already), and a
  // second tap close in time/space re-centers on that point.
  const tap = !g0.moved && performance.now() - g0.t0 < 300;
  if (g0.mode === "pending") { const d = tileAt(g0.start); if (d) paintTile(d); }
  if (!tap) { lastTap = null; return; }
  const now = performance.now();
  if (lastTap && now - lastTap.t < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < TAP_SLOP * 3) {
    lastTap = null;
    const { fx, fy } = cursorFrac(e);
    recenterAt(fx, fy);
  } else {
    lastTap = { t: now, x: e.clientX, y: e.clientY };
  }
}
canvas.addEventListener("pointerup", (e) => endTouch(e, false));
canvas.addEventListener("pointercancel", (e) => endTouch(e, true));

// Wheel over the fractal zooms; over a floating panel it scrolls that panel.
// The canvas now fills the viewport, so a bounding-box test would catch the
// panels too — exclude them by checking the event's actual target.
//
// Zoom is *animated*: notches accumulate into pendingLog (log-space, so notches
// compose additively and up/down cancel) and an rAF loop eases the actual span
// toward it, applying the keep-cursor-point-fixed step each frame with offsets
// recomputed from the live span — the anchor point stays truly pinned across
// the whole glide. Frames render transient (cache/fog blits only); the final
// frame does a full render() to hydrate/compute at the destination.
let zoomAnim = null;           // { pendingLog, fx, fy, lastT }
const ZOOM_TAU = 90;           // ms to close ~63% of the remaining zoom

function zoomStep(now) {
  const za = zoomAnim;
  const dt = Math.min(100, now - za.lastT);   // clamp hidden-tab rAF gaps
  za.lastT = now;
  let d = za.pendingLog * (1 - Math.exp(-dt / ZOOM_TAU));
  const done = Math.abs(za.pendingLog - d) < 0.002;  // sub-0.2% of span left: snap
  if (done) d = za.pendingLog;
  za.pendingLog -= d;

  const factor = Math.exp(d);
  const { spanW, spanH } = spans();
  const offX = (za.fx - 0.5) * spanW;
  const offY = (0.5 - za.fy) * spanH;
  // Keep the cursor point fixed while scaling: center += off*(1-factor).
  state.spanW = spanW * factor;
  ensurePrecision();
  applyCenterDelta(offX * (1 - factor), offY * (1 - factor));

  if (done) { zoomAnim = null; render(); }
  else { render({ transient: true }); requestAnimationFrame(zoomStep); }
}

window.addEventListener("wheel", (e) => {
  if (e.target.closest(".controls, header")) return; // let the panel scroll
  // Wheel input is dead while a drag/stroke is active: pressing the wheel
  // *button* (middle-drag pan) easily nudges the wheel, and zooming mid-drag
  // would desync the shifted-snapshot preview (and mid-stroke, the tile
  // hit-testing). Middle-drag must pan exactly like right-drag — never zoom.
  if (drag || stroke) { e.preventDefault(); return; }

  e.preventDefault();
  // Shift = fine control: a gentler per-notch ratio for precise zooming.
  const step = e.shiftKey ? 0.92 : 0.7;
  const notch = Math.log(e.deltaY < 0 ? step : 1 / step);
  // Anchor at the view center (the reticle), not the cursor: zooming dives
  // straight toward what's centered instead of drifting toward the mouse.
  // (zoomStep handles any anchor; fx/fy = 0.5 makes its center delta zero.)
  if (zoomAnim) {
    zoomAnim.pendingLog += notch;   // extend the glide in flight
  } else {
    zoomAnim = { pendingLog: notch, fx: 0.5, fy: 0.5, lastT: performance.now() };
    requestAnimationFrame(zoomStep);
  }
}, { passive: false });

// Auto-paint toggle. The reticle stays visible either way (it marks the zoom
// anchor / view center, not just the paint target). Turning auto-paint on
// reveals the current center immediately (no re-render).
els.autoPaint.checked = autoPaintCenter;
// In a room it spends budget (students) or reveals the class's map (teacher —
// and would pre-reveal the very tile "Hide treasure here" targets), so rooms
// keep their own setting, default off.
const autoPaintSettingKey = () => game.mode === "room" ? "autoPaintRoom" : "autoPaintCenter";
function applyAutoPaintSetting() {
  const k = autoPaintSettingKey();
  autoPaintCenter = SETTINGS[k] != null ? !!SETTINGS[k] : k === "autoPaintCenter";
  els.autoPaint.checked = autoPaintCenter;
}
els.autoPaint.addEventListener("change", () => {
  autoPaintCenter = els.autoPaint.checked;
  saveSetting(autoPaintSettingKey(), autoPaintCenter);
  if (autoPaintCenter && currentCover && renderParams) {
    const d = tileAtCanvasPoint(currentCover, canvas.width / 2, canvas.height / 2);
    if (d) paintTile(d);
  }
});

$("renderBtn").addEventListener("click", render);

$("saveBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `mandelbrot_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

$("resetBtn").addEventListener("click", () => {
  els.pxW.value = DEFAULTS.pxW;
  els.pxH.value = DEFAULTS.pxH;
  els.maxIter.value = DEFAULTS.maxIter;
  els.escapeR.value = DEFAULTS.escapeR;
  els.power.value = DEFAULTS.power;
  initState();
  render();
});

// ---------- Bookmarks (saved location + zoom) ----------
// Persisted to localStorage. The center is stored losslessly as the BigInt
// fixed-point value (as a string) plus its frac bits; spanW is a plain double.
// cxStr/cyStr/zoom are display-only, snapshotted at save time for the label.
const BOOKMARK_KEY = "mandelbrot-bookmarks";
let bookmarks = loadBookmarks();

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY)) || []; }
  catch (e) { return []; }
}
function saveBookmarks() {
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks)); }
  catch (e) { /* storage blocked (some file:// origins) → session-only */ }
}

function gotoBookmark(b) {
  state.frac = b.frac;
  state.cx = BigInt(b.cx);
  state.cy = BigInt(b.cy);
  state.spanW = b.spanW;
  // Restore the render recipe. Older bookmarks predate these fields, so each is
  // applied only if present (missing → keep the current setting).
  if (b.maxIter != null) els.maxIter.value = b.maxIter;
  if (b.escapeR != null) els.escapeR.value = b.escapeR;
  if (b.power != null) els.power.value = b.power;
  if (b.preset != null) els.palettePreset.value = b.preset;
  if (b.cycles != null) els.cycles.value = b.cycles;
  if (b.offset != null) els.offset.value = b.offset;
  if (b.smooth != null) els.smooth.checked = b.smooth;
  if (b.interior != null) els.interiorColor.value = b.interior;
  if (b.stops) {
    customStops = b.stops.map((s) => ({ pos: s.pos, color: s.color.slice() }));
    renderStopList();
  }
  els.customStops.hidden = els.palettePreset.value !== "custom";
  ensurePrecision();
  render();
}

function renderBookmarks() {
  const list = $("bookmarkList");
  list.innerHTML = "";
  bookmarks.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "bookmark-row";

    const go = document.createElement("button");
    go.type = "button";
    go.className = "go";
    go.title = `${b.cxStr}, ${b.cyStr}`;
    go.innerHTML = `<span class="zoom">${b.zoom}x</span> ${b.cxStr}, ${b.cyStr}`;
    go.addEventListener("click", () => gotoBookmark(b));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "✕";
    del.title = "Delete bookmark";
    del.addEventListener("click", () => {
      bookmarks.splice(i, 1);
      saveBookmarks();
      renderBookmarks();
    });

    row.append(go, del);
    list.append(row);
  });
}

$("bookmarkBtn").addEventListener("click", () => {
  bookmarks.push({
    cx: state.cx.toString(), cy: state.cy.toString(),
    frac: state.frac, spanW: state.spanW,
    cxStr: els.centerX.value, cyStr: els.centerY.value,
    zoom: formatZoom(DEFAULTS.rectW / state.spanW),
    // Full render recipe: iteration params + every color setting (custom stops
    // are deep-copied so later edits to the live array don't mutate the saved one).
    maxIter: els.maxIter.value, escapeR: els.escapeR.value, power: els.power.value,
    preset: els.palettePreset.value, cycles: els.cycles.value, offset: els.offset.value,
    smooth: els.smooth.checked, interior: els.interiorColor.value,
    stops: customStops.map((s) => ({ pos: s.pos, color: s.color.slice() })),
  });
  saveBookmarks();
  renderBookmarks();
});

renderBookmarks();

// Editing the center fields updates the high-precision state. Bump precision
// to hold however many digits were typed/pasted (deep coordinates survive).
function setCenterFromField(which, str) {
  const fracDigits = ((str.split(".")[1] || "").replace(/[eE].*/, "")).length;
  rescaleState(Math.max(state.frac, Math.ceil(fracDigits * 3.322) + 16));
  if (which === "x") state.cx = fpFromDecimalString(str, state.frac);
  else state.cy = fpFromDecimalString(str, state.frac);
}
els.centerX.addEventListener("change", () => setCenterFromField("x", els.centerX.value));
els.centerY.addEventListener("change", () => setCenterFromField("y", els.centerY.value));

// The width is the master span (pixels are square); the height derives from it.
els.rectW.addEventListener("change", () => {
  const v = parseFloat(els.rectW.value);
  if (isFinite(v) && v > 0) { state.spanW = v; ensurePrecision(); }
});
els.rectH.addEventListener("change", () => {
  const pxW = parseFloat(els.pxW.value), pxH = parseFloat(els.pxH.value);
  const v = parseFloat(els.rectH.value);
  if (isFinite(v) && v > 0 && pxW > 0 && pxH > 0) {
    state.spanW = (v * pxW) / pxH;
    ensurePrecision();
  }
});

// ---------- Custom palette UI ----------
function renderStopList() {
  els.stopList.innerHTML = "";
  customStops.forEach((stop, i) => {
    const row = document.createElement("div");
    row.className = "stop-row";

    const color = document.createElement("input");
    color.type = "color";
    color.value = rgbToHex(stop.color);
    color.addEventListener("input", () => {
      customStops[i].color = hexToRgb(color.value);
      repaint();
    });

    const range = document.createElement("input");
    range.type = "range";
    range.min = "0"; range.max = "1"; range.step = "0.01";
    range.value = stop.pos;
    const posLabel = document.createElement("span");
    posLabel.className = "pos";
    posLabel.textContent = stop.pos.toFixed(2);
    range.addEventListener("input", () => {
      customStops[i].pos = parseFloat(range.value);
      posLabel.textContent = customStops[i].pos.toFixed(2);
      repaint();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.title = "Remove stop";
    del.addEventListener("click", () => {
      if (customStops.length > 2) {
        customStops.splice(i, 1);
        renderStopList();
        repaint();
      }
    });

    row.append(color, range, posLabel, del);
    els.stopList.appendChild(row);
  });
}

els.addStop.addEventListener("click", () => {
  customStops.push({ pos: 1.0, color: [255, 255, 255] });
  renderStopList();
  repaint();
});

els.palettePreset.addEventListener("change", () => {
  els.customStops.hidden = els.palettePreset.value !== "custom";
  repaint();
});

// Pure-coloring controls recolor the cached frame instantly (no recompute).
els.cycles.addEventListener("input", repaint);
els.offset.addEventListener("input", repaint);
els.smooth.addEventListener("change", repaint);
els.interiorColor.addEventListener("input", repaint);

// ============================================================================
// Tile-engine telemetry panel (left side). Reads the live cache/queue/worker
// state; it's pure observation — nothing here feeds back into rendering. A light
// polling tick covers the async churn (workers finishing, IDB write-through)
// that has no single event to hang an update on.
// ============================================================================
const info = {
  panel: $("infoPanel"), toggle: $("infoToggle"),
  cover: $("iCover"), level: $("iLevel"), hits: $("iHits"), renderMs: $("iRenderMs"),
  mem: $("iMem"), memBar: $("iMemBar"), memMb: $("iMemMb"),
  workers: $("iWorkers"), workerDots: $("iWorkerDots"), workersMax: $("iWorkersMax"),
  pending: $("iPending"), queue: $("iQueue"),
  db: $("iDb"), dbBar: $("iDbBar"), dbMax: $("iDbMax"), dbClear: $("iDbClear"),
  gen: $("iGen"), computed: $("iComputed"),
  sync: $("iSync"), painted: $("iPainted"), explored: $("iExplored"),
};

// Float32 values per tile, in MB — the dominant memory cost of the LRU.
const TILE_MB = (TILE_PX * TILE_PX * 4) / (1024 * 1024);

// One worker dot per pool member; flagged busy when not parked in idleWorkers.
function buildWorkerDots() {
  info.workerDots.innerHTML = "";
  for (let i = 0; i < NUM_WORKERS; i++) {
    const d = document.createElement("span");
    d.className = "dot";
    info.workerDots.appendChild(d);
  }
}
buildWorkerDots();

// IndexedDB row count, refreshed on a slow cadence (a full count per tick would
// be wasteful and the number moves slowly). null = store unavailable.
let dbTileCount = null;
function refreshDbCount() {
  dbReady.then((db) => {
    if (!db) { dbTileCount = null; return; }
    try {
      const req = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).count();
      req.onsuccess = () => { dbTileCount = req.result; };
    } catch (e) { /* leave the last known value */ }
  });
}

function updateInfoPanel() {
  if (info.panel.classList.contains("collapsed")) return;
  const busy = NUM_WORKERS - idleWorkers.length;

  info.cover.textContent = coverCount;
  info.level.textContent = currentCover ? currentCover.L : "–";
  info.hits.textContent = `${hitCount} / ${computeCount}`;
  info.renderMs.textContent = lastRenderMs ? `${lastRenderMs} ms` : "–";

  info.mem.textContent = `${tileCache.size} / ${MAX_CACHE_TILES}`;
  info.memBar.style.width = `${Math.min(100, (tileCache.size / MAX_CACHE_TILES) * 100)}%`;
  info.memMb.textContent = `${(tileCache.size * TILE_MB).toFixed(1)} MB`;

  info.workers.textContent = `${busy} / ${NUM_WORKERS}`;
  const dots = info.workerDots.children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("busy", i < busy);
  info.pending.textContent = pendingTiles;
  info.queue.textContent = jobQueue.length;

  info.db.textContent = dbTileCount === null ? "unavailable" : `${dbTileCount} / ${DB_MAX}`;
  info.dbBar.style.width = dbTileCount === null ? "0%"
    : `${Math.min(100, (dbTileCount / DB_MAX) * 100)}%`;

  info.gen.textContent = currentGen;
  info.computed.textContent = sessionComputed;

  info.sync.textContent = syncStatus;
  info.painted.textContent = painted.size;
  let explored = 0;
  if (currentCover) {
    for (const d of currentCover.tiles) if (painted.has(paintedKeyOf(d))) explored++;
  }
  info.explored.textContent = `${explored} / ${coverCount}`;
}

// ---- Editable, persisted controls ----
// Seed the inputs from the live values, then push edits back into the settings,
// persist them, and enforce immediately. (Tiles-held is a fixed constant.)
info.dbMax.value = DB_MAX;
info.workersMax.value = NUM_WORKERS;
// Resizing rebuilds the pool and re-renders the current view on it.
info.workersMax.addEventListener("change", () => {
  const v = Math.max(1, Math.min(MAX_WORKERS, Math.round(+info.workersMax.value) || NUM_WORKERS));
  info.workersMax.value = v;
  saveSetting("workers", v);
  if (v !== NUM_WORKERS) setWorkerCount(v);
});
info.dbMax.addEventListener("change", () => {
  const v = Math.max(1, Math.round(+info.dbMax.value) || DB_MAX);
  DB_MAX = v;
  info.dbMax.value = v;
  saveSetting("dbMax", v);
  dbReady.then((db) => { if (db) maybePrune(db); });   // lowering it kicks off a prune
});
// Wipe the durable store. The in-memory LRU is untouched (still painting the
// current view); only the reload-survival backing copy is dropped.
info.dbClear.addEventListener("click", () => {
  dbReady.then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).clear();
      tx.oncomplete = () => { dbTileCount = 0; updateInfoPanel(); };
    } catch (e) { /* store unavailable — nothing to clear */ }
  });
});

info.toggle.addEventListener("click", () => {
  const collapsed = info.panel.classList.toggle("collapsed");
  info.toggle.textContent = collapsed ? "+" : "–";
  info.toggle.title = collapsed ? "Expand" : "Collapse";
  if (!collapsed) updateInfoPanel();
});

setInterval(updateInfoPanel, 200);   // live churn (workers, IDB write-through)
refreshDbCount();
setInterval(refreshDbCount, 2000);

// ============================================================================
// Game UI: lobby, paint HUD, room panel, teacher tools, toasts.
// All player/room text is server-supplied user input → textContent only.
// ============================================================================
const g = {
  lobby: $("lobby"), joinForm: $("joinForm"), joinCode: $("joinCode"), joinName: $("joinName"),
  createForm: $("createForm"), createName: $("createName"), createBudget: $("createBudget"),
  createKey: $("createKey"), lobbyError: $("lobbyError"), soloBtn: $("soloBtn"),
  panel: $("gamePanel"), roomName: $("roomName"), roomCode: $("roomCode"),
  youRows: $("youRows"), youName: $("youName"), youPaint: $("youPaint"),
  foundCount: $("foundCount"), discoveryList: $("discoveryList"), playerList: $("playerList"),
  leaveBtn: $("leaveBtn"),
  hostPanel: $("hostPanel"), joinLink: $("joinLink"), copyJoin: $("copyJoin"),
  hostLink: $("hostLink"), copyHost: $("copyHost"), xray: $("xray"),
  hostLevel: $("hostLevel"), objName: $("objName"), objNote: $("objNote"), objAdd: $("objAdd"),
  objList: $("objList"), startBudget: $("startBudget"), grantAmt: $("grantAmt"), grantAll: $("grantAll"),
  paintBadge: $("paintBadge"), toasts: $("toasts"), sub: $("headerSub"),
};

function toast(msg, kind = "info", ms = 5000) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  g.toasts.appendChild(el);
  while (g.toasts.children.length > 4) g.toasts.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, ms);
}

// Per-room credentials (player token or host token), so a reload or a later
// class period drops straight back in from the same browser.
const SESSION_PREFIX = "mandelbrot-session:";
function loadSession(code) {
  try { return JSON.parse(localStorage.getItem(SESSION_PREFIX + code)) || {}; }
  catch (e) { return {}; }
}
function saveSession(code, s) {
  try { localStorage.setItem(SESSION_PREFIX + code, JSON.stringify(s)); }
  catch (e) { /* storage blocked → this tab only */ }
}
function clearSession(code) {
  try { localStorage.removeItem(SESSION_PREFIX + code); } catch (e) { /* ignore */ }
}

// ---- Lobby ----
function showLobby(opts = {}) {
  g.lobby.hidden = false;
  if (opts.code != null) g.joinCode.value = opts.code;
  g.lobbyError.textContent = opts.error || "";
  g.soloBtn.hidden = false;
  (g.joinCode.value ? g.joinName : g.joinCode).focus();
}
function lobbyBusy(form, busy) {
  for (const el of form.querySelectorAll("button, input")) el.disabled = busy;
}
g.joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = g.joinCode.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) { g.lobbyError.textContent = "Room codes are 5 letters/digits."; return; }
  const sess = loadSession(code);
  if (sess.token || sess.hostToken) { enterRoom(code, sess); return; }   // rejoin from this browser
  lobbyBusy(g.joinForm, true);
  try {
    const data = await api("POST", `api/rooms/${code}/join`, { name: g.joinName.value });
    const s = { token: data.token, name: data.name };
    saveSession(code, s);
    enterRoom(code, s);
  } catch (err) {
    g.lobbyError.textContent = err.status ? err.message : "Can't reach the server.";
  } finally { lobbyBusy(g.joinForm, false); }
});
g.createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  lobbyBusy(g.createForm, true);
  try {
    const data = await api("POST", "api/rooms", {
      name: g.createName.value, startBudget: Number(g.createBudget.value),
      createKey: g.createKey.value || undefined,
    });
    const s = { hostToken: data.hostToken };
    saveSession(data.code, s);
    enterRoom(data.code, s);
  } catch (err) {
    g.lobbyError.textContent = err.status ? err.message : "Can't reach the server.";
  } finally { lobbyBusy(g.createForm, false); }
});
g.soloBtn.addEventListener("click", enterSolo);

// ---- Entering / leaving ----
let pollTimer = 0;
function resetGame() {
  closePresence();
  clearInterval(pollTimer); pollTimer = 0;
  clearTimeout(pushTimer); pushTimer = 0;
  pushQueue = []; pushInFlight = 0;
  Object.assign(game, {
    mode: null, code: "", roomName: "", name: "", playerId: "", token: "", hostToken: "",
    isHost: false, remaining: 0, startBudget: 0, players: [], objectives: [],
    objectiveCount: 0, foundSeen: null,
  });
  xray = false; g.xray.checked = false;
}
async function enterRoom(code, sess) {
  resetGame();
  Object.assign(game, {
    mode: "room", code, token: sess.token || "", hostToken: sess.hostToken || "",
    isHost: !!sess.hostToken, name: sess.name || "",
  });
  loadPaintedLocal();
  applyAutoPaintSetting();
  history.replaceState(null, "", `?room=${code}`);   // drops ?host= from the address bar
  g.lobby.hidden = true;
  g.panel.hidden = false;
  g.hostPanel.hidden = !game.isHost;
  // Students don't need the tile-engine telemetry; keep it a click away.
  if (!game.isHost && !info.panel.classList.contains("collapsed")) info.toggle.click();
  syncStatus = "connecting…";
  updateGameHud();
  renderGamePanel();
  await pollRoom();
  if (game.mode !== "room" || game.code !== code) return;   // the poll bounced us
  render();
  pollTimer = setInterval(pollRoom, 3000);
  openPresence();
}
function leaveRoom(error) {
  const code = game.code;
  if (error) clearSession(code);     // dead credentials: ask for a name again
  resetGame();
  painted.clear(); paintedList = []; paintedSeq = 0;
  history.replaceState(null, "", location.pathname);
  g.panel.hidden = true;
  g.hostPanel.hidden = true;
  syncStatus = "not joined";
  updateGameHud();
  render();
  showLobby({ code, error });
}
function enterSolo() {
  resetGame();
  game.mode = "solo";
  loadPaintedLocal();
  applyAutoPaintSetting();
  g.lobby.hidden = true;
  syncStatus = API_OK ? "solo — this browser only" : "solo (file://)";
  updateGameHud();
  render();
}
g.leaveBtn.addEventListener("click", () => leaveRoom());

function boot() {
  if (!API_OK) { enterSolo(); return; }   // file://: no server, unlimited local map
  const q = new URLSearchParams(location.search);
  const code = (q.get("room") || "").trim().toUpperCase();
  if (!code) { showLobby(); return; }
  const sess = loadSession(code);
  const ht = q.get("host");
  if (ht) { sess.hostToken = ht; saveSession(code, sess); }
  if (sess.token || sess.hostToken) enterRoom(code, sess);
  else showLobby({ code });
}

// ---- HUD + panels ----
function updateGameHud() {
  const b = g.paintBadge;
  if (game.mode === "room" && !game.isHost) {
    const n = Math.max(0, game.remaining);
    b.hidden = false;
    b.textContent = n === 1 ? "1 paint left" : `${n} paints left`;
    b.className = "paint-badge" + (n === 0 ? " empty" : n <= 5 ? " low" : "");
  } else if (game.mode === "room") {
    b.hidden = false;
    b.textContent = xray ? "Teacher · X-ray on" : "Teacher";
    b.className = "paint-badge host";
  } else b.hidden = true;
  g.sub.textContent = game.mode === "room"
    ? `Room ${game.code}${game.roomName ? " · " + game.roomName : ""}`
    : game.mode === "solo" ? "Solo map · unlimited paint · this browser only"
    : "Paint to reveal the complex plane";
  if (game.mode === "room") g.youPaint.textContent = Math.max(0, game.remaining);
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const btn = (text, cls, title, onClick) => {
  const b = el("button", cls, text);
  b.type = "button";
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
};

// Jump to an objective tile, framed at exactly its pyramid level on this
// device (pickLevel inverted: spanW = pxW / 2^(L+6)).
function flyToTile(key) {
  const t = parseTileKey(key);
  const p = readParams();
  state.spanW = p.pxW / Math.pow(2, t.L + 6);
  const f = neededFrac(state.spanW, p.pxW);
  const span = tileSpanFp(t.L, f);
  state.frac = f;
  state.cx = rootLeftFp(f) + t.ix * span + span / 2n;
  state.cy = rootTopFp(f) - t.iy * span - span / 2n;
  render();
}

function renderGamePanel() {
  if (game.mode !== "room") return;
  g.roomName.textContent = game.roomName || "Room";
  g.roomCode.textContent = game.code;
  g.youRows.hidden = game.isHost;
  g.youName.textContent = game.name;
  const found = game.objectives.filter((o) => o.found);
  g.foundCount.textContent = `${found.length} / ${game.objectiveCount}`;

  g.discoveryList.replaceChildren();
  if (!found.length) g.discoveryList.append(el("p", "empty-note",
    game.objectiveCount ? "Treasures are hidden somewhere deep in the set…" : "No treasures hidden yet."));
  for (const o of [...found].sort((a, b) => b.foundAt - a.foundAt)) {
    const row = el("div", "disc-row");
    const go = btn("", "go", "Fly there", () => flyToTile(o.key));
    go.append(el("span", "star", "★ "), el("span", null, o.name), el("span", "by", ` — ${o.foundBy}`));
    row.append(go);
    if (o.note) row.append(el("p", "note", o.note));
    g.discoveryList.append(row);
  }

  g.playerList.replaceChildren();
  if (!game.players.length) g.playerList.append(el("p", "empty-note", "Nobody has joined yet."));
  const ps = [...game.players].sort((a, b) => b.found - a.found || b.spent - a.spent);
  for (const pl of ps) {
    const row = el("div", "player-row" + (pl.id === game.playerId ? " me" : ""));
    row.append(el("span", "pname", pl.name));
    row.append(el("span", "pstat", `★${pl.found} · ${pl.spent} painted`));
    if (game.isHost) {
      row.append(el("span", "pstat left", `${pl.remaining} left`));
      row.append(btn(`+${grantAmount()}`, "ghost mini", `Give ${pl.name} more paint`, () => grant(pl.id)));
    }
    g.playerList.append(row);
  }

  if (game.isHost) renderHostPanel();
}

function renderHostPanel() {
  const base = `${location.origin}${location.pathname}?room=${game.code}`;
  g.joinLink.value = base;
  g.hostLink.value = `${base}&host=${game.hostToken}`;
  if (document.activeElement !== g.startBudget) g.startBudget.value = game.startBudget;
  g.objList.replaceChildren();
  if (!game.objectives.length) g.objList.append(el("p", "empty-note", "No treasures yet."));
  for (const o of game.objectives) {
    const row = el("div", "obj-row" + (o.found ? " found" : ""));
    const go = btn("", "go", o.note || "Fly there", () => flyToTile(o.key));
    go.append(el("span", "star", o.found ? "★ " : "☆ "), el("span", null, o.name),
      el("span", "by", o.found ? ` — ${o.foundBy}` : ` · L${o.L}`));
    const del = btn("✕", "del", "Delete treasure", async () => {
      if (!confirm(`Delete treasure “${o.name}”?`)) return;
      try { await api("DELETE", roomUrl(`objectives/${o.id}`)); pollRoom(); }
      catch (err) { toast(err.message, "warn"); }
    });
    row.append(go, del);
    g.objList.append(row);
  }
}
// Level shown next to "Hide treasure here" tracks the live view.
function updateHostLevel() {
  if (game.isHost && currentCover) g.hostLevel.textContent = currentCover.L;
}

// ---- Teacher actions ----
const grantAmount = () => Math.max(1, Math.round(Number(g.grantAmt.value) || 10));
async function grant(player) {
  try {
    await api("POST", roomUrl("grant"), { player, amount: grantAmount() });
    pollRoom();
  } catch (err) { toast(err.message, "warn"); }
}
g.grantAll.addEventListener("click", () => grant("*"));
g.grantAmt.addEventListener("change", renderGamePanel);
g.startBudget.addEventListener("change", async () => {
  try { await api("POST", roomUrl("settings"), { startBudget: Number(g.startBudget.value) }); pollRoom(); }
  catch (err) { toast(err.message, "warn"); }
});
g.xray.addEventListener("change", () => {
  xray = g.xray.checked;
  updateGameHud();
  render();
});
g.objAdd.addEventListener("click", async () => {
  if (!currentCover || !renderParams) return;
  const d = tileAtCanvasPoint(currentCover, renderParams.pxW / 2, renderParams.pxH / 2);
  if (!d) return;
  const key = paintedKeyOf(d);
  if (painted.has(key)) {
    toast("That tile is already revealed. Use X-ray to scout without painting, then hide treasures on fogged tiles.", "warn", 8000);
    return;
  }
  const name = g.objName.value.trim();
  if (!name) { toast("Give the treasure a name first.", "warn"); g.objName.focus(); return; }
  try {
    await api("POST", roomUrl("objectives"), { key, name, note: g.objNote.value });
    g.objName.value = ""; g.objNote.value = "";
    toast(`Hid “${name}” at level ${d.L}.`, "info");
    pollRoom();
  } catch (err) { toast(err.message, "warn"); }
});
for (const [b, input] of [[g.copyJoin, g.joinLink], [g.copyHost, g.hostLink]]) {
  b.addEventListener("click", () => {
    const done = () => { b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy"; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, () => input.select());
    else input.select();
  });
}
setInterval(updateHostLevel, 300);

// ---------- Init ----------
// Default the output size to the device's actual pixel resolution (clamped to the
// input's 16..4096 range). Baked into DEFAULTS so Reset restores it too.
// On touch devices (phones/tablets: 3x DPR, weak thermals) cap DPR at 2 and
// the long edge at TOUCH_MAX_PX — a 1170×2532 canvas is ~4× the tiles for
// detail the eye can't see at arm's length.
const COARSE = window.matchMedia && matchMedia("(pointer: coarse)").matches;
const TOUCH_MAX_PX = 1600;
(() => {
  const dpr = COARSE ? Math.min(2, window.devicePixelRatio || 1) : (window.devicePixelRatio || 1);
  const clamp = (n) => Math.max(16, Math.min(4096, Math.round(n)));
  let w = screen.width * dpr, h = screen.height * dpr;
  // Match the current orientation (some browsers report screen in portrait).
  if ((w > h) !== (innerWidth > innerHeight)) [w, h] = [h, w];
  if (COARSE) { const k = Math.min(1, TOUCH_MAX_PX / Math.max(w, h)); w *= k; h *= k; }
  DEFAULTS.pxW = clamp(w);
  DEFAULTS.pxH = clamp(h);
  els.pxW.value = DEFAULTS.pxW;
  els.pxH.value = DEFAULTS.pxH;
})();
// Rotating a phone flips the viewport aspect; object-fit: cover would then
// crop most of the canvas and pointer→tile mapping (which assumes matching
// aspect) would drift. Swap the output dimensions to follow the orientation.
window.addEventListener("resize", () => {
  const w = +els.pxW.value, h = +els.pxH.value;
  if (!COARSE || w === h || (w > h) === (innerWidth > innerHeight)) return;
  els.pxW.value = h; els.pxH.value = w;
  render();
});
// Bottom sheet (small screens): the controls panel slides up over the map.
// On desktop the toggle is display:none and the class does nothing.
$("sheetToggle").addEventListener("click", () => {
  const open = document.body.classList.toggle("sheet-open");
  $("sheetToggle").textContent = open ? "Close" : "Controls";
  $("sheetToggle").setAttribute("aria-expanded", String(open));
});
// Touch hint (the default text describes mouse controls).
if (COARSE) {
  const hint = document.querySelector(".hint");
  if (hint) hint.textContent = "Tap or drag to paint · two fingers to pan & zoom · double-tap to re-center";
}
initState();
initWorkers();
renderStopList();
els.customStops.hidden = els.palettePreset.value !== "custom";
render();
// Lobby / room / solo. In a room, the first poll lands before the settling
// render, so the painted set is current when the cover resolves.
boot();
