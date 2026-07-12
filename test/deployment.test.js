"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
const procfile = fs.readFileSync(path.join(root, "Procfile"), "utf8");
const beamupStart = fs.readFileSync(path.join(root, "beamup-start.js"), "utf8");

assert.match(dockerfile, /COPY beamup-start\.js \/start/, "Beamup /start entrypoint must be copied into the image");
assert.match(procfile, /^web: npm start\s*$/m, "Dokku web process must run npm start");
assert.match(beamupStart, /require\("\/app\/server\.js"\)/, "Beamup entrypoint must start the addon server");
console.log("All deployment tests passed");
