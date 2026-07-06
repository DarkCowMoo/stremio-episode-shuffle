"use strict";

const { addonBuilder } = require("stremio-addon-sdk");
const { seededShuffle, SeedCache } = require("./shuffle");

const CINEMETA = "https://v3-cinemeta.strem.io";
const ID_PREFIX = "shuffle:";
// How long a shuffled order stays stable before it re-rolls.
const SHUFFLE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const seeds = new SeedCache(SHUFFLE_TTL_MS);

const manifest = {
    id: "com.github.DarkCowMoo.episode-shuffle",
    version: "1.0.0",
    name: "Episode Shuffle",
    description:
        "Pick a series and watch its episodes in a random order. " +
        "Search for a show in the Episode Shuffle catalog, open it, and the " +
        "episode list becomes a shuffled playlist — 'next episode' follows " +
        "the shuffled order, and streams come from your regular stream addons.",
    logo: "https://raw.githubusercontent.com/Stremio/stremio-art/main/originals/deer-4.png",
    resources: [
        "catalog",
        // Meta pages only for our own shuffle: ids
        { name: "meta", types: ["series"], idPrefixes: [ID_PREFIX] }
    ],
    types: ["series"],
    catalogs: [
        {
            type: "series",
            id: "shuffle-series",
            name: "Episode Shuffle",
            extra: [{ name: "search", isRequired: false }, { name: "skip" }]
        }
    ],
    contactEmail: "shauli.arazi@gmail.com", // shown on the addon page; used for takedown/contact
    behaviorHints: { configurable: false, configurationRequired: false }
};

const builder = new addonBuilder(manifest);

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
    return res.json();
}

function toShufflePreview(meta) {
    return {
        id: ID_PREFIX + meta.id,
        type: "series",
        name: `\u{1F500} ${meta.name}`, // 🔀 prefix so it's obvious in the UI
        poster: meta.poster,
        posterShape: meta.posterShape || "poster",
        imdbRating: meta.imdbRating,
        releaseInfo: meta.releaseInfo,
        description: meta.description
    };
}

// ---------------------------------------------------------------------------
// Catalog: search Cinemeta for series (or show popular ones when browsing)
// ---------------------------------------------------------------------------
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (type !== "series" || id !== "shuffle-series") return { metas: [] };

    const skip = Number(extra && extra.skip) || 0;
    let url;
    if (extra && extra.search) {
        url = `${CINEMETA}/catalog/series/top/search=${encodeURIComponent(extra.search)}.json`;
    } else {
        url = skip > 0
            ? `${CINEMETA}/catalog/series/top/skip=${skip}.json`
            : `${CINEMETA}/catalog/series/top.json`;
    }

    try {
        const data = await fetchJson(url);
        const metas = (data.metas || [])
            .filter((m) => m.id && m.id.startsWith("tt"))
            .map(toShufflePreview);
        return { metas, cacheMaxAge: 3600 };
    } catch (err) {
        console.error("catalog error:", err.message);
        return { metas: [] };
    }
});

// ---------------------------------------------------------------------------
// Meta: fetch the real series meta, shuffle episodes, renumber as one season
// ---------------------------------------------------------------------------
builder.defineMetaHandler(async ({ type, id }) => {
    if (type !== "series" || !id.startsWith(ID_PREFIX)) return { meta: null };

    const imdbId = id.slice(ID_PREFIX.length);
    const data = await fetchJson(`${CINEMETA}/meta/series/${imdbId}.json`);
    const meta = data && data.meta;
    if (!meta) return { meta: null };

    const now = Date.now();
    const episodes = (meta.videos || []).filter((v) => {
        // Only regular, already-released episodes (skip specials in season 0
        // and unaired ones).
        const season = Number(v.season);
        if (!Number.isFinite(season) || season < 1) return false;
        if (v.released && new Date(v.released).getTime() > now) return false;
        return true;
    });

    const seed = seeds.getSeed(imdbId);
    const shuffled = seededShuffle(episodes, seed);

    const videos = shuffled.map((v, i) => ({
        // Keep the ORIGINAL id (e.g. tt0903747:3:7) so your installed stream
        // addons (Torrentio, debrid addons, ...) resolve streams for it.
        id: v.id,
        title: `${i + 1}. ${v.name || v.title || "Episode"} (S${v.season}E${v.episode})`,
        season: 1,
        episode: i + 1,
        number: i + 1,
        overview: v.overview || v.description,
        thumbnail: v.thumbnail,
        // Preserve original release dates for display, but Stremio orders by
        // season/episode which we control above.
        released: v.released,
        available: true
    }));

    const shuffledMeta = {
        id,
        type: "series",
        name: `\u{1F500} ${meta.name}`,
        poster: meta.poster,
        background: meta.background,
        logo: meta.logo,
        description:
            `Shuffled playlist of ${videos.length} episodes. ` +
            `Play the first episode and let autoplay do the rest — or pick any ` +
            `entry for a random-ish episode. Order re-rolls every 12 hours.\n\n` +
            (meta.description || ""),
        releaseInfo: meta.releaseInfo,
        imdbRating: meta.imdbRating,
        genres: meta.genres,
        runtime: meta.runtime,
        videos,
        behaviorHints: {
            // "Play" button jumps straight to the first shuffled episode.
            defaultVideoId: videos.length ? videos[0].id : undefined
        }
    };

    return { meta: shuffledMeta, cacheMaxAge: 0, staleError: 0 };
});

module.exports = builder.getInterface();
