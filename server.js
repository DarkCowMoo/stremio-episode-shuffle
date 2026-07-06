"use strict";

const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

const PORT = Number(process.env.PORT) || 7005;

serveHTTP(addonInterface, { port: PORT });

console.log(`Episode Shuffle addon running`);
console.log(`Install in Stremio: http://127.0.0.1:${PORT}/manifest.json`);
