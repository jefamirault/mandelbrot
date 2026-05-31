# Mandelbrot Generator

A static, dependency-free Mandelbrot explorer. Vanilla JS + Canvas. No build step,
no framework, no package manager — just open `index.html`.

## Files
- `index.html` — markup and all controls (the `id`s here are the contract with `app.js`).
- `style.css` — dark theme; layout is a flex column (`header` + `main`).
- `app.js` — everything: math, worker pool, rendering, interactions, palette UI.

## Running
Open `index.html` directly (`file://`) — it must work without a server. This is why the
Web Worker is built from an inlined Blob URL (`WORKER_SRC`), not a separate `.js` file:
Chrome blocks `new Worker('file.js')` from `file://` origins.

There is no test suite in-repo. To verify the math, write a throwaway Node script that
copies the fixed-point + perturbation functions and compares against either direct
double iteration (shallow zoom) or full-BigInt iteration (deep zoom). The perturbation
path has been checked to match exact BigInt iteration with zero mismatches at 1e-16…1e-25.
`node --check app.js` after any edit.

## Architecture

### Worker pool + progressive tiled rendering
- A pool of `NUM_WORKERS` (= `navigator.hardwareConcurrency`, clamped 2–8) is created once.
- The image is split into `TILE` (128px) tiles, rendered at subsample passes `PASSES = [8,2,1]`
  (coarse → fine). Jobs are queued FIFO so *all* coarse tiles run before finer ones → a
  full blocky preview appears instantly, then sharpens.
- `currentGen` is a generation token. Every `render()` bumps it and clears `jobQueue`;
  stale tile results (wrong `gen`) are discarded on arrival instead of being painted.
- Workers report back via `onWorkerDone`, which paints the tile (`putImageData`) and
  immediately pumps the next job to keep the worker busy.

### Perturbation theory (deep zoom, power == 2 only)
Float64 dies at ~1e-14. To go deeper:
- The view **center** is stored in high precision as BigInt fixed-point (`state.cx/cy`,
  value ≈ `X / 2^state.frac`). Precision auto-scales with zoom via `neededFrac` /
  `rescaleState`. Per-pixel offsets stay tiny and are handled in plain doubles.
- `computeReferenceOrbit` iterates `Z → Z² + C` at full precision for the center,
  storing each `Zₙ` as a double. It's broadcast to all workers once per render (a `ref`
  message, ordered before the `tile` messages).
- Workers compute each pixel as a delta from the reference using only doubles, with
  **automatic rebasing** (Zhuoran's method) — this self-extends short references and
  suppresses glitches without a separate glitch-correction pass. See `perturb()` in `WORKER_SRC`.
- `power !== 2` falls back to direct double iteration (`iterate()`), i.e. **no deep
  precision** — the status line says so.

## Invariants & gotchas
- **Square pixels.** One `scale = state.spanW / pxW` drives both axes. The view *height*
  is derived (`spanH = scale * pxH`); the height field is informational and an edit to it
  is converted to an equivalent width. Don't reintroduce independent `dx`/`dy` — that was
  the old distortion bug.
- **`state` is authoritative for center/span**, not the input fields. Field *edits* push
  into `state` via `change` listeners; `render()` reads `state` and writes the rounded
  values back with `syncFieldsFromState()`. Programmatic field writes don't fire `change`,
  so there's no feedback loop.
- **Center inputs are `type="text"`** (not `number`) — doubles can't hold deep-zoom
  coordinates. Parsing/formatting go through `fpFromDecimalString` / `fpToDecimalString`.
- **Canvas is only resized when dimensions change.** Assigning `canvas.width` clears it;
  skipping that lets a pan's shifted backdrop persist until new tiles paint over it.
- **Pan preview shifts pixels, not the element.** `mousedown` snapshots into the offscreen
  `buffer`; `mousemove` redraws it offset inside the stationary canvas. Do NOT use a CSS
  `transform` on the canvas — it caused a visible snap-back on release.
- **Wheel only zooms when the cursor is over the canvas**; otherwise it returns early so
  the controls panel scrolls normally. The page itself never scrolls (`body { overflow:hidden }`).
- The reference orbit runs on the **main thread**, so a very high max-iter at extreme zoom
  briefly freezes the UI before workers take over. Candidate to move into a worker.

## Conventions
- Plain ES (`"use strict"`), no modules, no transpile. Keep it dependency-free and
  `file://`-runnable.
- Worker code lives as the `WORKER_SRC` template string; it can't import from the main
  scope, so anything it needs is passed in the job message.
- Match the existing terse comment style: explain *why*, not *what*.

## Known limitations / next steps
- No multi-reference glitch correction — single reference + rebasing handles normal
  locations; a rare pathological spot could still artifact.
- Deeper zoom needs higher max-iter (boundary detail grows with depth).
- `power != 2` has no extended precision.
