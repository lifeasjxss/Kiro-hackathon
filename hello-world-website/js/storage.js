// js/storage.js
// Browser-facing module: the ONLY module that touches localStorage.
// Serializes/deserializes the anonymous Aggregate under key
// "aiDetective.aggregate.v1", ignores unknown keys, and falls back to
// an in-memory aggregate if localStorage is unavailable or throws
// (private mode, quota). Never writes a name or any personal field.
// See design.md "storage.js" (Requirements 9.5, 9.6, 10.5).

const STORAGE_KEY = "aiDetective.aggregate.v1";

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
 * leaf to a non-negative integer. This is the privacy enforcement point:
 * no matter what shape comes in (from a corrupted stored blob, an old
 * schema version, or a caller passing extra fields), only `version`,
 * `missesByType` (four fixed keys), and `spotUsage` (four fixed keys)
 * ever come out.
 *
 * @param {*} agg - a possibly malformed or extended Aggregate-like value
 * @returns {object} a fresh, schema-correct Aggregate
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
 * Load the persisted Aggregate, or null if none is stored / readable.
 * Never throws: unavailable storage, a throwing `getItem`, or corrupted
 * JSON all fall back to returning null so the caller can fall back to
 * `emptyAggregate()` instead. Any extra/unknown field found in the stored
 * JSON (including anything that looks like a name or id) is stripped
 * before the value is returned.
 * @returns {object | null}
 */
export function loadAggregate() {
  let raw;
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn("aiDetective: localStorage unavailable, using in-memory aggregate", err);
    return null;
  }

  if (raw === null || raw === undefined) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("aiDetective: stored aggregate was corrupted JSON, ignoring", err);
    return null;
  }

  return normalizeAggregate(parsed);
}

/**
 * Persist the Aggregate. Must never throw; swallow and log on failure.
 * The value passed in is normalized to the fixed Aggregate schema before
 * serialization, so a stray personal/extra field can never be written to
 * storage even if one somehow reached this function.
 * @param {object} aggregate
 * @returns {void}
 */
export function saveAggregate(aggregate) {
  const safe = normalizeAggregate(aggregate);
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch (err) {
    console.warn("aiDetective: could not persist aggregate, continuing in-memory", err);
  }
}
