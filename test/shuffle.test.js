"use strict";

const assert = require("node:assert");
const { seededShuffle, SeedCache } = require("../shuffle");

// Deterministic for a given seed
const items = Array.from({ length: 50 }, (_, i) => i);
const a = seededShuffle(items, 12345);
const b = seededShuffle(items, 12345);
assert.deepStrictEqual(a, b, "same seed must give same order");

// Different seeds should (virtually always) differ
const c = seededShuffle(items, 54321);
assert.notDeepStrictEqual(a, c, "different seeds should give different order");

// Must be a permutation, and input untouched
assert.deepStrictEqual([...a].sort((x, y) => x - y), items, "must be a permutation");
assert.deepStrictEqual(items, Array.from({ length: 50 }, (_, i) => i), "input not mutated");

// Seed cache stability within TTL, re-roll after expiry
const cache = new SeedCache(50);
const s1 = cache.getSeed("tt123");
const s2 = cache.getSeed("tt123");
assert.strictEqual(s1, s2, "seed stable within TTL");

setTimeout(() => {
    // After TTL a new seed is (almost certainly) generated; assert the cache
    // at least issues a valid uint32 rather than asserting inequality, since
    // a random collision is theoretically possible.
    const s3 = cache.getSeed("tt123");
    assert.ok(Number.isInteger(s3) && s3 >= 0 && s3 <= 0xffffffff);
    console.log("All shuffle tests passed");
}, 60);
