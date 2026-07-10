"use strict";

const { addonBuilder } = require("stremio-addon-sdk");
const { seededShuffle, stringSeed } = require("./shuffle");

const CINEMETA = "https://v3-cinemeta.strem.io";
const ID_PREFIX = "shuffle:";
const UPSTREAM_CACHE_MS = 5 * 60 * 1000;
const installationIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const upstreamCache = new Map();

function manifestFor() {
    return {
        id: "com.github.DarkCowMoo.episode-shuffle",
        version: "1.1.0",
        name: "Episode Shuffle",
        description: "Create a personal, stable shuffled playlist for any series. Streams still come from your regular stream addons.",
        logo: "https://raw.githubusercontent.com/Stremio/stremio-art/main/originals/deer-4.png",
        resources: ["catalog", { name: "meta", types: ["series"], idPrefixes: [ID_PREFIX] }],
        types: ["series"],
        catalogs: [{
            type: "series",
            id: "shuffle-series",
            name: "Episode Shuffle",
            extra: [{ name: "search", isRequired: false }, { name: "skip" }]
        }],
        contactEmail: "shauli.arazi@gmail.com",
        behaviorHints: { configurable: true, configurationRequired: true }
    };
}

async function fetchJson(url) {
    const cached = upstreamCache.get(url);
    if (cached && Date.now() - cached.createdAt < UPSTREAM_CACHE_MS) return cached.value;

    const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
    const value = await res.json();
    upstreamCache.set(url, { value, createdAt: Date.now() });
    if (upstreamCache.size > 500) upstreamCache.delete(upstreamCache.keys().next().value);
    return value;
}

function toShufflePreview(meta) {
    return {
        id: ID_PREFIX + meta.id,
        type: "series",
        name: `🔀 ${meta.name}`,
        poster: meta.poster,
        posterShape: meta.posterShape || "poster",
        imdbRating: meta.imdbRating,
        releaseInfo: meta.releaseInfo,
        description: meta.description
    };
}

function createAddonInterface(installationId) {
    if (!installationIdPattern.test(installationId)) throw new Error("Invalid installation id");
    const builder = new addonBuilder(manifestFor());

    builder.defineCatalogHandler(async ({ type, id, extra }) => {
        if (type !== "series" || id !== "shuffle-series") return { metas: [] };
        const skip = Number(extra && extra.skip) || 0;
        const url = extra && extra.search
            ? `${CINEMETA}/catalog/series/top/search=${encodeURIComponent(extra.search)}.json`
            : skip > 0
                ? `${CINEMETA}/catalog/series/top/skip=${skip}.json`
                : `${CINEMETA}/catalog/series/top.json`;
        try {
            const data = await fetchJson(url);
            return {
                metas: (data.metas || []).filter((meta) => meta.id && meta.id.startsWith("tt")).map(toShufflePreview),
                cacheMaxAge: 300,
                staleError: 60
            };
        } catch (error) {
            console.error("catalog error:", error.message);
            return { metas: [], cacheMaxAge: 60 };
        }
    });

    builder.defineMetaHandler(async ({ type, id }) => {
        if (type !== "series" || !id.startsWith(ID_PREFIX)) return { meta: null };
        const imdbId = id.slice(ID_PREFIX.length);
        if (!/^tt\d+$/.test(imdbId)) return { meta: null };
        let data;
        try {
            data = await fetchJson(`${CINEMETA}/meta/series/${imdbId}.json`);
        } catch (error) {
            console.error("meta error:", error.message);
            return { meta: null, cacheMaxAge: 60 };
        }
        const meta = data && data.meta;
        if (!meta) return { meta: null };

        const now = Date.now();
        const episodes = (meta.videos || []).filter((video) => {
            if (!Number.isFinite(Number(video.season)) || Number(video.season) < 1) return false;
            return !video.released || new Date(video.released).getTime() <= now;
        });
        const shuffled = seededShuffle(episodes, stringSeed(`${installationId}:${imdbId}`));
        const videos = shuffled.map((video, index) => ({
            id: video.id,
            title: `${index + 1}. ${video.name || video.title || "Episode"} (S${video.season}E${video.episode})`,
            season: 1,
            episode: index + 1,
            number: index + 1,
            overview: video.overview || video.description,
            thumbnail: video.thumbnail,
            released: video.released,
            available: true
        }));
        return {
            meta: {
                id, type: "series", name: `🔀 ${meta.name}`,
                poster: meta.poster, background: meta.background, logo: meta.logo,
                description: `Your stable shuffled playlist of ${videos.length} episodes. Play the first episode and let autoplay do the rest.\n\n${meta.description || ""}`,
                releaseInfo: meta.releaseInfo, imdbRating: meta.imdbRating, genres: meta.genres,
                runtime: meta.runtime, videos,
                behaviorHints: { defaultVideoId: videos.length ? videos[0].id : undefined }
            },
            cacheMaxAge: 300,
            staleError: 60
        };
    });

    return builder.getInterface();
}

module.exports = { createAddonInterface };
