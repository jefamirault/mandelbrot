# Mandelbrot Generator

A dependency-free, *paint-to-reveal* Mandelbrot explorer, played as a classroom game.
Vanilla JS + Canvas, no build step, no framework, no package manager. Tiles start fogged
and are only computed when a user paints (clicks) them. Every shared map is a **room**: a
teacher creates it, students join with a code + name, each gets a limited paint budget,
and the teacher hides treasures on specific tiles for the class to discover.

## Files
- `index.html` — markup and all controls (the `id`s here are the contract with `app.js`).
- `style.css` — dark theme; layout is a flex column (`header` + `main`).
- `app.js` — everything: math, worker pool, rendering, interactions, palette UI.
- `server.js` — game rooms API + static server. Node builtins only (no package.json).
  Store is `data/rooms/<CODE>.jsonl` (gitignored), one append-only event log per room.

## Running
`./serve.sh` (= `node server.js 8000`) serves the site *and* the rooms API.
Opening `index.html` directly (`file://`) must keep working — it skips the lobby and runs
**solo mode** (unlimited, local-only painted set in localStorage). The lobby also offers
solo, which is the escape hatch on any static host without the API. This is why the
Web Worker is built from an inlined Blob URL (`WORKER_SRC`), not a separate `.js` file:
Chrome blocks `new Worker('file.js')` from `file://` origins.

In production nginx serves the static files and proxies only the API:
`location /api/ { proxy_pass … }` to `server.js`, which runs in the docroot as systemd unit
`mandelbrot.service`. Both were installed once by `server-setup.sh` (root; idempotent).
`deploy.sh` rsyncs, restarts the unit (sudo prompts for the deploy password), then
smoke-tests `/api/` through nginx: a JSON 404 is healthy, nginx's HTML 404 means the proxy
is missing, and 502 means the service is down.

