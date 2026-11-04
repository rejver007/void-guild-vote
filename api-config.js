// Where the vote counter runs (server/server.js, deployed on Coolify).
export const API_BASE = location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://void-vote.65.109.163.74.sslip.io";
