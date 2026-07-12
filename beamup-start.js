"use strict";

// Beamup's Docker scheduler invokes `node /start` for the web process.
// Keep this tiny compatibility entrypoint outside /app (see Dockerfile).
require("/app/server.js");
