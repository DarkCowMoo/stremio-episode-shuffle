# Episode Shuffle — Stremio Addon

Pick a series and watch its episodes in a random order. Search for a show in the **Episode Shuffle** catalog, open it, and its episode list becomes a shuffled playlist. Hit play on episode 1 for a random episode, or let autoplay walk through the whole shuffled order.

## How it works

Stremio addons can't reorder another addon's episode list, so this addon uses a wrapper approach:

1. **Catalog** — the addon exposes a searchable `series` catalog backed by [Cinemeta](https://v3-cinemeta.strem.io) (Stremio's official metadata addon). Each result is re-badged with a `shuffle:` id prefix (e.g. `shuffle:tt0903747`), which routes meta requests for those items to this addon.
2. **Meta** — when you open a shuffled series, the addon fetches the real episode list from Cinemeta, filters out specials (season 0) and unaired episodes, shuffles the rest with a seeded Fisher–Yates shuffle, and **renumbers them as Season 1, episodes 1..N** in shuffled order.
3. **Streams** — each shuffled entry keeps its *original* video id (`tt0903747:3:7`), so all your installed stream addons (Torrentio, debrid addons, etc.) resolve streams exactly as they would for the normal series. This addon never touches streams itself.
Each installation receives a private random installation id. The order is deterministically derived from that id and the series ID, so it is personal, stable across deploys, and consistent across multiple server instances.

## Run locally

Requires Node.js ≥ 18 (uses the built-in `fetch`).

```bash
npm install
npm start
```

Then open this page in a browser and use its install button:

```
http://127.0.0.1:7005/configure
```

The install button creates a unique URL of the form `/addon/<installation-id>/manifest.json`. Keep that URL private; it identifies your shuffle configuration.

## Usage

1. In Stremio, go to **Discover → Series → Episode Shuffle** (or just use the top search bar — results from this addon show a 🔀 prefix).
2. Open the 🔀 version of your show.
3. Press **Play** — it starts at the first shuffled episode (effectively a random one). With autoplay/binge mode on, Stremio continues through the shuffled order.

Marking-as-watched applies to the underlying episode ids, so watched state carries over between the normal and shuffled versions of a show.

## Testing on Stremio Web

The fastest dev loop: run `npm start`, open `http://127.0.0.1:7005/configure`, and install from there. Then use Stremio Web in Chrome or Edge. After code changes, reinstall to refresh the manifest.

## Deploy

Any Node host works (Render, Railway, Fly.io, a VPS...). The server binds to `process.env.PORT` and exposes `/health` for deployment health checks.

Note: Stremio requires public addons to be served over **HTTPS** (localhost is exempt).

## Tests

```bash
npm test
```

Covers shuffle determinism, per-install seeds, catalog ID filtering, episode filtering, and preservation of stream-compatible episode IDs.

## Project layout

```
addon.js     manifest + catalog/meta handlers
shuffle.js   seeded RNG and Fisher–Yates
server.js    configurable-install entrypoint
test/        unit tests
```

## Ideas / contributions welcome

- Config page to choose shuffle scope (whole series vs. a specific season)
- "Reshuffle now" action (creates a new installation id)
- Exclude already-watched episodes (would need Stremio library integration)

## Open-sourcing / publishing checklist

1. Manifest `id` and `contactEmail` in `addon.js`, and the repo URLs in `package.json`, are already set for this deployment.
2. Push to GitHub — CI (`.github/workflows/ci.yml`) runs tests and a manifest smoke test on Node 18/20/22.
3. Host it over HTTPS: [Beamup](https://github.com/Stremio/stremio-beamup) (Stremio's free community hosting, git-push deploys), or any Node host / the included `Dockerfile`.
4. Bump the manifest `version` on every deploy — clients cache manifests aggressively.
5. Publish to the in-app community catalog: `npm run publish-addon -- https://your-host/manifest.json`
6. Announce on r/StremioAddons and the community addon lists.

Use the public root manifest only for the catalog URL. Users should install through `https://your-host/configure`, which creates their personal addon URL.

## License

MIT
