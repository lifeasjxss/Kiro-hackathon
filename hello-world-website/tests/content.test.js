// tests/content.test.js
//
// Content and tone checks for every instruction/feedback string shown
// to the kid: the static UI copy constants (js/ui.js's COPY), each
// case's mistake.why, and each case's four SPOT tip strings. See
// design.md "Property 17: Feedback and instruction copy is neutral and
// plain" (Requirements 3.7, 12.1, 12.2, 12.5).
//
// The Flesch-Kincaid grade-level heuristic and the shaming-word
// blocklist below are test-only tooling: they are not shipped to the
// game pages and are not exported from js/.

import { test, ok } from "./vendor/assert.js";
import { forAll, oneOf, constant } from "./vendor/pbt.js";
import { COPY } from "../js/ui.js";
import { loadCases } from "../js/cases.js";
import { SPOT_TOOLS } from "../js/spot.js";

// ---------------------------------------------------------------------------
// Flesch-Kincaid grade level (standard syllable-count heuristic).
// ---------------------------------------------------------------------------

/**
 * Count syllables in a single word. Standard heuristic: count vowel
 * groups, drop a silent trailing e/ed/es, treat a leading y as a
 * consonant, and floor every non-empty word at 1 syllable.
 * @param {string} word
 * @returns {number}
 */
function countSyllables(word) {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length === 0) return 0;
  if (lower.length <= 3) return 1;
  const trimmed = lower
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const matches = trimmed.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/** @param {string} text @returns {string[]} */
function splitWords(text) {
  return text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
}

/** @param {string} text @returns {string[]} non-empty sentences */
function splitSentences(text) {
  const parts = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return parts.length > 0 ? parts : [text];
}

/**
 * Flesch-Kincaid grade level for a string:
 * 0.39 * (words/sentence) + 11.8 * (syllables/word) - 15.59
 * @param {string} text
 * @returns {number}
 */
function fleschKincaidGrade(text) {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  const wordCount = Math.max(words.length, 1);
  const sentenceCount = Math.max(sentences.length, 1);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return (
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllableCount / wordCount) -
    15.59
  );
}

/** Longest sentence length, in words, within a string. @param {string} text @returns {number} */
function maxSentenceWordCount(text) {
  return splitSentences(text).reduce(
    (max, sentence) => Math.max(max, splitWords(sentence).length),
    0
  );
}

// ---------------------------------------------------------------------------
// Blocklist: shaming / second-person-blame words and phrases. Specific
// insult/shame terms, not generic second-person pronouns, since "you"
// alone shows up neutrally throughout the real SPOT tip copy (e.g. "a
// name you have never heard of").
// ---------------------------------------------------------------------------

const SHAMING_BLOCKLIST = [
  "stupid",
  "dumb",
  "idiot",
  "idiotic",
  "silly",
  "shame",
  "shameful",
  "loser",
  "lazy",
  "failure",
  "failed",
  "duh",
  "foolish",
  "moron",
  "pathetic",
  "should have known",
  "can't believe you",
  "wrong again",
];

/** @param {string} text @returns {boolean} */
function containsBlockedWord(text) {
  const lower = text.toLowerCase();
  return SHAMING_BLOCKLIST.some((word) => lower.includes(word));
}

// ---------------------------------------------------------------------------
// Collect every instruction/feedback string covered by Property 17.
// ---------------------------------------------------------------------------

/** @returns {string[]} */
function collectUiCopyStrings() {
  return Object.values(COPY);
}

/** @param {Array<object>} cases @returns {string[]} */
function collectCaseStrings(cases) {
  const strings = [];
  for (const aCase of cases) {
    strings.push(aCase.mistake.why);
    for (const tool of SPOT_TOOLS) {
      strings.push(aCase.spot[tool]);
    }
  }
  return strings;
}

// Feature: ai-detective, Property 17: Feedback and instruction copy is neutral and plain
test("Property 17: instruction/feedback copy has no shaming words, sentences of 15 words or fewer, and a Flesch-Kincaid grade of 8.0 or lower", async () => {
  const rawCases = await loadCases("../data/cases.json");
  const allStrings = [...collectUiCopyStrings(), ...collectCaseStrings(rawCases)];

  ok(allStrings.length > 0, "expected at least one string to check");

  const result = forAll(
    "instruction/feedback copy is neutral, short-sentenced, and <= grade 8.0",
    oneOf(...allStrings.map((s) => constant(s))),
    (text) => {
      if (containsBlockedWord(text)) return false;
      if (maxSentenceWordCount(text) > 15) return false;
      if (fleschKincaidGrade(text) > 8.0) return false;
      return true;
    },
    { iterations: Math.max(100, allStrings.length), seed: 1717 }
  );

  ok(
    result.pass,
    `expected all copy to pass; counterexample: ${JSON.stringify(result.counterexample)} error: ${result.error}`
  );
});
