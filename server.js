#!/usr/bin/env node
"use strict";
// Game rooms API + static file server. Node builtins only — no package.json,
// matching the repo's dependency-free rule.
//
// Local dev:   node server.js [port]        (serve.sh wraps this; default 8000)
// Production:  run this behind nginx and proxy just the API:
//                location /api/ { proxy_pass http://127.0.0.1:8000; }
//              nginx keeps serving the static files from the docroot.
// Optional:    ROOM_CREATE_KEY=secret node server.js  → creating a room needs
//              the key (joining never does). Unset = anyone can create rooms.
//
// Each room is an append-only JSONL *event log* (data/rooms/<CODE>.jsonl):
// room / settings / join / paint / grant / obj / objdel. All state — painted
// set, budgets, discoveries — is derived by replaying it through apply(), and
// live requests go through the same apply() via commit(), so a restart always
// rebuilds exactly what clients saw. A crash can't corrupt earlier lines.
//
// The server is the authority on budgets (a client can't paint past its
// budget) and on discoveries (unfound treasures are never sent to students).

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const ROOT = __dirname;
const ROOMS_DIR = path.join(ROOT, "data", "rooms");
const CREATE_KEY = process.env.ROOM_CREATE_KEY || "";

// Key = "L:ix:iy" in decimal. ix/iy are BigInt-sized at deep zoom, hence the
// generous digit bound; anything outside the shape is dropped.
const KEY_RE = /^\d{1,4}:-?\d{1,1500}:-?\d{1,1500}$/;
const CODE_RE = /^[A-Z0-9]{5}$/;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // no 0/O/1/I/L confusion
const MAX_BODY = 1024 * 1024;
const MAX_KEYS_PER_PAINT = 2000;
const MAX_BUDGET = 1e6;

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const newToken = () => crypto.randomBytes(16).toString("hex");
const newId = () => crypto.randomBytes(4).toString("hex");
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const cleanText = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);

// ---------------------------------------------------------------------------
// Rooms: in-memory state, rebuilt from each log at startup.
// ---------------------------------------------------------------------------
const rooms = new Map();   // code -> room

function blankRoom(code) {
  return {
    code, name: "", hostHash: "", startBudget: 0, created: 0,
    keySet: new Set(), keyList: [],         // painted set; index = sync cursor
    players: new Map(),                     // id -> { id, name, tokenHash, budget, spent, found }
    tokens: new Map(),                      // tokenHash -> player id
    objectives: new Map(),                  // id -> { id, name, note, key, L, created, foundBy, foundAt }
    objByKey: new Map(),                    // key -> objective id
  };
}

// The single state transition. Must stay deterministic: replay == live.
function apply(room, ev) {
  switch (ev.e) {
    case "room":
      room.name = ev.name; room.hostHash = ev.hostHash;
      room.startBudget = ev.startBudget; room.created = ev.t;
      break;
    case "settings":
      if (ev.startBudget != null) room.startBudget = ev.startBudget;
      if (ev.name != null) room.name = ev.name;
      break;
    case "join": {
      const p = { id: ev.id, name: ev.name, tokenHash: ev.tokenHash, budget: ev.budget, spent: 0, found: 0 };
      room.players.set(p.id, p);
      room.tokens.set(p.tokenHash, p.id);
      break;
    }
    case "paint": {
      if (room.keySet.has(ev.k)) break;
      room.keySet.add(ev.k);
      room.keyList.push(ev.k);
      const p = room.players.get(ev.p);       // undefined for the host's paints
      if (p) p.spent++;
      const oid = room.objByKey.get(ev.k);
      const o = oid && room.objectives.get(oid);
      if (o && !o.foundBy) {
        o.foundBy = ev.p; o.foundAt = ev.t;
        if (p) p.found++;
      }
      break;
    }
    case "grant":
      if (ev.p === "*") for (const p of room.players.values()) p.budget += ev.n;
      else { const p = room.players.get(ev.p); if (p) p.budget += ev.n; }
      break;
    case "obj":
      room.objectives.set(ev.id, {
        id: ev.id, name: ev.name, note: ev.note, key: ev.key,
        L: Number(ev.key.split(":")[0]), created: ev.t, foundBy: null, foundAt: null,
      });
      room.objByKey.set(ev.key, ev.id);
      break;
    case "objdel": {
      const o = room.objectives.get(ev.id);
      if (!o) break;
      const p = o.foundBy && room.players.get(o.foundBy);
      if (p) p.found--;
      room.objectives.delete(ev.id);
      room.objByKey.delete(o.key);
      break;
    }
  }
}

const logPath = (code) => path.join(ROOMS_DIR, `${code}.jsonl`);

