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

### Tile pyramid cache (Google-Maps-style) + worker pool
- A pool of `NUM_WORKERS` (= `navigator.hardwareConcurrency`, clamped 2–8) is created once.
- The world is a **quadtree**: level `L` has `2^L × 2^L` tiles, each `TILE_PX` (256px) and
  spanning `ROOT_SPAN/2^L` (`ROOT_SPAN = 4`, a power of two → tile edges are exact in
  fixed-point). A tile is keyed `(L, ix, iy)` with `ix/iy` **BigInt** (deep zoom blows past
  2^53). `pickLevel` chooses `L` so a tile pixel ≈ a viewport pixel (blits stay near 1:1).
- **Zoom/pan stay continuous.** `coverTiles()` finds the snapped tiles intersecting the view
  and `drawImage`s them (resampled) onto the canvas — the "hybrid" of smooth view + snapped grid.
- **Workers emit Float32 *iteration values*, not pixels** (`-1` = interior; always the smooth
  value). Coloring is a cheap main-thread pass (`colorizePixels`), so palette/smooth/cycles/
  offset/interior edits call `repaint()` and recolor cached tiles with **zero recompute**.
- **Two-layer cache.** `tileCache` is an in-memory LRU (`MAX_CACHE_TILES`); `IndexedDB`
  (`mandelbrot-tiles`) is the durable backing store so tiles survive reloads. `render()` paints
  memory hits immediately, then `hydrateFromDB` resolves misses from IDB, and only what's left
  is computed (`enqueueCompute`). `persistTile` write-throughs to IDB. **Falls back to
  memory-only** if IDB can't open (`dbReady` always resolves, never rejects).
- **Neighbor/parent/child are *derived*** from the key (`parentKey`/`childKeys`/`neighborKeys`
  = arithmetic + a Map lookup), not stored pointers — O(1) and no dangling refs on eviction.
- Misses show an **upscaled nearest cached ancestor** as an instant placeholder
  (`blitPlaceholder`) — the maps-like blurry-zoom — replaced when the exact tile computes.
  (This replaced the old `PASSES` subsample preview.)
- `currentGen` is a generation token. Every `render()` bumps it and clears `jobQueue` +
  `pendingKeys`; stale tile/IDB results (wrong `gen`) are discarded instead of painted.
- `tileToScratch` colorizes a tile's values into the shared `scratch` canvas before each blit.

### Perturbation theory (deep zoom, power == 2 only)
Float64 dies at ~1e-14. To go deeper:
- The view **center** is stored in high precision as BigInt fixed-point (`state.cx/cy`,
  value ≈ `X / 2^state.frac`). Precision auto-scales with zoom via `neededFrac` /
  `rescaleState`. Per-pixel offsets stay tiny and are handled in plain doubles.
- `computeReferenceOrbit` iterates `Z → Z² + C` at full precision for the **view center**,
  storing each `Zₙ` as a double. One reference per render serves every tile (broadcast as a
  `ref` message before the `tile` messages). Iteration values are **reference-independent**,
  so a tile computed under one render's reference is valid forever — that's what makes them
  cacheable and reusable as the view moves.
- Workers compute each pixel as a delta from the reference using only doubles, with
  **automatic rebasing** (Zhuoran's method) — this self-extends short references and
  suppresses glitches without a separate glitch-correction pass. See `perturb()` in `WORKER_SRC`.
- **Precision-preserving tile offsets.** A tile job carries `tileOriginDx/Dy` — the tile
  origin's offset from the reference center, formed by **fixed-point subtraction**
  (`tileLeftFp − state.cx → double`) on the main thread. The worker builds each pixel's `dc`
  from that, so it never forms an absolute coordinate (catastrophic cancellation at depth).
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
- **Tiles are keyed by `paramHash = power|escapeR|maxIter`**, so changing any of those is a
  full recompute (escaped pixels are reusable, interior aren't — a future optimization).
  Palette changes are *not* in the key (they recolor via `repaint`).
- Hybrid resampling slightly blurs tiles when the view scale doesn't exactly match the chosen
  level's; `pickLevel` rounds to keep it minimal.
- Cache bounds are tunable: `MAX_CACHE_TILES` (memory LRU) and `DB_MAX` (IndexedDB prune).
- IndexedDB on some `file://` origins is blocked/opaque → automatic memory-only fallback.
