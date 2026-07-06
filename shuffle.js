"use strict";

/**
 * Deterministic PRNG (mulberry32). Given the same seed it produces the same
 * sequence, so a shuffled order stays stable for the lifetime of a seed.
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fisher-Yates shuffle. Returns a NEW array, does not mutate the input.
 */
function seededShuffle(items, seed) {
    const rng = mulberry32(seed);
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Tiny in-memory seed cache with TTL.
 * A series keeps the same shuffled order until the TTL expires (or the
 * process restarts), so "next episode" stays consistent mid-binge but you
 * get a fresh order later.
 */
class SeedCache {
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
        this.map = new Map();
    }

    getSeed(key) {
        const now = Date.now();
        const entry = this.map.get(key);
        if (entry && now - entry.createdAt < this.ttlMs) {
            return entry.seed;
        }
        const seed = (Math.random() * 0xffffffff) >>> 0;
        this.map.set(key, { seed, createdAt: now });
        this.prune(now);
        return seed;
    }

    prune(now) {
        if (this.map.size < 500) return;
        for (const [key, entry] of this.map) {
            if (now - entry.createdAt >= this.ttlMs) this.map.delete(key);
        }
    }
}

module.exports = { mulberry32, seededShuffle, SeedCache };
