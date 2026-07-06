"use strict";
// Publishes the addon to Stremio's central registry so it appears in the
// in-app community catalog. Run once per deployment URL:
//   node publish.js https://your-host.example.com/manifest.json
const { publishToCentral } = require("stremio-addon-sdk");
const url = process.argv[2];
if (!url || !url.startsWith("https://")) {
    console.error("Usage: node publish.js https://<your-host>/manifest.json");
    process.exit(1);
}
publishToCentral(url)
    .then(() => console.log("Published to central registry:", url))
    .catch((err) => { console.error("Publish failed:", err.message); process.exit(1); });
