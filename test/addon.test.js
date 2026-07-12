"use strict";

const assert = require("node:assert");
const { createAddonInterface } = require("../addon");

const originalFetch = global.fetch;
global.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes("/catalog/")
        ? { metas: [{ id: "tt123", name: "Example" }, { id: "bad-id", name: "Ignore" }] }
        : { meta: { id: "tt123", name: "Example", videos: [
            { id: "tt123:1:1", season: 1, episode: 1, name: "One", released: "2020-01-01" },
            { id: "tt123:0:1", season: 0, episode: 1, name: "Special" },
            { id: "tt123:1:2", season: 1, episode: 2, name: "Two", released: "2999-01-01" }
        ] } }
});

(async () => {
    const addon = createAddonInterface("abcdefghijklmnop");
    assert.equal(addon.manifest.behaviorHints.configurationRequired, false);
    const publicAddon = createAddonInterface("public-installation", { configurationRequired: true });
    assert.equal(publicAddon.manifest.behaviorHints.configurationRequired, true);
    const catalog = await addon.get("catalog", "series", "shuffle-series", {});
    assert.deepStrictEqual(catalog.metas.map((meta) => meta.id), ["shuffle:tt123"]);
    const response = await addon.get("meta", "series", "shuffle:tt123", {});
    assert.equal(response.meta.videos.length, 1, "specials and unaired episodes are removed");
    assert.equal(response.meta.videos[0].id, "tt123:1:1", "stream-compatible ID is preserved");
    assert.equal(response.meta.videos[0].season, 1, "playlist order is represented as a single season");
    console.log("All addon tests passed");
})().finally(() => { global.fetch = originalFetch; });
