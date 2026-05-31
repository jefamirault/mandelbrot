"use strict";

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const statusEl = $("status");

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
// tiles ('tile' message). For power==2 it uses perturbation + automatic
// rebasing (Zhuoran's method) so deep zooms stay accurate with double math and
// short references self-extend without glitch corruption. For power!=2 it falls
// back to direct double iteration (no extended precision at depth).
const WORKER_SRC = `
let REF = { Zx: null, Zy: null, refLen: 0 };

self.onmessage = function (e) {
  const m = e.data;
  if (m.type === "ref") { REF = { Zx: m.Zx, Zy: m.Zy, refLen: m.refLen }; return; }
  renderTile(m);
};

function renderTile(j) {
  const lut = j.lut, interior = j.interior;
  const maxIter = j.maxIter, power = j.power, smooth = j.smooth;
  const escapeSq = j.escapeR * j.escapeR;
  const lnEscape = Math.log(j.escapeR);
  const lnPow = Math.log(Math.abs(power) || 2);
  const cycles = j.cycles, offset = j.offset, invMax = j.invMax;
  const scale = j.scale, left = j.left, top = j.top;
  const refPxX = j.refPxX, refPxY = j.refPxY;
  const x0 = j.x0, y0 = j.y0, tileW = j.tileW, tileH = j.tileH, step = j.step;
  const usePerturb = (power === 2 && REF.Zx);
  const Zx = REF.Zx, Zy = REF.Zy, refLen = REF.refLen;
  const buf = new Uint8ClampedArray(tileW * tileH * 4);

  // --- Perturbation + rebasing: delta orbit relative to the reference. ---
  function perturb(dcx, dcy) {
    let dzx = 0, dzy = 0, refI = 0;
    for (let i = 0; i < maxIter; i++) {
      const Zxr = Zx[refI], Zyr = Zy[refI];
      const zx = Zxr + dzx, zy = Zyr + dzy;
      const zmag2 = zx * zx + zy * zy;
      if (zmag2 > escapeSq) {
        if (!smooth) return i;
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
    if (!smooth) return i;
    const logZn = Math.log(mag2) / 2;
    return i + 1 - Math.log(logZn / lnEscape) / lnPow;
  }

  for (let ty = 0; ty < tileH; ty += step) {
    const gy = y0 + ty;
    for (let tx = 0; tx < tileW; tx += step) {
      const gx = x0 + tx;
      let val;
      if (usePerturb) {
        const dcx = ((gx + 0.5) - refPxX) * scale;
        const dcy = (refPxY - (gy + 0.5)) * scale;
        val = perturb(dcx, dcy);
      } else {
        val = iterate(left + (gx + 0.5) * scale, top - (gy + 0.5) * scale);
      }
      let r, g, b;
      if (val < 0) { r = interior[0]; g = interior[1]; b = interior[2]; }
      else {
        let t = (val * invMax) * cycles + offset;
        t = t - Math.floor(t);
        const o = ((t * 255) | 0) * 3;
        r = lut[o]; g = lut[o + 1]; b = lut[o + 2];
      }
      const yend = Math.min(ty + step, tileH);
      const xend = Math.min(tx + step, tileW);
      for (let by = ty; by < yend; by++) {
        let idx = (by * tileW + tx) * 4;
        for (let bx = tx; bx < xend; bx++) {
          buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
          idx += 4;
        }
      }
    }
  }
  self.postMessage(
    { jobId: j.jobId, gen: j.gen, x0: x0, y0: y0, tileW: tileW, tileH: tileH, buf: buf.buffer },
    [buf.buffer]
  );
}
`;

// ---------- Worker pool ----------
const NUM_WORKERS = Math.max(2, Math.min(8, navigator.hardwareConcurrency || 4));
const TILE = 128;
const PASSES = [8, 2, 1]; // subsample steps: coarse -> fine

let workers = [];
let idleWorkers = [];
let jobQueue = [];
let currentGen = 0;
let pendingTiles = 0;
let renderStart = 0;
let renderParams = null;

function initWorkers() {
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
  for (let i = 0; i < NUM_WORKERS; i++) {
    const w = new Worker(url);
    w.onmessage = (e) => onWorkerDone(w, e.data);
    workers.push(w);
    idleWorkers.push(w);
  }
}

function pumpWorker(w) {
  if (jobQueue.length === 0) { idleWorkers.push(w); return; }
  w.postMessage(jobQueue.shift());
}

function onWorkerDone(w, data) {
  if (data.gen === currentGen) {
    // Paint this tile's result onto the canvas (progressive update).
    const img = new ImageData(new Uint8ClampedArray(data.buf), data.tileW, data.tileH);
    ctx.putImageData(img, data.x0, data.y0);
    pendingTiles--;
    if (pendingTiles === 0) finishRender();
  }
  // Keep the worker busy regardless of whether the result was stale.
  pumpWorker(w);
}

