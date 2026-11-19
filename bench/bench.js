#!/usr/bin/env node
"use strict";
// Tile-compute benchmark + correctness check. Runs the *real* worker code
// (WORKER_SRC, extracted from app.js) and the real reference-orbit function on
// fixed test tiles, single-threaded, and compares every tile against a
// brute-force reference (full maxIter loop, no shortcuts):
//
//   node bench/bench.js            # app.js in this checkout
//   node bench/bench.js old.js     # any other copy, e.g. `git show HEAD~1:app.js > /tmp/old.js`
//   ONLY=deep node bench/bench.js  # just the tiles whose name contains "deep"
//   FILL=1 node bench/bench.js     # with Mariani–Silver interior fill (INTERIOR_FILL)
//   NOBLA=1 node bench/bench.js    # perturbation without bilinear approximation
//
// Mismatch columns: "class" = pixels where interior/escaped disagree with the
// reference; "maxΔ" = largest smooth-value difference among pixels both call
// escaped. Shallow tiles are checked against direct double iteration; deep
// tiles against full-precision BigInt iteration (slow — only a sparse sample).

const fs = require("fs");
const path = require("path");
const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "app.js"));
const src = fs.readFileSync(file, "utf8");

function grab(name) {                       // top-level `function name(...) {...}` by brace matching
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`${name} not found in ${file}`);
  for (let k = src.indexOf("{", i), d = 0; ; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1);
  }
}
const app = new Function(
  "const _dv = new DataView(new ArrayBuffer(8));\n" +
  ["fpFromDouble", "fpToDouble", "fpFromDecimalString", "computeReferenceOrbit"].map(grab).join("\n") +
  "\nreturn { fpFromDouble, fpToDouble, fpFromDecimalString, computeReferenceOrbit };")();
const wStart = src.indexOf("const WORKER_SRC = `") + "const WORKER_SRC = `".length;
const WORKER = src.slice(wStart, src.indexOf("\n`;", wStart));
let posted = null;
// MessageChannel is stubbed: the worker only uses it to chain time slices, and
// a real port would keep Node's event loop alive. renderTile may be a generator
// (sliced, current) or a plain function (older copies), so drain either.
const stubChannel = function () { this.port1 = {}; this.port2 = { postMessage() {} }; };
// setRef (current) also drops the per-reference BLA tables; older copies just assign REF.
const worker = new Function("self", "MessageChannel", WORKER +
  "\nreturn { setRef: (r) => { if (typeof setRef === 'function') setRef(r); else REF = r; }, renderTile };")({
  postMessage: (m) => { if (m.final) posted = new Float32Array(m.iter); },
}, stubChannel);
function renderTile(job) {
  const r = worker.renderTile(job);
  if (r && typeof r.next === "function") for (const _ of r);
}

const N = 256;
const LN2 = Math.LN2;

// Brute-force references, same escape index + smoothing formula as the worker.
function refDirect(cx, cy, maxIter) {
  let zx = 0, zy = 0;
  for (let i = 0; i < maxIter; i++) {
    const m = zx * zx + zy * zy;
    if (m > 4) return i + 1 - Math.log(Math.log(m) / 2 / Math.log(2)) / LN2;
    const t = zx * zx - zy * zy + cx;
    zy = 2 * zx * zy + cy; zx = t;
  }
  return -1;
}
function refBig(cx, cy, frac, maxIter) {      // exact fixed-point iteration
  const F = BigInt(frac), four = 4n << F;
  let zx = 0n, zy = 0n;
  for (let i = 0; i < maxIter; i++) {
    const x2 = (zx * zx) >> F, y2 = (zy * zy) >> F;
    if (x2 + y2 > four) return i + 1 - Math.log(Math.log(app.fpToDouble(x2 + y2, frac)) / 2 / Math.log(2)) / LN2;
    zy = ((zx * zy) >> F) * 2n + cy; zx = x2 - y2 + cx;
  }
  return -1;
}

