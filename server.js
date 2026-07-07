#!/usr/bin/env node
"use strict";
// Shared painted-tile store + static file server. Node builtins only — no
// package.json, matching the repo's dependency-free rule.
//
// Local dev:   node server.js [port]        (serve.sh wraps this; default 8000)
// Production:  run this behind nginx and proxy just the API:
//                location /api/ { proxy_pass http://127.0.0.1:8000; }
//              nginx keeps serving the static files from the docroot.
//
// The store is an append-only JSONL log (one key per line) so writes are cheap
// and a crash can't corrupt earlier entries. The in-memory array's index doubles
// as the sync cursor: GET ?since=N returns keys[N:] — clients poll incrementally.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const ROOT = __dirname;
const DATA = path.join(ROOT, "painted-tiles.jsonl");

// Key = "L:ix:iy" in decimal. ix/iy are BigInt-sized at deep zoom, hence the
// generous digit bound; anything outside the shape is dropped, so a hostile
// client can at worst grow the log with valid-looking keys.
const KEY_RE = /^\d{1,4}:-?\d{1,1500}:-?\d{1,1500}$/;
const MAX_BODY = 4 * 1024 * 1024;

const keySet = new Set();
const keyList = [];
function addKey(k) {
  if (keySet.has(k)) return false;
  keySet.add(k);
  keyList.push(k);
  return true;
}
try {
  for (const line of fs.readFileSync(DATA, "utf8").split("\n")) {
    const k = line.trim();
    if (k && KEY_RE.test(k)) addKey(k);
  }
} catch (e) { /* first run — no store yet */ }

// Whitelisted static files only (no directory walking, no path traversal).
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/painted") {
    if (req.method === "GET") {
      const since = Math.max(0, Math.min(keyList.length, Number(url.searchParams.get("since")) || 0));
      return json(res, 200, { seq: keyList.length, keys: keyList.slice(since) });
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > MAX_BODY) { json(res, 413, { error: "too large" }); req.destroy(); }
      });
      req.on("end", () => {
        if (res.writableEnded) return;
        let keys;
        try { keys = JSON.parse(body).keys; } catch (e) { return json(res, 400, { error: "bad json" }); }
        if (!Array.isArray(keys)) return json(res, 400, { error: "keys must be an array" });
        const fresh = [];
        for (const k of keys) {
          if (typeof k === "string" && KEY_RE.test(k) && addKey(k)) fresh.push(k);
        }
        // Synchronous append: serializes concurrent POSTs (single process, tiny
        // writes) so the log order always matches keyList order.
        if (fresh.length) {
          try { fs.appendFileSync(DATA, fresh.join("\n") + "\n"); }
          catch (e) { return json(res, 500, { error: "store write failed" }); }
        }
        return json(res, 200, { seq: keyList.length, added: fresh.length });
      });
      return;
    }
    res.writeHead(405, { Allow: "GET, POST" });
    return res.end();
  }

  const entry = STATIC[url.pathname];
  if (!entry) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(path.join(ROOT, entry[0]), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": entry[1] });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`Mandelbrot at http://localhost:${PORT}/ — ${keyList.length} painted tiles (store: ${DATA})`);
});
