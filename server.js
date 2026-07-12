"use strict";

const express = require("express");
const querystring = require("node:querystring");
const { createAddonInterface } = require("./addon");

const PORT = Number(process.env.PORT) || 7005;
const installationIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_CACHED_ROUTERS = 500;

function setCorsHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
}

function setCacheHeaders(res, response) {
    const directives = [
        ["cacheMaxAge", "max-age"],
        ["staleRevalidate", "stale-while-revalidate"],
        ["staleError", "stale-if-error"]
    ].filter(([property]) => Number.isInteger(response[property]))
        .map(([property, header]) => `${header}=${response[property]}`);
    if (directives.length) res.setHeader("Cache-Control", `${directives.join(", ")}, public`);
}

function createProtocolRouter(addon) {
    const router = express.Router();
    const manifest = JSON.stringify(addon.manifest);

    router.use((_req, res, next) => { setCorsHeaders(res); next(); });
    router.options("*", (_req, res) => res.sendStatus(204));
    router.get("/manifest.json", (_req, res) => res.type("json").send(manifest));

    async function handleResource(req, res) {
        const { resource, type, id, extra } = req.params;
        if (resource !== "catalog" && resource !== "meta") return res.status(404).json({ err: "not found" });
        try {
            const response = await addon.get(resource, type, id, extra ? querystring.parse(extra) : {});
            setCacheHeaders(res, response);
            return res.json(response);
        } catch (error) {
            console.error("protocol error:", error);
            return res.status(500).json({ err: "handler error" });
        }
    }

    router.get("/:resource/:type/:id/:extra.json", handleResource);
    router.get("/:resource/:type/:id.json", handleResource);
    return router;
}

function createApp({ maxCachedRouters = MAX_CACHED_ROUTERS } = {}) {
    const routers = new Map();
    const app = express();

    function addonRouter(installationId, configurationRequired = false) {
        const key = `${installationId}:${configurationRequired}`;
        if (!routers.has(key)) {
            if (routers.size >= maxCachedRouters) routers.delete(routers.keys().next().value);
            routers.set(key, createProtocolRouter(createAddonInterface(installationId, { configurationRequired })));
        }
        return routers.get(key);
    }

    app.get("/health", (_req, res) => res.json({ ok: true }));
    function sendConfigurePage(res, installationId) {
        const installScript = installationId
            ? `location.href="stremio://"+location.host+"/addon/${installationId}/manifest.json"`
            : `const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);const id=btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");location.href="stremio://"+location.host+"/addon/"+id+"/manifest.json"`;
        res.type("html").send(`<!doctype html><html><head><title>Episode Shuffle</title></head><body><h1>Episode Shuffle</h1><p>Install a personal, stable shuffled playlist for series episodes.</p><button id="install">Install in Stremio</button><script>document.getElementById("install").onclick=()=>{${installScript}}</script></body></html>`);
    }

    app.get("/configure", (_req, res) => sendConfigurePage(res));
    app.get("/addon/:installationId/configure", (req, res) => {
        const { installationId } = req.params;
        if (!installationIdPattern.test(installationId)) return res.status(404).end();
        return sendConfigurePage(res, installationId);
    });
    app.use("/addon/:installationId", (req, res, next) => {
        const { installationId } = req.params;
        if (!installationIdPattern.test(installationId)) return res.status(404).end();
        return addonRouter(installationId)(req, res, next);
    });
    // This public manifest is used by the Stremio catalog. Individual users
    // install through /configure, which gives them a private installation id.
    app.use("/", addonRouter("public-installation", true));
    app.locals.routerCache = routers;
    return app;
}

if (require.main === module) {
    createApp().listen(PORT, () => {
        console.log(`Episode Shuffle addon running on port ${PORT}`);
        console.log(`Configure and install: http://127.0.0.1:${PORT}/configure`);
    });
}

module.exports = { createApp, MAX_CACHED_ROUTERS };
