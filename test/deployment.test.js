"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const procfile = fs.readFileSync(path.join(root, "Procfile"), "utf8");

assert.match(procfile, /^web: npm start\s*$/m, "Dokku web process must run npm start");
assert.equal(fs.existsSync(path.join(root, "Dockerfile")), false, "Beamup must use its supported Node buildpack instead of Dockerfile mode");
console.log("All deployment tests passed");
