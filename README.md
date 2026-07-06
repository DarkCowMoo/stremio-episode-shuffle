# Episode Shuffle — Stremio Addon

Pick a series and watch its episodes in a random order. Search for a show in the **Episode Shuffle** catalog, open it, and its episode list becomes a shuffled playlist. Hit play on episode 1 for a random episode, or let autoplay walk through the whole shuffled order.

## How it works

Stremio addons can't reorder another addon's episode list, so this addon uses a wrapper approach:

1. **Catalog** — the addon exposes a searchable `series` catalog backed by [Cinemeta](https://v3-cinemeta.strem.io) (Stremio's official metadata addon). Each result is re-badged with a `shuffle:` id prefix (e.g. `shuffle:tt0903747`), which routes meta requests for those items to this addon.
2. **Meta** — when you open a shuffled series, the addon fetches the real episode list from Cinemeta, filters out specials (season 0) and unaired episodes, shuffles the rest with a seeded Fisher–Yates shuffle, and **renumbers them as Season 1, episodes 1..N** in shuffled order.
3. **Streams** — each shuffled entry keeps its *original* video id (`tt0903747:3:7`), so all your installed stream addons (Torrentio, debrid addons, etc.) resolve streams exactly as they would for the normal series. This addon never touches streams itself.
4. **"Shuffle this series" link** — for *normal* (non-shuffled) episodes, the addon also answers stream requests with fake stream entries that are deep links to the shuffled page. Open any episode of any series and you'll see **🔀 Shuffle this series** in the streams list. This is the closest the addon protocol allows to a button on the regular series page, since addons cannot inject UI into pages they don't own.

   Link format differs per client, controlled by the `LINK_TARGET` env var:
   - `app` — `stremio:///detail/...` meta link; opened in-app by desktop / Android / Android TV clients
   - `web` — `https://web.strem.io/#/detail/...` link for Stremio Web
   - `both` (default) — serves both entries, so one addon deployment works everywhere

The shuffle order is seeded per-series and cached in memory for **12 hours**, so "next episode" stays consistent mid-binge but you get a fresh order later. Restarting the server also re-rolls all orders. Tune `SHUFFLE_TTL_MS` in `addon.js` to taste.

## Run locally

Requires Node.js ≥ 18 (uses the built-in `fetch`).

```bash
npm install
npm start
```

Then in Stremio: **Addons → paste addon URL** (or open in a browser):

```
http://127.0.0.1:7005/manifest.json
```

`serveHTTP` also serves a small landing page at `http://127.0.0.1:7005/` with an install button.

## Usage

1. In Stremio, go to **Discover → Series → Episode Shuffle** (or just use the top search bar — results from this addon show a 🔀 prefix).
2. Open the 🔀 version of your show.
3. Press **Play** — it starts at the first shuffled episode (effectively a random one). With autoplay/binge mode on, Stremio continues through the shuffled order.

Marking-as-watched applies to the underlying episode ids, so watched state carries over between the normal and shuffled versions of a show.

## Testing on Stremio Web

The fastest dev loop: run `npm start` locally, open https://web.strem.io in Chrome, and install `http://127.0.0.1:7005/manifest.json` from the Addons page. Chrome treats `127.0.0.1` as a secure origin, so the HTTPS page is allowed to talk to your local HTTP addon (this may not work in all browsers — use Chrome/Edge if the install silently fails). After code changes, restart the server and refresh the page; if a catalog or meta looks stale, bump `version` in the manifest or reinstall the addon to bust client caches.

Note the shuffled meta page and catalog behave identically on web and Android TV — only the deep-link entry differs (see `LINK_TARGET` above), so web is a faithful test environment for everything else.

## Deploy

Any Node host works (Render, Railway, Fly.io, a VPS...). The server binds to `process.env.PORT`. For serverless platforms, swap `serveHTTP` for the SDK's `getRouter` and mount it in an Express app.

Note: Stremio requires public addons to be served over **HTTPS** (localhost is exempt).

## Tests

```bash
npm test
```

Covers shuffle determinism, permutation correctness, non-mutation, and seed-cache TTL behavior.

## Project layout

```
addon.js     manifest + catalog/meta handlers
shuffle.js   seeded RNG, Fisher–Yates, seed cache (unit-tested)
server.js    entrypoint
test/        unit tests
```

## Ideas / contributions welcome

- Config page to choose shuffle scope (whole series vs. a specific season)
- "Reshuffle now" action (e.g. via a manifest `config` + user-supplied seed)
- Exclude already-watched episodes (would need Stremio library integration)

## Open-sourcing / publishing checklist

1. Manifest `id` and `contactEmail` in `addon.js`, and the repo URLs in `package.json`, are already set for this deployment.
2. Push to GitHub — CI (`.github/workflows/ci.yml`) runs tests and a manifest smoke test on Node 18/20/22.
3. Host it over HTTPS: [Beamup](https://github.com/Stremio/stremio-beamup) (Stremio's free community hosting, git-push deploys), or any Node host / the included `Dockerfile`.
4. Bump the manifest `version` on every deploy — clients cache manifests aggressively.
5. Publish to the in-app community catalog: `npm run publish-addon -- https://your-host/manifest.json`
6. Announce on r/StremioAddons and the community addon lists.

## License

MIT