// Apply + persist a batch of events. Synchronous append: a single process with
// tiny writes, so concurrent requests serialize and the log order matches the
// in-memory order. The write goes first so a failed write changes nothing.
function commit(room, events) {
  if (!events.length) return;
  const t = Date.now();
  for (const ev of events) ev.t = t;
  fs.appendFileSync(logPath(room.code), events.map((ev) => JSON.stringify(ev)).join("\n") + "\n");
  for (const ev of events) apply(room, ev);
}

fs.mkdirSync(ROOMS_DIR, { recursive: true });
for (const f of fs.readdirSync(ROOMS_DIR)) {
  const m = /^([A-Z0-9]{5})\.jsonl$/.exec(f);
  if (!m) continue;
  const room = blankRoom(m[1]);
  for (const line of fs.readFileSync(path.join(ROOMS_DIR, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { apply(room, JSON.parse(line)); } catch (e) { /* torn last line after a crash */ }
  }
  if (room.hostHash) rooms.set(room.code, room);
}

function newCode() {
  for (;;) {
    let c = "";
    for (const b of crypto.randomBytes(5)) c += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!rooms.has(c)) return c;
  }
}

// ---------------------------------------------------------------------------
// Views (what each audience is allowed to see)
// ---------------------------------------------------------------------------
function playerName(room, id) {
  if (id === "host") return "Teacher";
  const p = room.players.get(id);
  return p ? p.name : "?";
}
function objectiveView(room, o) {
  return {
    id: o.id, name: o.name, note: o.note, key: o.key, L: o.L,
    found: !!o.foundBy, foundBy: o.foundBy ? playerName(room, o.foundBy) : null, foundAt: o.foundAt,
  };
}
function stateView(room, auth, since) {
  const s = Math.max(0, Math.min(room.keyList.length, Number(since) || 0));
  const objs = [...room.objectives.values()];
  const view = {
    code: room.code, name: room.name, startBudget: room.startBudget,
    seq: room.keyList.length, keys: room.keyList.slice(s),
    objectiveCount: objs.length,
    // Students only ever see found treasures; the host sees all of them.
    objectives: objs.filter((o) => auth.host || o.foundBy).map((o) => objectiveView(room, o)),
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, spent: p.spent, found: p.found, remaining: p.budget - p.spent,
    })),
  };
  if (auth.host) view.host = true;
  else {
    const p = auth.player;
    view.you = { id: p.id, name: p.name, spent: p.spent, remaining: p.budget - p.spent };
  }
  return view;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function readBody(req, res, cb) {
  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > MAX_BODY) { json(res, 413, { error: "too large" }); req.destroy(); }
  });
  req.on("end", () => {
    if (res.writableEnded) return;
    let data;
    try { data = body ? JSON.parse(body) : {}; } catch (e) { return json(res, 400, { error: "bad json" }); }
    if (!data || typeof data !== "object") return json(res, 400, { error: "bad json" });
    try { cb(data); }
    catch (e) { console.error(e); if (!res.writableEnded) json(res, 500, { error: "server error" }); }
  });
}
// Host token in X-Host-Token, player token in X-Token. Returns null if neither matches.
function authOf(room, req) {
  const ht = req.headers["x-host-token"];
  if (ht && sha(ht) === room.hostHash) return { host: true };
  const pt = req.headers["x-token"];
  const id = pt && room.tokens.get(sha(pt));
  if (id) return { host: false, player: room.players.get(id) };
  return null;
}

