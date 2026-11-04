// Tiny vote counter for the VOID guild mark poll. No dependencies.
//
// Every voter gets one ballot with VOTES_PER_BALLOT points to spread over the
// logos (several on the same logo is fine). A ballot is found by, in order:
//   1. the browser's random voter id (localStorage),
//   2. the device key: a hash of the network address plus screen size,
//      color depth, time zone and CPU core count. Those stay the same across
//      browsers and private windows on one PC, so a second browser on the same
//      PC and network opens the same ballot instead of a new one.
// A network address can hold at most MAX_BALLOTS_PER_IP ballots, which still
// lets a few people who share one connection vote.
// IP addresses are only stored as salted hashes.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "ballots.json");
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://rejver007.github.io,http://localhost:8765")
  .split(",").map((s) => s.trim()).filter(Boolean);
const VOTES_PER_BALLOT = Number(process.env.VOTES_PER_BALLOT) || 3;
const MAX_BALLOTS_PER_IP = Number(process.env.MAX_BALLOTS_PER_IP) || 3;

const CHOICES = new Set(["keep", ...Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"))]);
const VOTER_RE = /^[a-f0-9-]{16,64}$/;

fs.mkdirSync(DATA_DIR, { recursive: true });
// db = { salt, ballots: { <ballotId>: { picks: {choice: n}, ip, device, voters: [ids], at } } }
let db;
try {
  db = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {
  db = { salt: crypto.randomBytes(16).toString("hex"), ballots: {} };
}

const byVoter = new Map();
const byDevice = new Map();
const perIp = new Map();
function index(id, b) {
  b.voters.forEach((v) => byVoter.set(v, id));
  byDevice.set(b.device, id);
  perIp.set(b.ip, (perIp.get(b.ip) || 0) + 1);
}
for (const [id, b] of Object.entries(db.ballots)) index(id, b);

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  }, 200);
}

const hash = (s) => crypto.createHash("sha256").update(db.salt + s).digest("hex").slice(0, 32);

function clientIp(req) {
  // Traefik sets X-Real-Ip to the real client address; X-Forwarded-For's first
  // entry can be forged by the client, so it is only a fallback.
  return String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0].trim();
}

function deviceKey(ipHash, fp) {
  if (!fp || typeof fp !== "object") return null;
  const parts = ["sw", "sh", "cd", "hc"].map((k) => Number(fp[k]) || 0);
  const tz = typeof fp.tz === "string" ? fp.tz.slice(0, 64) : "";
  return hash([ipHash, ...parts, tz].join("|"));
}

// Read-only lookup; `link` attaches this browser to a ballot found by device.
function findBallot(voter, device, link) {
  let id = byVoter.get(voter);
  if (!id && device && byDevice.has(device)) {
    id = byDevice.get(device);
    if (link) {
      db.ballots[id].voters.push(voter);
      byVoter.set(voter, id);
      save();
    }
  }
  return id ? db.ballots[id] : null;
}

function tally(ballot) {
  const counts = {};
  let total = 0;
  let voters = 0;
  for (const b of Object.values(db.ballots)) {
    let used = 0;
    for (const [c, n] of Object.entries(b.picks)) {
      counts[c] = (counts[c] || 0) + n;
      used += n;
    }
    total += used;
    if (used) voters++;
  }
  const mine = ballot ? { ...ballot.picks } : {};
  const used = Object.values(mine).reduce((a, n) => a + n, 0);
  return { counts, total, voters, mine, left: VOTES_PER_BALLOT - used, perBallot: VOTES_PER_BALLOT };
}

// Per-IP limit on vote writes, to stop scripted spam.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 60;
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

function readFp(params) {
  try {
    return JSON.parse(params.get("fp") || "null");
  } catch {
    return null;
  }
}

http.createServer((req, res) => {
  const origin = req.headers.origin;
  const url = new URL(req.url, "http://x");
  const ip = clientIp(req);
  const ipHash = hash("ip:" + ip);

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
    const voter = url.searchParams.get("voter") || "";
    const ballot = VOTER_RE.test(voter) ? findBallot(voter, deviceKey(ipHash, readFp(url.searchParams)), true) : null;
    return send(res, 200, tally(ballot), origin);
  }

  if (req.method === "POST" && url.pathname === "/api/vote") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2048) req.destroy();
    });
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: "Invalid request" }, origin);
      }
      const { voter, choice, delta, fp } = body || {};
      if (typeof voter !== "string" || !VOTER_RE.test(voter)) return send(res, 400, { error: "Bad voter id" }, origin);
      if (!CHOICES.has(choice)) return send(res, 400, { error: "Unknown logo" }, origin);
      if (delta !== 1 && delta !== -1) return send(res, 400, { error: "Bad vote change" }, origin);
      if (limited(ip)) return send(res, 429, { error: "Too many clicks, wait a minute" }, origin);

      const device = deviceKey(ipHash, fp);
      let ballot = findBallot(voter, device, true);
      if (!ballot) {
        if (delta < 0) return send(res, 400, { error: "Nothing to remove" }, origin);
        if ((perIp.get(ipHash) || 0) >= MAX_BALLOTS_PER_IP) {
          return send(res, 403, {
            error: `This internet connection already has ${MAX_BALLOTS_PER_IP} voters. Ask in the guild chat if you think this is wrong.`,
          }, origin);
        }
        const id = crypto.randomUUID();
        ballot = db.ballots[id] = { picks: {}, ip: ipHash, device: device || hash("nodevice:" + voter), voters: [voter], at: new Date().toISOString() };
        index(id, ballot);
      }

      const used = Object.values(ballot.picks).reduce((a, n) => a + n, 0);
      const have = ballot.picks[choice] || 0;
      if (delta > 0 && used >= VOTES_PER_BALLOT) return send(res, 409, { error: `You've used all ${VOTES_PER_BALLOT} votes. Remove one first.` }, origin);
      if (delta < 0 && have === 0) return send(res, 409, { error: "No vote on that logo to remove" }, origin);

      const n = have + delta;
      if (n) ballot.picks[choice] = n;
      else delete ballot.picks[choice];
      ballot.at = new Date().toISOString();
      save();
      return send(res, 200, tally(ballot), origin);
    });
    return;
  }

  send(res, 404, { error: "Not found" }, origin);
}).listen(PORT, () => console.log(`vote server on :${PORT}, ${Object.keys(db.ballots).length} ballots loaded`));
