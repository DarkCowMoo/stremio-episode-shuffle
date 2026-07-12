"use strict";

const assert = require("node:assert");
const http = require("node:http");
const { createApp } = require("../server");

function request(server, path) {
    return new Promise((resolve, reject) => {
        const { port } = server.address();
        http.get({ host: "127.0.0.1", port, path }, (response) => {
            let body = "";
            response.on("data", (chunk) => { body += chunk; });
            response.on("end", () => resolve({ status: response.statusCode, body }));
        }).on("error", reject);
    });
}

(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: true,
        json: async () => ({ metas: [{ id: "tt123", name: "Example" }] })
    });
    const app = createApp({ maxCachedRouters: 2 });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
        assert.deepStrictEqual(JSON.parse((await request(server, "/health")).body), { ok: true });
        assert.equal((await request(server, "/configure")).status, 200);
        assert.equal((await request(server, "/addon/abcdefghijklmnop/configure")).status, 200);
        assert.equal((await request(server, "/addon/not-valid/configure")).status, 404);

        const publicManifest = JSON.parse((await request(server, "/manifest.json")).body);
        assert.equal(publicManifest.behaviorHints.configurationRequired, true);
        const configuredManifest = JSON.parse((await request(server, "/addon/abcdefghijklmnop/manifest.json")).body);
        assert.equal(configuredManifest.behaviorHints.configurationRequired, false);
        const catalog = await request(server, "/addon/abcdefghijklmnop/catalog/series/shuffle-series/search=example.json");
        assert.equal(catalog.status, 200);
        assert.deepStrictEqual(JSON.parse(catalog.body).metas.map((meta) => meta.id), ["shuffle:tt123"]);

        await request(server, "/addon/bbbbbbbbbbbbbbbb/manifest.json");
        await request(server, "/addon/cccccccccccccccc/manifest.json");
        assert.equal(app.locals.routerCache.size, 2, "configured-router cache is bounded");
        console.log("All server tests passed");
    } finally {
        global.fetch = originalFetch;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
})().catch((error) => { throw error; });
