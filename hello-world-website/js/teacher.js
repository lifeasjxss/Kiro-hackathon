// js/teacher.js
// Entry point for teacher.html. Reads the anonymous Aggregate via
// storage.js and renders class-wide totals: misses by mistake type and
// SPOT tool usage. No student names, no individual results.
// See design.md (Requirement 10).

import { loadAggregate } from "./storage.js";
import { SPOT_TOOLS } from "./spot.js";

// These four literal strings must stay in sync with the fixed Aggregate
// schema's `missesByType` keys (see js/storage.js's MISTAKE_TYPES list and
// design.md's Aggregate data model). There is no public export of this
// list elsewhere, so it is hardcoded here to match storage.js exactly.
const MISTAKE_TYPES = [
  "invented authority",
  "extreme numbers",
  "no specifics",
  "overconfident tone",
];

const EMPTY_STATE_MESSAGE =
  "No games have been played on this device yet. Totals will show up here once kids start playing.";

/**
 * Capitalize only the first letter of a string, leaving the rest as-is.
 * @param {string} text
 * @returns {string}
 */
function capitalizeFirst(text) {
  if (text.length === 0) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Readable labels for each SPOT tool key, matching the exact button
 * text shown in the game (index.html's four .spot-tool buttons) so a
 * teacher sees the same name for a tool here as a kid sees in the
 * game. A naive "replace underscores with spaces" transform reads
 * fine for "step_away" ("Step away") but produces grammatically
 * incomplete fragments for the other three keys (e.g. "Test decide"
 * instead of "Test and decide"), so each label is spelled out here
 * instead of derived.
 * @type {Object<string, string>}
 */
const SPOT_TOOL_LABELS = {
  step_away: "Step away",
  pick_words: "Pick your search words",
  open_sources: "Open other sources",
  test_decide: "Test and decide",
};

/**
 * Turn a SPOT tool key like "step_away" into its matching in-game
 * label. Falls back to a plain word-replace for any unrecognized key,
 * so this never throws on unexpected data.
 * @param {string} toolKey
 * @returns {string}
 */
function spotToolLabel(toolKey) {
  return SPOT_TOOL_LABELS[toolKey] || capitalizeFirst(toolKey.replace(/_/g, " "));
}

/**
 * True when the aggregate has no recorded plays at all: either nothing
 * was ever stored, or everything stored is zero. A technically-present
 * but all-zero aggregate still reads as "no plays yet" rather than
 * showing a wall of zeros (Requirement 10.7).
 * @param {object | null} aggregate
 * @returns {boolean}
 */
function hasNoPlays(aggregate) {
  if (!aggregate) {
    return true;
  }
  const missCounts = Object.values(aggregate.missesByType || {});
  const spotCounts = Object.values(aggregate.spotUsage || {});
  const allCounts = missCounts.concat(spotCounts);
  return allCounts.every((count) => count === 0);
}

/**
 * Clear a list element's children.
 * @param {HTMLElement} listEl
 */
function clearList(listEl) {
  while (listEl.firstChild) {
    listEl.removeChild(listEl.firstChild);
  }
}

/**
 * Append one <li> per entry to a list element, using textContent only.
 * @param {HTMLElement} listEl
 * @param {Array<{ label: string, count: number }>} entries
 */
function renderEntries(listEl, entries) {
  for (const entry of entries) {
    const li = document.createElement("li");
    // The label stays plain text; the count is wrapped in its own span
    // so it alone can take the teacher-page number font (Chakra Petch)
    // without affecting the label's font. textContent only, no innerHTML.
    li.append(`${entry.label} — `);
    const countEl = document.createElement("span");
    countEl.className = "stat-number";
    countEl.textContent = String(entry.count);
    li.appendChild(countEl);
    listEl.appendChild(li);
  }
}

/**
 * Render the teacher page from the current stored aggregate.
 */
function renderTeacherPage() {
  const aggregate = loadAggregate();

  const emptyStateEl = document.getElementById("empty-state");
  const missListEl = document.getElementById("miss-totals");
  const spotListEl = document.getElementById("spot-totals");

  clearList(missListEl);
  clearList(spotListEl);

  if (hasNoPlays(aggregate)) {
    emptyStateEl.textContent = EMPTY_STATE_MESSAGE;
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;
  emptyStateEl.textContent = "";

  const missEntries = MISTAKE_TYPES.map((type) => ({
    label: capitalizeFirst(type),
    count: aggregate.missesByType[type] || 0,
  }));
  renderEntries(missListEl, missEntries);

  const spotEntries = SPOT_TOOLS.map((tool) => ({
    label: spotToolLabel(tool),
    count: aggregate.spotUsage[tool] || 0,
  }));
  renderEntries(spotListEl, spotEntries);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderTeacherPage);
} else {
  renderTeacherPage();
}
