"use strict";

const assert = require("node:assert");
const { seededShuffle, stringSeed } = require("../shuffle");

const items = Array.from({ length: 50 }, (_, index) => index);
const first = seededShuffle(items, 12345);
assert.deepStrictEqual(first, seededShuffle(items, 12345), "same seed must give same order");
assert.notDeepStrictEqual(first, seededShuffle(items, 54321), "different seeds should differ");
assert.deepStrictEqual([...first].sort((a, b) => a - b), items, "must be a permutation");
assert.deepStrictEqual(items, Array.from({ length: 50 }, (_, index) => index), "input not mutated");
assert.strictEqual(stringSeed("user-a:tt123"), stringSeed("user-a:tt123"), "seed is stable");
assert.notStrictEqual(stringSeed("user-a:tt123"), stringSeed("user-b:tt123"), "seed is per installation");
console.log("All shuffle tests passed");
