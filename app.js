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
};

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
  : Math.max(2, Math.min(32, (navigator.hardwareConcurrency || 4) - 1));

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
let coverCount = 0, hitCount = 0, computeCount = 0; // status-line instrumentation
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
// (the instant blurry-zoom you get in map apps). Walk up to 8 levels.
function blitPlaceholder(d) {
  for (let k = 1; k <= 8 && d.L - k >= 0; k++) {
    const ak = BigInt(k);
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
function loadAnimTick(ts) {
  loadCtx.clearRect(0, 0, loadCanvas.width, loadCanvas.height);
  if (pendingKeys.size === 0) { loadAnimRaf = 0; return; }  // nothing left: stop
  const angle = (ts / 1000) * Math.PI * 1.8;               // ~0.9 rev/s
  for (const key of pendingKeys) {
    const d = pendingDesc.get(key);
    if (d) drawTileSpinner(d, angle);
  }
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
    `${coverCount} tiles (${hitCount} cached, ${computeCount} computed) · level ${lvl} · ` +
    `${p.pxW}×${p.pxH} in ${ms} ms · zoom ~1e${zoom} · ${mode}`;
}

function render() {
  const p = readParams();
  // Sync canvas resolution. Only resize when the dimensions actually change —
  // assigning canvas.width clears the canvas, and keeping the existing pixels
  // lets a pan's shifted backdrop show through until new tiles paint over it.
  els.pxW.value = p.pxW;
  els.pxH.value = p.pxH;
  if (canvas.width !== p.pxW) canvas.width = p.pxW;
  if (canvas.height !== p.pxH) canvas.height = p.pxH;
  // Keep the spinner layer the same resolution so its coords match tile rects.
  if (loadCanvas.width !== p.pxW) loadCanvas.width = p.pxW;
  if (loadCanvas.height !== p.pxH) loadCanvas.height = p.pxH;

  ensurePrecision();
  const centerXd = fpToDouble(state.cx, state.frac);
  const centerYd = fpToDouble(state.cy, state.frac);
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

  const misses = [];
  hitCount = 0;
  for (const d of cover.tiles) {
    const t = cacheGet(d.key);
    if (t && t.paramHash === paramHash) { blitTile(d, t); hitCount++; }
    else { blitPlaceholder(d); misses.push(d); }
  }
  computeCount = misses.length;

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

// Compute the given missing tiles on the worker pool (perturbation reference is
// shared across the batch — iteration values don't depend on which reference
// produced them, so the view-center orbit serves every tile).
function enqueueCompute(misses, gen, p, centerXd, centerYd) {
  if (gen !== currentGen || misses.length === 0) return;
  const ref = p.power === 2
    ? computeReferenceOrbit(state.cx, state.cy, state.frac, p.maxIter, p.escapeR)
    : { Zx: null, Zy: null, refLen: 0 };
  for (const w of workers) {
    w.postMessage({ type: "ref", gen, Zx: ref.Zx, Zy: ref.Zy, refLen: ref.refLen });
  }
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

// Click-and-drag to pan; a plain click does nothing, a double-click re-centers.
let drag = null;
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  drag = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
  canvas.style.cursor = "grabbing";
  // Snapshot the current image so we can slide it during the drag.
  buffer.width = canvas.width;
  buffer.height = canvas.height;
  bctx.drawImage(canvas, 0, 0);
});

window.addEventListener("mousemove", (e) => {
  if (!drag) return;
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
  if (!drag) return;
  const d = drag;
  drag = null;
  canvas.style.cursor = "";

  // A plain click (no movement) does nothing — only a drag pans.
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
  const { spanW, spanH } = spans();
  const { fx, fy } = cursorFrac(e);
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
    render();
    recenterRaf = lin < 1 ? requestAnimationFrame(step) : 0;
  };
  recenterRaf = requestAnimationFrame(step);
});

// Wheel over the fractal zooms; over a floating panel it scrolls that panel.
// The canvas now fills the viewport, so a bounding-box test would catch the
// panels too — exclude them by checking the event's actual target.
window.addEventListener("wheel", (e) => {
  if (e.target.closest(".controls, header")) return; // let the panel scroll
  const rect = canvas.getBoundingClientRect();

  e.preventDefault();
  // Shift = fine control: a gentler per-notch ratio for precise zooming.
  const step = e.shiftKey ? 0.92 : 0.7;
  const factor = e.deltaY < 0 ? step : 1 / step;
  const fx = (e.clientX - rect.left) / rect.width;
  const fy = (e.clientY - rect.top) / rect.height;
  const { spanW, spanH } = spans();

  // Offset of the cursor point from the current center, in the complex plane.
  const offX = (fx - 0.5) * spanW;
  const offY = (0.5 - fy) * spanH;

  // Keep that point fixed while scaling: new center = center + off*(1-factor).
  state.spanW = spanW * factor;
  ensurePrecision();
  applyCenterDelta(offX * (1 - factor), offY * (1 - factor));
  render();
}, { passive: false });

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

// ---------- Init ----------
// Default the output size to the device's actual pixel resolution (clamped to the
// input's 16..4096 range). Baked into DEFAULTS so Reset restores it too.
(() => {
  const dpr = window.devicePixelRatio || 1;
  const clamp = (n) => Math.max(16, Math.min(4096, Math.round(n)));
  DEFAULTS.pxW = clamp(screen.width * dpr);
  DEFAULTS.pxH = clamp(screen.height * dpr);
  els.pxW.value = DEFAULTS.pxW;
  els.pxH.value = DEFAULTS.pxH;
})();
initState();
initWorkers();
renderStopList();
els.customStops.hidden = els.palettePreset.value !== "custom";
render();