function finishRender() {
  overlay.hidden = true;
  const ms = Math.round(performance.now() - renderStart);
  const p = renderParams;
  const zoom = Math.round(Math.log10(DEFAULTS.rectW / state.spanW));
  const mode = p.power === 2
    ? `perturbation, ${state.frac}-bit ref`
    : "direct doubles (power≠2: no deep precision)";
  statusEl.textContent =
    `Rendered ${p.pxW}×${p.pxH} in ${ms} ms · zoom ~1e${zoom} · ${mode} · ${NUM_WORKERS} workers.`;
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

  ensurePrecision();
  const scale = state.spanW / p.pxW;          // units per pixel (square pixels)
  const spanW = scale * p.pxW;
  const spanH = scale * p.pxH;
  const centerXd = fpToDouble(state.cx, state.frac);
  const centerYd = fpToDouble(state.cy, state.frac);
  syncFieldsFromState();

  const lut = buildPalette(activeStops());

  // High-precision reference orbit for perturbation (quadratic only).
  const ref = p.power === 2
    ? computeReferenceOrbit(state.cx, state.cy, state.frac, p.maxIter, p.escapeR)
    : { Zx: null, Zy: null, refLen: 0 };

  // Invalidate any in-flight render; stale tile results will be ignored.
  currentGen++;
  const gen = currentGen;
  jobQueue = [];
  pendingTiles = 0;
  renderStart = performance.now();
  renderParams = p;

  overlay.hidden = false;
  statusEl.textContent = "";

  // Broadcast the reference orbit to every worker first (ordered before tiles).
  for (const w of workers) {
    w.postMessage({ type: "ref", gen, Zx: ref.Zx, Zy: ref.Zy, refLen: ref.refLen });
  }

  const base = {
    type: "tile", gen, power: p.power, scale,
    left: centerXd - spanW / 2,
    top: centerYd + spanH / 2,
    refPxX: p.pxW / 2, refPxY: p.pxH / 2,
    invMax: 1 / p.maxIter,
    maxIter: p.maxIter, escapeR: p.escapeR, smooth: p.smooth,
    cycles: p.cycles, offset: p.offset, interior: p.interior, lut,
  };

  // Enqueue every tile of every pass; FIFO order means all coarse tiles run
  // before finer ones, so the full frame previews quickly then refines.
  let jobId = 0;
  for (const step of PASSES) {
    for (let y0 = 0; y0 < p.pxH; y0 += TILE) {
      const tileH = Math.min(TILE, p.pxH - y0);
      for (let x0 = 0; x0 < p.pxW; x0 += TILE) {
        const tileW = Math.min(TILE, p.pxW - x0);
        jobQueue.push(Object.assign({ jobId: jobId++, step, x0, y0, tileW, tileH }, base));
        pendingTiles++;
      }
    }
  }

  // Hand work to any idle workers; busy ones pick up jobs as they report back.
  const idle = idleWorkers;
  idleWorkers = [];
  for (const w of idle) pumpWorker(w);
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

// Click-and-drag to pan; a plain click (no movement) re-centers.
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

  const { spanW, spanH } = spans();

  if (!d.moved) {
    // Treat as a click -> re-center on the cursor point (high precision).
    const { fx, fy } = cursorFrac(e);
    applyCenterDelta((fx - 0.5) * spanW, (0.5 - fy) * spanH);
    render();
    return;
  }

  // Convert the pixel drag into a high-precision shift of the center.
  const rect = d.rect || canvas.getBoundingClientRect();
  applyCenterDelta(-(d.dx / rect.width) * spanW, (d.dy / rect.height) * spanH);
  render();
});

// Wheel over the fractal zooms; elsewhere it scrolls normally (e.g. controls).
window.addEventListener("wheel", (e) => {
  const rect = canvas.getBoundingClientRect();
  const overCanvas =
    e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!overCanvas) return; // let the default scroll happen

  e.preventDefault();
  const factor = e.deltaY < 0 ? 0.7 : 1 / 0.7;
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
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.title = "Remove stop";
    del.addEventListener("click", () => {
      if (customStops.length > 2) {
        customStops.splice(i, 1);
        renderStopList();
      }
    });

    row.append(color, range, posLabel, del);
    els.stopList.appendChild(row);
  });
}

els.addStop.addEventListener("click", () => {
  customStops.push({ pos: 1.0, color: [255, 255, 255] });
  renderStopList();
});

els.palettePreset.addEventListener("change", () => {
  els.customStops.hidden = els.palettePreset.value !== "custom";
});

// ---------- Init ----------
initState();
initWorkers();
renderStopList();
els.customStops.hidden = els.palettePreset.value !== "custom";
render();
