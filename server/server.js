// Tiny vote counter for the VOID guild mark poll. No dependencies.
// Votes live in one JSON file: { "<voter id>": { choice, at } }.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "votes.json");
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://rejver007.github.io,http://localhost:8765")
  .split(",").map((s) => s.trim()).filter(Boolean);

const CHOICES = new Set(["keep", ...Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"))]);
const VOTER_RE = /^[a-f0-9-]{16,64}$/;

fs.mkdirSync(DATA_DIR, { recursive: true });
let votes = {};
try {
  votes = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {
  votes = {};
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(votes));
    fs.renameSync(tmp, FILE);
  }, 200);
}

function tally(voter) {
  const counts = {};
  let total = 0;
  for (const v of Object.values(votes)) {
    counts[v.choice] = (counts[v.choice] || 0) + 1;
    total++;
  }
  return { counts, total, mine: (voter && votes[voter]?.choice) || null };
}

// Per-IP limit on vote writes, to stop scripted spam.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
}

function send(res, status, body, origin) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (origin && ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  const origin = req.headers.origin;
  const url = new URL(req.url, "http://x");
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : "",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true }, origin);

  if (req.method === "GET" && url.pathname === "/api/votes") {
    return send(res, 200, tally(url.searchParams.get("voter")), origin);
  }

  if (req.method === "POST" && url.pathname === "/api/vote") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1024) req.destroy();
    });
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: "Invalid JSON" }, origin);
      }
      const { voter, choice } = body || {};
      if (typeof voter !== "string" || !VOTER_RE.test(voter)) return send(res, 400, { error: "Bad voter id" }, origin);
      if (!CHOICES.has(choice)) return send(res, 400, { error: "Unknown choice" }, origin);
      if (limited(ip)) return send(res, 429, { error: "Too many votes, wait a minute" }, origin);
      votes[voter] = { choice, at: new Date().toISOString() };
      save();
      return send(res, 200, tally(voter), origin);
    });
    return;
  }

  send(res, 404, { error: "Not found" }, origin);
}).listen(PORT, () => console.log(`vote server on :${PORT}, ${Object.keys(votes).length} votes loaded`));
