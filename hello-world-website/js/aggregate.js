// js/aggregate.js
// Pure, DOM-free module defining the anonymous aggregate-counts schema
// and the operations that update it. Holds only integer counts keyed by
// fixed mistake-type and SPOT-tool names; no ids, names, or timestamps.
// See design.md "aggregate.js - anonymous counts" (Requirements 4.4, 9.5, 10).
//
// Privacy note: this file must never gain a field that could identify a
// person or device (id, name, timestamp, session key, free text). The
// shape below is the only shape this module is allowed to produce.

/** The only mistake-type keys allowed under `missesByType`. */
const MISTAKE_TYPES = [
  "invented authority",
  "extreme numbers",
  "no specifics",
  "overconfident tone",
];

/** The only SPOT-tool keys allowed under `spotUsage`. */
const SPOT_TOOLS = ["step_away", "pick_words", "open_sources", "test_decide"];

/**
 * Coerce a value to a non-negative integer, defaulting to 0 for anything
 * that is not a finite, non-negative number (including undefined, NaN,
 * strings, negative numbers).
 *
 * @param {*} value
 * @returns {number} a non-negative integer
 */
function toNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

/**
 * Build a brand-new, schema-correct Aggregate from whatever was passed in,
 * dropping any key that is not part of the fixed schema and coercing every
 * leaf to a non-negative integer. This is the single place that enforces
 * the privacy-critical shape, so every exported function can route through
 * it instead of trusting the caller's object.
 *
 * @param {object} [agg] - a possibly malformed or extended Aggregate-like object
 * @returns {object} a fresh Aggregate containing only `version`,
 *   `missesByType` (four fixed keys), and `spotUsage` (four fixed keys)
 */
function normalizeAggregate(agg) {
  const source = agg && typeof agg === "object" ? agg : {};
  const missesSource =
    source.missesByType && typeof source.missesByType === "object"
      ? source.missesByType
      : {};
  const spotSource =
    source.spotUsage && typeof source.spotUsage === "object"
      ? source.spotUsage
      : {};

  const missesByType = {};
  for (const type of MISTAKE_TYPES) {
    missesByType[type] = toNonNegativeInt(missesSource[type]);
  }

  const spotUsage = {};
  for (const tool of SPOT_TOOLS) {
    spotUsage[tool] = toNonNegativeInt(spotSource[tool]);
  }

  return {
    version: 1,
    missesByType,
    spotUsage,
  };
}

/**
 * @returns {object} a fresh, empty Aggregate (version 1, all counts zero).
 *   Each call returns a brand-new object with brand-new nested objects, so
 *   mutating one returned aggregate never affects another.
 */
export function emptyAggregate() {
  return normalizeAggregate(null);
}

/**
 * Record a missed answer for a mistake type. Pure: does not mutate `agg`.
 * Returns a new, schema-correct Aggregate with `missesByType[mistakeType]`
 * incremented by 1. If `mistakeType` is not one of the four fixed types,
 * no counter changes and no new key is added; the returned object is still
 * normalized (stray keys on `agg` are stripped either way).
 *
 * @param {object} agg - current Aggregate
 * @param {string} mistakeType - one of the four fixed mistake types
 * @returns {object} new Aggregate
 */
export function recordMiss(agg, mistakeType) {
  const next = normalizeAggregate(agg);
  if (!MISTAKE_TYPES.includes(mistakeType)) {
    return next;
  }
  next.missesByType[mistakeType] = next.missesByType[mistakeType] + 1;
  return next;
}

/**
 * Record a SPOT tool activation. Pure: does not mutate `agg`. Returns a
 * new, schema-correct Aggregate with `spotUsage[tool]` incremented by 1.
 * If `tool` is not one of the four fixed tools, no counter changes and no
 * new key is added; the returned object is still normalized.
 *
 * @param {object} agg - current Aggregate
 * @param {string} tool - one of SPOT_TOOLS
 * @returns {object} new Aggregate
 */
export function recordSpotUse(agg, tool) {
  const next = normalizeAggregate(agg);
  if (!SPOT_TOOLS.includes(tool)) {
    return next;
  }
  next.spotUsage[tool] = next.spotUsage[tool] + 1;
  return next;
}
