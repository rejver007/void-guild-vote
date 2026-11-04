# VOID guild mark vote

A one-page vote for the new VOID guild mark in Cabal Online: 30 logo variations plus a "Keep the current logo" option. Each voter has 3 votes to spread over the logos (all 3 on one is fine) and can move them with + and − at any time. A live results table sits at the bottom of the page.

- **Page:** static files in this repo, served by GitHub Pages at <https://rejver007.github.io/void-guild-vote/>.
- **Vote counter:** [`server/server.js`](server/server.js), a dependency-free Node server deployed on Coolify from the [`Dockerfile`](Dockerfile). Ballots are kept in `/data/ballots.json`, so mount a volume at `/data`. `VOTES_PER_BALLOT` (default 3) and `MAX_BALLOTS_PER_IP` (default 3) can be set as environment variables.
- **Wiring:** [`api-config.js`](api-config.js) holds the counter's URL. The server only answers browsers coming from the origins in `ALLOWED_ORIGINS` (default: the GitHub Pages site and `http://localhost:8765`).

## Running locally

```bash
node server/server.js
```

```bash
python -m http.server 8765
```

Then open <http://localhost:8765>.

## Limits

There is no login, so a ballot is matched in two ways:

1. A random voter id the browser keeps in local storage.
2. A device key: a salted hash of the internet connection's IP address plus screen size, color depth, time zone and CPU core count. A second browser or a private window on the same PC and connection opens the same ballot.

Each internet connection can hold at most 3 ballots, so a few people sharing one connection can still vote. A phone on mobile data, or a VPN, still counts as a new voter. Each IP address can send at most 60 vote changes per minute. IP addresses are only stored as hashes.

To reset the vote, delete `/data/ballots.json` in the container and restart it.
