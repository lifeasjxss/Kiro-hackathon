// js/badges.js
// Pure, DOM-free module computing end-screen badges from run state.
// See design.md "badges.js - end-screen badges" (Requirement 8.3).

/**
 * The four fixed mistake types, in a fixed order, used to keep badge
 * output deterministic regardless of Set iteration order.
 * @type {string[]}
 */
const MISTAKE_TYPE_ORDER = [
  "invented authority",
  "extreme numbers",
  "no specifics",
  "overconfident tone",
];

/**
 * One-line, plain-language skill labels per mistake type. Each is
 * 60 characters or fewer.
 * @type {Object<string, string>}
 */
const SKILL_LABELS = {
  "invented authority": "Spotted a made-up expert or group",
  "extreme numbers": "Caught a too-exact or wild number",
  "no specifics": "Noticed a claim with no real details",
  "overconfident tone": "Caught overconfidence hiding a guess",
};

/**
 * Derive the set of solved mistake types from `state.solvedTypes` when
 * present and Set-like, falling back to deriving it from `perCase` and
 * `cases` otherwise. Never throws; returns an empty Set on malformed input.
 *
 * @param {object} state - RunState (possibly malformed)
 * @returns {Set<string>} solved mistake types
 */
function deriveSolvedTypes(state) {
  if (state && state.solvedTypes && typeof state.solvedTypes.has === "function" &&
      typeof state.solvedTypes[Symbol.iterator] === "function") {
    return new Set(state.solvedTypes);
  }

  const solved = new Set();
  if (!state || !Array.isArray(state.cases) || !state.perCase || typeof state.perCase !== "object") {
    return solved;
  }

  for (const aCase of state.cases) {
    if (!aCase || typeof aCase.id === "undefined") continue;
    const caseProgress = state.perCase[aCase.id];
    if (caseProgress && caseProgress.solved && aCase.mistake && aCase.mistake.type) {
      solved.add(aCase.mistake.type);
    }
  }

  return solved;
}

/**
 * One badge per distinct mistake type solved at least once during the run.
 * Pure and synchronous; does not mutate `state`. Defensive against
 * malformed input: returns an empty array rather than throwing.
 *
 * @param {object} state - RunState
 * @returns {Array<{ type: string, label: string }>} earned badges
 */
export function earnedBadges(state) {
  const solvedTypes = deriveSolvedTypes(state);

  const badges = [];
  for (const type of MISTAKE_TYPE_ORDER) {
    if (solvedTypes.has(type) && SKILL_LABELS[type]) {
      badges.push({ type, label: SKILL_LABELS[type] });
    }
  }

  return badges;
}
