// Where the vote counter runs (server/server.js, deployed on Coolify).
// Several addresses point at the same server; some internet providers block
// sslip.io, so the page falls back to the next address.
export const API_BASES = location.hostname === "localhost"
  ? ["http://localhost:3000"]
  : ["https://void-vote.65.109.163.74.sslip.io", "https://void-vote.65.109.163.74.nip.io"];
