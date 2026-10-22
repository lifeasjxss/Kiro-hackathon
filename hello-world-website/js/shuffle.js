// js/shuffle.js
// Pure, DOM-free module. Deterministic Fisher-Yates shuffle with an
// injected RNG so tests can seed it for reproducible candidate ordering.
// See design.md "shuffle.js - deterministic shuffle" (Requirement 2.2).

/**
 * Shuffle an array using the Fisher-Yates (Durstenfeld) algorithm.
 * Does not mutate the input array.
 *
 * @template T
 * @param {T[]} items - items to shuffle
 * @param {() => number} [rng] - random source in [0, 1); defaults to Math.random
 * @returns {T[]} a new shuffled array
 */
export function shuffle(items, rng = Math.random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
