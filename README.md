# VOID guild mark vote

A one-page vote for the new VOID guild mark in Cabal Online: 30 logo variations plus a "Keep the current logo" option. Each visitor gets one vote and can change it at any time. A live results table sits at the bottom of the page.

- **Page:** static files in this repo, served by GitHub Pages at <https://rejver007.github.io/void-guild-vote/>.
- **Vote counter:** [`server/server.js`](server/server.js), a dependency-free Node server deployed on Coolify from the [`Dockerfile`](Dockerfile). Votes are kept in `/data/votes.json`, so mount a volume at `/data`.
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

One vote per browser. Someone who opens the page in another browser, on another device, or in a private window gets another vote. Each IP address can save at most 20 votes per minute.

To reset the vote, delete `/data/votes.json` in the container and restart it.
