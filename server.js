"use strict";

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const { createAddonInterface } = require("./addon");

const PORT = Number(process.env.PORT) || 7005;
const installationIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const routers = new Map();
const app = express();

function addonRouter(installationId) {
    if (!routers.has(installationId)) {
        routers.set(installationId, getRouter(createAddonInterface(installationId)));
    }
    return routers.get(installationId);
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/configure", (_req, res) => {
    res.type("html").send(`<!doctype html><html><head><title>Episode Shuffle</title></head><body><h1>Episode Shuffle</h1><p>Install a personal, stable shuffled playlist for series episodes.</p><button id="install">Install in Stremio</button><script>document.getElementById("install").onclick=()=>{const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);const id=btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");location.href="stremio://"+location.host+"/addon/"+id+"/manifest.json"}</script></body></html>`);
});
app.use("/addon/:installationId", (req, res, next) => {
    const { installationId } = req.params;
    if (!installationIdPattern.test(installationId)) return res.status(404).end();
    return addonRouter(installationId)(req, res, next);
});
// This public manifest is used by the Stremio catalog. Individual users
// install through /configure, which gives them a private installation id.
app.use("/", addonRouter("public-installation"));

app.listen(PORT, () => {
    console.log(`Episode Shuffle addon running on port ${PORT}`);
    console.log(`Configure and install: http://127.0.0.1:${PORT}/configure`);
});
