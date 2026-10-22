// js/engine.js
// Pure, DOM-free state machine: run state, scoring, clue cost, SPOT
// recording, and pause snapshot/restore. See design.md
// "engine.js - state machine and scoring" (Requirements 2, 3, 5, 8).
//
// Design decision (task 6.1): `selectPhrase(state, phraseId)` keeps the
// signature and TransitionResult shape documented in design.md, but the
// `phraseId` parameter is the *phrase text* of the selected candidate,
// not an opaque `buildCandidates` token. design.md's "Candidate phrase
// selection UI" section keeps the token-to-mistake mapping out of the
// DOM and in the UI layer's own closure (so a kid can't read the answer
// off a data-* attribute); this engine module never sees `cases.js`'s
// opaque tokens at all and has no import on `cases.js`. Instead, the UI
// layer (task 9.x) is expected to resolve the token it receives from a
// click/keypress back to that candidate's `phrase` text (it already has
// this mapping from its own `buildCandidates` call) and pass that phrase
// text in as `phraseId`. The engine then determines correct/wrong by
// comparing it against the current case's `mistake.phrase` directly.
// This keeps the engine pure and DOM-free while still letting it be the
// single source of truth for the "correct"/"wrong" result it returns.

import { emptyAggregate, recordMiss, recordSpotUse } from "./aggregate.js";

/**
 * Clamp a score value so it never drops below 0. Every write to
 * `state.score` in this module is routed through this helper
 * (Requirement 5.5).
 *
 * @param {number} n
 * @returns {number}
 */
function clampScore(n) {
  return Math.max(0, n);
}

/**
 * Build a fresh perCase entry for a single case id.
 *
 * @returns {{ wrongAttempts: number, solved: boolean, clued: boolean, solvedTypesFirstTry: boolean }}
 */
function emptyPerCaseEntry() {
  return {
    wrongAttempts: 0,
    solved: false,
    clued: false,
    solvedTypesFirstTry: false,
  };
}

/**
 * Create a new RunState from a list of selected cases.
 *
 * @param {Array<object>} cases - 1-10 selected cases for the run
 * @returns {object} RunState
 */
export function createRun(cases) {
  const runCases = Array.isArray(cases) ? cases : [];

  const perCase = {};
  for (const aCase of runCases) {
    perCase[aCase.id] = emptyPerCaseEntry();
  }

  return {
    cases: runCases,
    index: 0,
    score: 0,
    perCase,
    solvedTypes: new Set(),
    aggregate: emptyAggregate(),
  };
}

/**
 * Apply a candidate-phrase selection to the current case.
 *
 * @param {object} state - RunState
 * @param {string} phraseId - the selected candidate's phrase text; this
 *   is "correct" when it equals the current case's `mistake.phrase`
 *   (see the file-level design decision comment above)
 * @returns {{ nextState: object, result: "correct" | "wrong" }}
 */
export function selectPhrase(state, phraseId) {
  const currentCase = state.cases[state.index];

  // Defensive no-op: run already finished / index out of bounds. Callers
  // are expected to check isComplete(state) before calling this, but we
  // must not throw if they don't.
  if (!currentCase) {
    return { nextState: state, result: "wrong" };
  }

  const prevEntry = state.perCase[currentCase.id] || emptyPerCaseEntry();

  if (phraseId === currentCase.mistake.phrase) {
    // Correct pick: mark this case solved and record the mistake type
    // for badges. Does not advance `index` (that is the separate,
    // explicit `advance` step, called by the UI after the unmask;
    // Requirement 3.4) and does not change `score` yet.
    const nextEntry = {
      ...prevEntry,
      solved: true,
      solvedTypesFirstTry: prevEntry.wrongAttempts === 0,
    };

    const nextSolvedTypes = new Set(state.solvedTypes);
    nextSolvedTypes.add(currentCase.mistake.type);

    // Award points based on the wrong attempts accumulated on this case
    // before this correct pick (Requirement 3.3). The formula's own
    // Math.max floors the award at 1, and the write is still routed
    // through clampScore per the module's "every score write is
    // clamped" convention (Requirement 5.5).
    const points = Math.max(100 - prevEntry.wrongAttempts * 25, 1);

    const nextState = {
      ...state,
      score: clampScore(state.score + points),
      perCase: {
        ...state.perCase,
        [currentCase.id]: nextEntry,
      },
      solvedTypes: nextSolvedTypes,
    };

    return { nextState, result: "correct" };
  }

  // Wrong pick: increment wrong attempts and record the miss in the
  // aggregate (Requirement 10.1). Index and solved flag stay unchanged.
  const nextEntry = {
    ...prevEntry,
    wrongAttempts: prevEntry.wrongAttempts + 1,
  };

  const nextState = {
    ...state,
    perCase: {
      ...state.perCase,
      [currentCase.id]: nextEntry,
    },
    aggregate: recordMiss(state.aggregate, currentCase.mistake.type),
  };

  return { nextState, result: "wrong" };
}

/**
 * Charge the clue cost for the current case, at most once per case
 * (Requirements 5.2, 5.3, 5.4).
 *
 * Note on "reveal only the mistake type" (Requirement 5.4): this
 * function does not return or compute the mistake type itself, and it
 * never touches which candidate phrase is correct (the engine has no
 * such mapping to begin with, per the design decision in the task 6.1
 * comment at the top of this file). The caller already holds the full
 * Case object for `state.cases[state.index]` and can read
 * `currentCase.mistake.type` directly to show the kid the mistake type;
 * `useClue`'s only job here is to update the clue/score bookkeeping.
 *
 * @param {object} state - RunState
 * @returns {object} next RunState
 */