function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean).slice(1);   // drop "api"
  if (parts[0] !== "rooms") return json(res, 404, { error: "not found" });

  // POST /api/rooms — create a room (the creator becomes its host).
  if (parts.length === 1) {
    if (req.method !== "POST") return json(res, 405, { error: "method" });
    return readBody(req, res, (data) => {
      if (CREATE_KEY && data.createKey !== CREATE_KEY) return json(res, 403, { error: "a valid creation key is required" });
      const name = cleanText(data.name, 60) || "Mandelbrot expedition";
      const startBudget = clampInt(data.startBudget ?? 50, 0, MAX_BUDGET);
      const code = newCode();
      const hostToken = newToken();
      const room = blankRoom(code);
      commit(room, [{ e: "room", name, hostHash: sha(hostToken), startBudget }]);
      rooms.set(code, room);
      return json(res, 200, { code, hostToken, name });
    });
  }

  const code = String(parts[1] || "").toUpperCase();
  const room = CODE_RE.test(code) && rooms.get(code);
  if (!room) return json(res, 404, { error: "no room with that code" });
  const action = parts[2] || "";

  // POST /api/rooms/:code/join {name} — no auth; returns the player's token.
  if (action === "join" && req.method === "POST") {
    return readBody(req, res, (data) => {
      const name = cleanText(data.name, 24);
      if (!name) return json(res, 400, { error: "enter a name" });
      const lower = name.toLowerCase();
      for (const p of room.players.values()) {
        if (p.name.toLowerCase() === lower) return json(res, 409, { error: "that name is taken in this room" });
      }
      const token = newToken();
      const id = newId();
      commit(room, [{ e: "join", id, name, tokenHash: sha(token), budget: room.startBudget }]);
      return json(res, 200, { id, name, token });
    });
  }

  const auth = authOf(room, req);
  if (!auth) return json(res, 401, { error: "not a member of this room" });

  // GET /api/rooms/:code/state?since=N — painted keys since the cursor + roster.
  if (action === "state" && req.method === "GET") {
    return json(res, 200, stateView(room, auth, url.searchParams.get("since")));
  }

  // POST /api/rooms/:code/paint {keys} — spend budget on unpainted keys.
  // Already-painted keys are free (and reported accepted). Keys past the budget
  // come back in `rejected` so the client can re-fog them.
  if (action === "paint" && req.method === "POST") {
    return readBody(req, res, (data) => {
      if (!Array.isArray(data.keys) || data.keys.length > MAX_KEYS_PER_PAINT) {
        return json(res, 400, { error: "keys must be an array" });
      }
      const pid = auth.host ? "host" : auth.player.id;
      let left = auth.host ? Infinity : auth.player.budget - auth.player.spent;
      const accepted = [], rejected = [], events = [], seen = new Set();
      for (const k of data.keys) {
        if (typeof k !== "string" || !KEY_RE.test(k) || seen.has(k)) continue;
        seen.add(k);
        if (room.keySet.has(k)) { accepted.push(k); continue; }
        if (left <= 0) { rejected.push(k); continue; }
        left--;
        accepted.push(k);
        events.push({ e: "paint", p: pid, k });
      }
      const wasFound = new Set([...room.objectives.values()].filter((o) => o.foundBy).map((o) => o.id));
      commit(room, events);
      const discovered = [...room.objectives.values()]
        .filter((o) => o.foundBy && !wasFound.has(o.id))
        .map((o) => objectiveView(room, o));
      return json(res, 200, {
        accepted, rejected, discovered, seq: room.keyList.length,
        remaining: auth.host ? null : auth.player.budget - auth.player.spent,
      });
    });
  }

  // ---- Host-only below ----
  if (!auth.host) return json(res, 403, { error: "teacher only" });

  // POST /api/rooms/:code/objectives {name, note, key} — hide a treasure on a tile.
  if (action === "objectives" && !parts[3] && req.method === "POST") {
    return readBody(req, res, (data) => {
      const key = String(data.key || "");
      if (!KEY_RE.test(key)) return json(res, 400, { error: "bad tile key" });
      if (room.keySet.has(key)) return json(res, 409, { error: "that tile is already revealed" });
      if (room.objByKey.has(key)) return json(res, 409, { error: "a treasure is already hidden on that tile" });
      const name = cleanText(data.name, 60);
      if (!name) return json(res, 400, { error: "give the treasure a name" });
      const id = newId();
      commit(room, [{ e: "obj", id, name, note: cleanText(data.note, 500), key }]);
      return json(res, 200, objectiveView(room, room.objectives.get(id)));
    });
  }
  // DELETE /api/rooms/:code/objectives/:id
  if (action === "objectives" && parts[3] && req.method === "DELETE") {
    if (!room.objectives.has(parts[3])) return json(res, 404, { error: "no such treasure" });
    commit(room, [{ e: "objdel", id: parts[3] }]);
    return json(res, 200, { ok: true });
  }
  // POST /api/rooms/:code/grant {player: id | "*", amount}
  if (action === "grant" && req.method === "POST") {
    return readBody(req, res, (data) => {
      const n = clampInt(data.amount, -MAX_BUDGET, MAX_BUDGET);
      const p = data.player === "*" ? "*" : String(data.player || "");
      if (!n) return json(res, 400, { error: "amount must be non-zero" });
      if (p !== "*" && !room.players.has(p)) return json(res, 404, { error: "no such player" });
      commit(room, [{ e: "grant", p, n }]);
      return json(res, 200, { ok: true });
    });
  }
  // POST /api/rooms/:code/settings {startBudget?, name?}
  if (action === "settings" && req.method === "POST") {
    return readBody(req, res, (data) => {
      const ev = { e: "settings" };
      if (data.startBudget != null) ev.startBudget = clampInt(data.startBudget, 0, MAX_BUDGET);
      if (data.name != null && cleanText(data.name, 60)) ev.name = cleanText(data.name, 60);
      commit(room, [ev]);
      return json(res, 200, { ok: true });
    });
  }

  return json(res, 404, { error: "not found" });
}

// Whitelisted static files only (no directory walking, no path traversal).
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);

  const entry = STATIC[url.pathname];
  if (!entry) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(path.join(ROOT, entry[0]), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": entry[1] });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`Mandelbrot at http://localhost:${PORT}/ — ${rooms.size} room(s) (store: ${ROOMS_DIR})`);
});
