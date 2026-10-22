// js/cases.js
// Pure, DOM-free module for loading, validating, and selecting Cases,
// plus building the shuffled candidate-phrase list for a Case.
// See design.md "cases.js - load, validate, select" (Requirement 1).

import { shuffle } from "./shuffle.js";

const ALLOWED_MISTAKE_TYPES = [
  "invented authority",
  "extreme numbers",
  "no specifics",
  "overconfident tone",
];

/**
 * Fetch and parse data/cases.json with a timeout.
 * Rejects on timeout, network failure, non-OK response, or JSON parse error.
 *
 * @param {string} [url] - location of the cases data file
 * @param {number} [timeoutMs] - load timeout in milliseconds
 * @returns {Promise<Array<object>>} raw case records
 */
export async function loadCases(url = "data/cases.json", timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("Cases load timed out");
    }
    throw new Error(`Cases load failed: ${err && err.message ? err.message : err}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Cases load failed: ${response.status} ${response.statusText}`);
  }

  // Let JSON parse errors propagate with a clear message.
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Cases data is not valid JSON: ${err && err.message ? err.message : err}`);
  }

  return data;
}

/**
 * Check whether `phrase` is a non-empty string and an exact substring of `answer`.
 *
 * @param {unknown} phrase
 * @param {unknown} answer
 * @returns {boolean}
 */
function isExactSubstring(phrase, answer) {
  return (
    typeof phrase === "string" &&
    phrase.length > 0 &&
    typeof answer === "string" &&
    answer.includes(phrase)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Validate a single raw case record.
 *
 * @param {object} raw
 * @returns {boolean}
 */
function isValidCase(raw) {
  if (!raw || typeof raw !== "object") return false;

  if (!isNonEmptyString(raw.id)) return false;
  if (!isNonEmptyString(raw.topic)) return false;
  if (!isNonEmptyString(raw.question)) return false;
  if (!isNonEmptyString(raw.answer)) return false;

  const mistake = raw.mistake;
  if (!mistake || typeof mistake !== "object") return false;
  if (!isNonEmptyString(mistake.phrase)) return false;
  if (!isNonEmptyString(mistake.type)) return false;
  if (!ALLOWED_MISTAKE_TYPES.includes(mistake.type)) return false;
  if (!isNonEmptyString(mistake.why)) return false;
  if (!isExactSubstring(mistake.phrase, raw.answer)) return false;

  const decoys = raw.decoys;
  if (!Array.isArray(decoys)) return false;
  if (decoys.length !== 2 && decoys.length !== 3) return false;
  for (const decoy of decoys) {
    if (!isExactSubstring(decoy, raw.answer)) return false;
  }

  const spot = raw.spot;
  if (!spot || typeof spot !== "object") return false;
  if (!isNonEmptyString(spot.step_away)) return false;
  if (!isNonEmptyString(spot.pick_words)) return false;
  if (!isNonEmptyString(spot.open_sources)) return false;
  if (!isNonEmptyString(spot.test_decide)) return false;
  if (!isNonEmptyString(spot.searchPhrase)) return false;

  // sourceId and needsReview are optional and not checked for validity.

  return true;
}

/**
 * Keep only cases with every required field and a decoys length of 2 or 3.
 * Preserves original order; skips (rather than throws on) malformed cases.
 *
 * @param {Array<object>} raw - raw case records
 * @returns {Array<object>} validated cases
 */
export function validateCases(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidCase);
}

/**
 * Pick up to n valid cases, excluding any ids in exclude.
 * Returns min(n, remainingPool.length) cases, and [] only when the
 * remaining pool (after exclusion) is empty.
 *
 * @param {Array<object>} valid - validated cases
 * @param {number} [n] - target case count for the run
 * @param {string[]} [exclude] - case ids to exclude (e.g. already played)
 * @param {() => number} [rng] - random source for shuffle, defaults to Math.random
 * @returns {Array<object>} selected cases
 */
export function selectCases(valid, n = 10, exclude = [], rng = Math.random) {
  if (!Array.isArray(valid) || valid.length === 0) return [];

  const excludeSet = new Set(exclude || []);
  const remaining = valid.filter((aCase) => !excludeSet.has(aCase.id));

  if (remaining.length === 0) return [];

  const shuffled = shuffle(remaining, rng);
  const count = Math.min(n, shuffled.length);
  return shuffled.slice(0, count);
}

/**
 * Generate a short opaque random token. The value carries no information
 * about position or correctness.
 *
 * @param {() => number} rng
 * @returns {string}
 */
function randomToken(rng) {
  return rng().toString(36).slice(2, 10);
}

/**
 * Build the shuffled candidate-phrase list for a case: the planted
 * mistake phrase plus every decoy, each tagged with an opaque token
 * and an internal is-mistake flag.
 *
 * @param {object} aCase - a validated case
 * @param {() => number} [rng] - random source for shuffle
 * @returns {Array<{ token: string, phrase: string, isMistake: boolean }>}
 */
export function buildCandidates(aCase, rng = Math.random) {
  const candidates = [
    { token: randomToken(rng), phrase: aCase.mistake.phrase, isMistake: true },
    ...aCase.decoys.map((decoy) => ({
      token: randomToken(rng),
      phrase: decoy,
      isMistake: false,
    })),
  ];

  return shuffle(candidates, rng);
}