// A tile is given by its center (decimal strings) and its world span.
function run(t) {
  const frac = t.frac || 64;
  const cx = app.fpFromDecimalString(t.cx, frac), cy = app.fpFromDecimalString(t.cy, frac);
  const tileScale = t.span / N;
  const ref = app.computeReferenceOrbit(cx, cy, frac, t.maxIter, 2);   // view-center reference
  worker.setRef(ref);
  const cxd = app.fpToDouble(cx, frac), cyd = app.fpToDouble(cy, frac);
  const job = {
    type: "tile", gen: 1, jobId: 0, key: "k", power: 2, maxIter: t.maxIter, escapeR: 2,
    tilePx: N, tileScale, passes: [8, 2, 1], fill: !!process.env.FILL, bla: !process.env.NOBLA,
    tileOriginDx: -t.span / 2, tileOriginDy: t.span / 2,
    left: cxd - t.span / 2, top: cyd + t.span / 2,
  };
  renderTile(job);                            // warm-up (JIT)
  const reps = t.reps || 1;
  const a = performance.now();
  for (let r = 0; r < reps; r++) renderTile(job);
  const ms = (performance.now() - a) / reps;
  const got = posted;

  // Correctness: every pixel (shallow) or a sparse grid (deep, BigInt is slow).
  const step = t.deep ? 16 : 1;
  let cls = 0, maxD = 0, n = 0, interior = 0;
  for (let y = 0; y < N; y += step) {
    for (let x = 0; x < N; x += step) {
      let want;
      if (t.deep) {
        const dcx = app.fpFromDouble((x + 0.5 - N / 2) * tileScale, frac);
        const dcy = app.fpFromDouble((N / 2 - y - 0.5) * tileScale, frac);
        want = refBig(cx + dcx, cy + dcy, frac, t.maxIter);
      } else {
        want = refDirect(job.left + (x + 0.5) * tileScale, job.top - (y + 0.5) * tileScale, t.maxIter);
      }
      const v = got[y * N + x];
      n++;
      if (v < 0) interior++;
      if ((v < 0) !== (want < 0)) cls++;
      else if (v >= 0) maxD = Math.max(maxD, Math.abs(v - want));
    }
  }
  console.log(
    `${t.name.padEnd(30)} ${ms.toFixed(1).padStart(8)} ms   interior ${(100 * interior / n).toFixed(0).padStart(3)}%` +
    `   class ${String(cls).padStart(4)}/${n}   maxΔ ${maxD.toExponential(1)}`);
}

const SEA = ["-0.743643887037158704752191506114774", "0.131825904205311970493132056385139"];
const SPIRAL31 = ["-0.7436438870371587047521915199708286874999994793303155678641", "0.1318259042053119704931320608911936875000001953202443215150"];
const SPIRAL40 = ["-0.7436438870371587047521915199707956716841791668275634318583", "0.1318259042053119704931320608911981716779298828206173005412"];
const MB8007 = ["-0.743643887037158704752191506114779778215256207948181289816883901818560735783796478634787822",
  "0.131825904205311970493132056385140678972952279328918966209127677465513481738298337234738964"];
const TILES = [
  { name: "cardioid (all interior)", cx: "-0.25", cy: "0", span: 0.5, maxIter: 500, reps: 3 },
  { name: "cardioid @ maxIter 5000", cx: "-0.25", cy: "0", span: 0.5, maxIter: 5000 },
  { name: "period-3 bulb edge", cx: "-0.12", cy: "0.75", span: 0.25, maxIter: 1000 },
  { name: "seahorse valley boundary", cx: "-0.745", cy: "0.11", span: 0.02, maxIter: 500, reps: 3 },
  { name: "outside (escape-heavy)", cx: "-2.2", cy: "1.2", span: 0.5, maxIter: 500, reps: 5 },
  { name: "whole set, level 0", cx: "-0.5", cy: "0", span: 4, maxIter: 500, reps: 3 },
  { name: "minibrot -1.7549 (interior)", cx: "-1.75487766624", cy: "0", span: 2e-6, maxIter: 2000 },
  { name: "deep minibrot interior 1e-14", cx: "-1.7548776662466927600495", cy: "0", span: 1e-14, maxIter: 3000, frac: 120 },
  { name: "deep 1e-25 @ 20000", cx: SEA[0], cy: SEA[1], span: 1e-25, maxIter: 20000, frac: 160, deep: true },
  // Deeper boundary spirals (zoomed in from SEA toward high-escape pixels) and
  // frames around the period-8007 minibrot near SEA (Newton nucleus), the
  // case BLA is best at: escaping pixels shadow the periodic reference.
  { name: "deep 1e-31 @ 30000", cx: SPIRAL31[0], cy: SPIRAL31[1], span: 1e-31, maxIter: 30000, frac: 220, deep: true },
  { name: "deep 1e-40 @ 50000", cx: SPIRAL40[0], cy: SPIRAL40[1], span: 1e-40, maxIter: 50000, frac: 220, deep: true },
  { name: "deep minibrot frame 1e-30", cx: MB8007[0], cy: MB8007[1], span: 1e-30, maxIter: 100000, frac: 260, deep: true },
  { name: "deep minibrot 1e-32 (88% int)", cx: MB8007[0], cy: MB8007[1], span: 1e-32, maxIter: 100000, frac: 260, deep: true },
];
console.log(`${path.relative(process.cwd(), file)} — 256×256 tile, one thread, passes [8,2,1]`);
for (const t of TILES) if (!process.env.ONLY || t.name.includes(process.env.ONLY)) run(t);