export function useClue(state) {
  const currentCase = state.cases[state.index];

  // Defensive no-op: no current case (index out of bounds / run
  // complete). Mirrors selectPhrase's defensive handling.
  if (!currentCase) {
    return state;
  }

  const prevEntry = state.perCase[currentCase.id] || emptyPerCaseEntry();

  if (prevEntry.clued) {
    // Repeat clue on the same case: charge nothing further, but still
    // return a fresh copy to stay consistent with this module's
    // "always return a new object" convention.
    return {
      ...state,
      perCase: {
        ...state.perCase,
        [currentCase.id]: { ...prevEntry },
      },
    };
  }

  // First clue use on this case: charge 5 points, floored at 0.
  const nextEntry = { ...prevEntry, clued: true };

  return {
    ...state,
    score: clampScore(state.score - 5),
    perCase: {
      ...state.perCase,
      [currentCase.id]: nextEntry,
    },
  };
}

/**
 * Record a SPOT tool activation against the run's aggregate.
 *
 * Pure: does not mutate `state`. SPOT tool use is not case-specific
 * engine state (looking up the tool's tip/content is a `spot.js` + UI
 * concern), so this function has no "current case" guard the way
 * `selectPhrase`/`useClue` do. It never changes `index`, `score`, or any
 * `perCase` entry (including `solved`), and can be called an unlimited
 * number of times for the same or different tools (Requirements 4.3,
 * 4.6). If `tool` is not one of the four recognized SPOT tool keys,
 * `recordSpotUse` already handles that gracefully (no counter changes,
 * no new key added), so this function does not re-validate `tool`.
 *
 * @param {object} state - RunState
 * @param {string} tool - a SPOT tool key (see spot.js's SPOT_TOOLS)
 * @returns {object} next RunState, identical to `state` except for
 *   `aggregate`, which has the matching tool's count incremented by 1
 *   (Requirement 4.4)
 */
export function useSpotTool(state, tool) {
  return {
    ...state,
    aggregate: recordSpotUse(state.aggregate, tool),
  };
}

/**
 * Advance the run to the next case after an unmask.
 *
 * @param {object} state - RunState
 * @returns {object} next RunState
 */
export function advance(state) {
  return {
    ...state,
    index: state.index + 1,
  };
}

/**
 * Whether the run has finished its last case.
 *
 * Implemented as "every case in state.cases has been solved" rather than
 * an index comparison, since index advancement (`advance`) and solved
 * state (`selectPhrase`) are controlled independently in this module.
 *
 * @param {object} state - RunState
 * @returns {boolean}
 */
export function isComplete(state) {
  if (!Array.isArray(state.cases) || state.cases.length === 0) {
    return true;
  }

  return state.cases.every((aCase) => {
    const entry = state.perCase[aCase.id];
    return !!entry && entry.solved === true;
  });
}

/**
 * Deep-enough copy a RunState's `aggregate` so the copy shares no nested
 * object with the original. Mirrors the shape `aggregate.js`'s own
 * functions always return (`version`, `missesByType`, `spotUsage`).
 *
 * @param {object} aggregate
 * @returns {object} a fresh copy of `aggregate`
 */
function copyAggregate(aggregate) {
  return {
    ...aggregate,
    missesByType: { ...aggregate.missesByType },
    spotUsage: { ...aggregate.spotUsage },
  };
}

/**
 * Deep-enough copy a RunState so the copy shares no nested object with
 * the original: `perCase` is copied with each per-case entry
 * spread-copied, `solvedTypes` is copied via `new Set(...)`, and
 * `aggregate` is copied one level deeper via `copyAggregate`. `cases` is
 * copied as a new array (`[...state.cases]`); the individual Case
 * objects inside it are treated as read-only data throughout this
 * module and are not cloned.
 *
 * @param {object} state - RunState
 * @returns {object} a fresh copy of `state`
 */
function cloneRunState(state) {
  const perCase = {};
  for (const caseId of Object.keys(state.perCase)) {
    perCase[caseId] = { ...state.perCase[caseId] };
  }

  return {
    ...state,
    cases: [...state.cases],
    perCase,
    solvedTypes: new Set(state.solvedTypes),
    aggregate: copyAggregate(state.aggregate),
  };
}

/**
 * Capture a pause snapshot of the full run state, including the current
 * case (`index`) and `score` (Requirement 6.7).
 *
 * The returned value shares no nested object with `state`, so later
 * changes to `state` (or to whatever the caller does with it) cannot
 * affect the snapshot, and changes to the snapshot cannot affect
 * `state`. Pair with `restoreRun`: `restoreRun(snapshotRun(state))` must
 * produce a RunState deep-equal to `state` at the time of the snapshot
 * (this round trip is what task 6.10's property test checks).
 *
 * @param {object} state - RunState
 * @returns {object} a snapshot, structurally a RunState, safe to hold
 *   onto across arbitrary further engine calls
 */
export function snapshotRun(state) {
  return cloneRunState(state);
}

/**
 * Restore a RunState from a snapshot produced by `snapshotRun`.
 *
 * Returns a fresh copy of `snapshot` rather than the exact object
 * reference passed in, so that further mutation of the restored state
 * (or of whatever the caller does with it) can never alias back to the
 * stored snapshot, and vice versa. Together with `snapshotRun`, this
 * satisfies the round-trip contract: `restoreRun(snapshotRun(state))`
 * is deep-equal to `state`, including `index` and `score`
 * (Requirement 6.7).
 *
 * @param {object} snapshot - a value previously returned by `snapshotRun`
 * @returns {object} a new RunState, deep-equal to `snapshot`
 */
export function restoreRun(snapshot) {
  return cloneRunState(snapshot);
}