There is no test suite, but `node bench/bench.js` runs the real `WORKER_SRC` and the
reference-orbit code on fixed tiles (interior, boundary, outside, deep), times them, and
checks every pixel against brute-force iteration (direct doubles shallow; sparse
full-BigInt deep). Run it before and after any worker change; `node bench/bench.js
old.js` benchmarks another copy (`git show HEAD:app.js > old.js`), and `ONLY=` / `FILL=1`
filter tiles and enable the interior fill. Expect `class 0` everywhere in exact mode. The
deep 1e-25 tile shows a smooth-value maxΔ of ~33 at a few chaotic pixels; that predates
the phase-1 work (track it in the BLA issue, #7).
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
- **Progressive tile compute.** Each compute job renders in coarse→fine passes
  (`PROGRESSIVE_PASSES = [8, 2, 1]`): the worker computes a strided subsample, block-replicates
  it to fill the tile, posts it as a non-`final` frame, then refines. Strides each divide the
  previous, so every pixel is computed exactly once across all passes and the `final` tile is
  identical to a single full-res pass (only `final` results are cached). This covers the gap the
  ancestor placeholder can't: a big wheel-zoom that jumps past every cached level, where you'd
  otherwise watch a blank tile until it finished. `onWorkerDone` paints intermediate frames
  (`blitValues`) but only caches/decrements/pumps the worker on `final`.
- `currentGen` is a generation token. Every `render()` bumps it and clears `jobQueue` +
  `pendingKeys` (what the *current view* waits on); stale IDB lookups are discarded. Worker
  results are **not** discarded by generation (#5): `inFlight` tracks tiles being computed
  independently of the view, and a result that lands after the view moved is cached and
  painted if the new view wants it. `enqueueCompute` never re-queues an in-flight key. Full
  renders `cancelUnwanted()` the in-flight tiles that left the view: the worker renders in
  ~25 ms generator slices (`renderTile` is a `function*`, chained via `MessageChannel`), so
  a `cancel` is handled mid-tile and answered with `cancelled`. If the tile finished first,
  the final result arrives instead and is simply cached. Jobs run center-out from the
  reticle. While `document.hidden`, `pumpWorker` starts nothing new and `pollRoom` skips
  its tick; `visibilitychange` resumes the pool.
- **Transient renders.** `render({ transient: true })` blits cache/placeholders/fog only —
  no IDB hydration, no compute enqueue. Animation frames (wheel zoom, dblclick recenter)
  use it so a glide never burns reference orbits / worker time on levels it flies past;
  the settling frame calls `render()` plainly. (`render` is also a click listener; an
  Event has no `.transient`, so that path is a full render.)
- **Wheel zoom is animated and center-anchored.** Notches accumulate into
  `zoomAnim.pendingLog` (log-space, so they compose additively and opposite directions
  cancel) and `zoomStep` eases the span toward it (`ZOOM_TAU`). The anchor is the view
  center (the reticle) — `fx/fy = 0.5`, so the center never moves; you aim by
  panning/re-centering, then dive. `zoomStep` still handles an arbitrary anchor
  (keep-anchor-point-fixed each frame from the live span) if cursor-anchoring is ever
  wanted back. Don't zoom by mutating `state.spanW` directly from the handler.
- **Draw cache** (`colorCache` / `tileCanvas`, #6): each finished tile is colorized once into
  its own canvas and blitted with a plain `drawImage` (tiles, ancestor placeholders, fog
  ghosts). `syncColorSig` (called by `render`/`repaint`) drops the cache whenever anything
  `colorizePixels` reads changes: palette stops, cycles, offset, smooth, interior, maxIter.
  Add any new coloring input to that signature. LRU-capped at ~2 screens
  (`colorLimit`), with evicted canvases pooled. Progressive intermediate frames still go
  through `colorizeToScratch` (uncached). A pan/zoom frame went from 18.6 ms to 0.5 ms at
  1400×900, and from 52 ms to 1.0 ms at 2560×1440.

### Paint-to-reveal (shared "fog of war")
- **Tiles compute only when visible.** `tileVisible(L, ix, iy)` = painted in *this* map,
  or host X-ray. `render()`/`repaint()` resolve a cover tile through cache → IDB → compute
  only if visible; otherwise `blitUnexplored` (dark veil + faint ancestor ghost + grid
  stroke). **Cached data alone does not reveal** — the tile cache (memory + IDB) is shared by
  every room a browser visits, so `blitPlaceholder` also only uses visible ancestors.
- **Painted keys are `L:ix:iy` — no `paramHash`.** Painting is a property of the *place*:
  a revealed tile stays revealed across iteration-parameter changes (those still recompute
  values under the new `paramHash`).
- **Interactions are paint-first.** Left click/drag paints (`paintTile` → `resolveTile`);
  pan moved to right-/middle-drag, space+left-drag, or held arrows/WASD (`keyPanStep`
  glides on transient frames, settles on release; keys are ignored while a form control
  has focus). `contextmenu` is suppressed on the canvas. Wheel zoom and dblclick re-center
  are unchanged. Hover shows a brush outline on the `loadCanvas` layer (same rAF tick as
  the spinners).
- **Touch / pen input is Pointer Events** (`pointerdown/move/up/cancel` on the canvas,
  ignoring `pointerType === "mouse"` so the mouse handlers stay untouched; preventDefault
  on pointerdown suppresses compatibility mouse events, `touch-action: none` on `#canvas`).
  One finger paints — the first paint waits `TOUCH_PAINT_DELAY` (or movement past
  `TAP_SLOP`) so a pinch starting one finger early doesn't spend paint. Two fingers =
  pan + pinch-zoom, rebuilt every frame from the gesture-start `cx/cy/frac/spanW` (no
  accumulated error) on transient renders; the first lift settles with `render()` and
  the gesture paints nothing more until all fingers are up. Double-tap → `recenterAt`
  (shared with `dblclick`, which ignores synthesized post-touch dblclicks via
  `lastTouchAt`).
- **Look-ahead explore overlay.** `drawExploreOverlay` marks, inside each cover tile,
  descendants up to `EXPLORE_LOOKAHEAD` (3) levels deeper that are painted — nested
  translucent rects fading with depth, so you can see where exploration continues before
  zooming. It lives on its own `#exploreCanvas` layer (z-order: fractal < explore <
  spinners) because worker blits onto the main canvas would erase inline markers. Redrawn
  every render (transient included) and on `revealPainted`; cleared during a pan drag
  (the snapshot preview slides but the overlay can't).
- **Auto-paint center** (`autoPaintCenter`; "Painting" checkbox; persisted per mode via
  `autoPaintSettingKey` — `autoPaintRoom` defaults **off**, since it spends budget and a
  teacher's auto-paint would pre-reveal the tile "Hide treasure here" targets):
  every settled (non-transient) `render()` marks the tile under the view center as painted
  before the cover loop, so it resolves in the same batch as other painted misses. The
  `#reticle` div (CSS crosshair fixed at the viewport center = the canvas center pixel,
  since `object-fit: cover` scales about the center) is always visible — it marks the
  view center / wheel-zoom anchor, independent of the checkbox.
- **Sharing.** Each room's painted keys are a list whose index is the sync cursor.
  Clients `POST api/rooms/<CODE>/paint` (batched 250 ms, **one request in flight** so the
  returned `remaining` reconciles against exactly the unsent paints) and poll
  `GET api/rooms/<CODE>/state?since=<seq>` every 3 s (keys + roster + objectives); fresh
  remote keys in view resolve via `revealPainted`. Re-sends are harmless (already-painted
  keys are free and reported accepted). Relative URLs → any mount path, same-origin only.
  The local painted cache is per room (`mandelbrot-painted:<CODE>`; solo keeps the old
  `mandelbrot-painted`), capped at `PAINTED_PERSIST_MAX` (cap → cursor resets to 0).
- **Per-gen reference orbit.** Each paint is its own `enqueueCompute`, so the expensive
  main-thread reference orbit is computed lazily once per generation (`broadcastRef`,
  `refGen`) instead of per enqueue.

### Game rooms (server.js + "Game UI" section of app.js)
- **Event-sourced store.** A room is `data/rooms/<CODE>.jsonl`: `room`, `settings`, `join`,
  `paint`, `grant`, `obj`, `objdel`. All state (painted set, budgets, discoveries) is derived
  by `apply()`; live requests go through `commit()` = append then `apply()`, so a restart
  replays to exactly what clients saw. Keep `apply()` deterministic — discoveries are
  *derived* on replay (a `paint` matching an unfound objective's key), never logged.
- **Auth** is bearer tokens: `X-Host-Token` (returned once on room create) or `X-Token`
  (returned on join); the server stores only SHA-256 hashes. The client keeps them in
  localStorage `mandelbrot-session:<CODE>`; `?room=CODE&host=TOKEN` seeds a host session
  (then `replaceState` strips it from the address bar). Optional `ROOM_CREATE_KEY` env
  gates room creation. Names are unique per room (case-insensitive).
- **Budget is server-enforced.** 1 paint = 1 newly revealed tile; already-painted is free;
  the host is unlimited. The client paints optimistically (`claimTile`, `game.remaining--`)
  and re-fogs whatever comes back in `rejected`. Teacher grants per player or to everyone
  (`"*"`, applies to players who exist at that moment) and sets the start budget for
  later joiners.
- **Objectives ("treasures") are hidden.** An objective is just a tile key `L:ix:iy` —
  found when someone paints that exact tile (same level). Students' `state` only includes
  found ones plus `objectiveCount`; the host gets all. The server refuses to hide one on an
  already-revealed tile, which is why the host has **X-ray** (`xray` → `tileVisible` true
  everywhere, local only, never pushed) to scout without revealing.
- **Pinned iteration params** (`room.params`, set at creation from the teacher's fields and
  via "Use my current settings for the class"): students' maxIter / escape / power fields
  follow them and are disabled (`applyRoomParams`), so the whole room shares one
  `paramHash`, which is what makes shared tiles hit.
- **Shared computed tiles (#8).** A tile that took ≥ `SHARE_MIN_MS` (200 ms) to compute is
  uploaded (`maybeShare`: Float32 bytes split into 4 byte planes, then gzip via
  `CompressionStream`, ~40–56% of 256 KB) with `PUT api/rooms/<CODE>/tile?h=<paramHash>&k=<key>`.
  Cheaper tiles aren't worth a round trip. The server stores one file per (paramHash, key)
  in `data/tiles/`, shared by all rooms. It's write-once, capped by `MAX_TILE_FILES`
  (default 5000), only accepted and served for keys painted in *that* room (no fog leak),
  and listed per room through `tile` events in the room log. The poll returns new
  listings (`tsince` cursor → `game.sharedTiles`), so `resolveMisses` only downloads tiles
  that exist. Cold tiles go straight to compute. Every download is **spot-checked**
  (`verifyTile`): a worker recomputes 6 pixels from the coarsest pass's grid with the same
  `makeSampler`. Perturbation makes values depend slightly on the reference at chaotic
  pixels, so it tolerates 1e-3 relative error and one outlier. A failure → compute
  locally. Known gap: a bad first upload stays (write-once), so that tile just never
  shares.
- `drawObjectiveMarkers` (end of `drawExploreOverlay`) draws a star + tile outline per known
  objective, positioned by fixed-point subtraction at `max(state.frac, L + 10)` bits so a
  deep objective places correctly from a shallow view. `flyToTile` frames a key at exactly
  its level on this device (`spanW = pxW / 2^(L+6)`, the inverse of `pickLevel`). Note the
  level a given zoom maps to depends on `pxW` (device resolution), so "level L" is the
  stable notion, not "zoom N×".

- **Presence (live hovers).** Ephemeral, in memory only (`room.streams`/`room.hovers`),
  never in the event log. Clients open an SSE stream `GET api/rooms/<CODE>/events?token=…`
  (or `?host=…` — EventSource can't send headers) and `POST …/hover {key|null}` throttled to
  100 ms plus a 2 s heartbeat while hovering; remote cursors expire client-side after 5 s,
  and the server broadcasts `leave` when a player's last stream closes. **The host's hover
  is never broadcast** (X-ray scouting would point at treasures); the host only watches.
  Remote hovers draw on `#loadCanvas` in the rAF tick (`drawRemoteHovers`, which keeps the
  tick alive while anyone is present), positioned with the shared `tileScreenRect`. Behind
  nginx the `/api/` location needs `proxy_buffering off` (see deploy.sh). If SSE fails,
  presence is just empty.

### Tile compute shortcuts (WORKER_SRC, perf phase 1 / #4)
- **Direct doubles above `DIRECT_MIN_SCALE` (1e-12 per pixel)**: `direct2()`. ~2x faster
  than perturbation at shallow zoom, and it has an absolute c, which enables the
  **cardioid + period-2 bulb test** (closed form, no iterating). Below that scale,
  perturbation. The mode is decided per tile from `tileScale`, so a whole level uses one
  mode (no seams inside a level).
- **Exact periodicity** (Brent snapshots at doubling intervals) in all three loops: it
  fires only when the *full* iteration state repeats bit-for-bit (`(dz, refI)` in
  `perturb`), so the result is identical to running maxIter. Interior pixels were the
  dominant cost.
- **Mariani–Silver interior fill** (`mariani` / `fillInterior`), off by default
  (`INTERIOR_FILL`). It's faster on boundary and deep-interior tiles, but misclassifies
  ~50 per million pixels (escaping filaments thinner than a pixel). Exact mode has 0.
- **`TILE_ALGO` is part of `paramHash`** (so of every tile key and IDB record). Bump it
  whenever worker output could change, even by rounding, or old cached tiles mix with
  new ones and show seams.
- `point()` + the `known` mask carry samples from coarse passes into finer ones, so no
  pixel is computed twice.

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

Every deploy also ships a `deploy.json` stamp (UTC timestamp, short commit SHA, branch,
dirty flag). It is public on purpose and is what https://status.jefamirault.com/ reads to
report what is live here — see `~/devops/PATTERNS.md` § Deploy stamping.

### Small screens / touch devices
- `@media (max-width: 700px)`: `.controls` becomes a bottom sheet (closed by default,
  `#sheetToggle` toggles `body.sheet-open`), the tile-engine `.info-panel` is hidden,
  header/badges/hint/toasts are compacted so nothing overlaps. Inputs get 16px font
  (prevents iOS focus-zoom).
- `COARSE` (`pointer: coarse`) devices cap the default output size (DPR ≤ 2, long edge
  ≤ `TOUCH_MAX_PX`), default to ≤ 4 workers, swap `pxW/pxH` on rotation (pointer→tile
  mapping assumes canvas aspect = viewport aspect under `object-fit: cover`), and get a
  touch-worded `.hint`.

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
- **Pan preview shifts pixels, not the element.** Pan-`mousedown` snapshots into the
  offscreen `buffer`; `mousemove` redraws it offset inside the stationary canvas. Do NOT
  use a CSS `transform` on the canvas — it caused a visible snap-back on release.
- **Left button is reserved for painting.** Don't rebind it to pan; pan is
  right-/middle-drag or space+drag, and the space keydown is ignored while a form control
  has focus (typing spaces in inputs must not arm panning).
- **Wheel only zooms when the cursor is over the canvas**; otherwise it returns early so
  the controls panel scrolls normally. The page itself never scrolls (`body { overflow:hidden }`).
- The reference orbit runs on the **main thread**. Measured, it's cheap (~10 ms at 20k
  iterations, 160-bit), so moving it to a worker is low priority (#5).

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
- Cache bounds come from the **`DEVICE` profile** (#10): the tier from `navigator.deviceMemory`
  (Chromium only; elsewhere coarse pointer = assumed 2 GB, else 8 GB) sets
  `MAX_CACHE_TILES` (96/192/384), the default `DB_MAX` (400/800/1500), the draw-cache floor,
  the default worker cap, and `PROGRESSIVE_PASSES` (low tier skips the middle pass). A
  persisted panel setting (workers, DB max) wins. Battery saver (`getBattery`: discharging
  and ≤ 20 %) halves the default pool. Shown under "Device profile" in the panel.
- IndexedDB on some `file://` origins is blocked/opaque → automatic memory-only fallback.
- Paints made while the API is unreachable sit in `pushQueue` (retried each poll) but are
  lost if the tab closes first — the tiles stay revealed locally, just never shared (and
  the budget isn't charged).
- Room logs grow without bound and rooms are never deleted (delete the `.jsonl` and restart).
  No rate limiting; without `ROOM_CREATE_KEY` anyone can create rooms.
- A student who loses their browser storage can't rejoin under the same name (names are
  unique and tokens are only stored hashed). A teacher "reissue join link" is future work.
- The pre-rooms global map (`painted-tiles.jsonl`, `/api/painted`) is gone; an old
  production `painted-tiles.jsonl` is simply ignored.
