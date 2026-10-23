// js/ui.js
// Browser-facing module: renders every game screen (Start, Loading,
// Error, Intro, Case, Unmask, Pause, End, certificate), wires controls,
// and manages the DOM. Reads engine state and never mutates it
// directly. Keeps the correct-candidate token mapping in a
// module-scoped closure, never in a DOM attribute.
// See design.md "Browser-facing modules - ui.js" and
// "Candidate phrase selection UI" (Requirements 2, 3, 6-9, 13).

import { loadCases, validateCases, selectCases, buildCandidates } from "./cases.js";
import {
  createRun,
  selectPhrase,
  advance,
  isComplete,
  useSpotTool,
  useClue,
  snapshotRun,
  restoreRun,
} from "./engine.js";
import { SPOT_TOOLS, toolContent } from "./spot.js";
import { initAudio, playDing, playThud, playClick, setMuted, isMuted } from "./audio.js";
import { focusElement, runSkippable } from "./a11y.js";
import { earnedBadges } from "./badges.js";
import { loadAggregate, saveAggregate } from "./storage.js";

// TODO: export more UI copy strings as module constants as later tasks
// (9.5-9.7) build out the remaining screens.

/**
 * UI copy strings, exported as module constants so content tests can
 * import and check them (reading level, length, tone). Every string is
 * written at roughly a 6th-grade reading level with short, plain
 * sentences (Requirements 12.1, 12.2, 12.4).
 */
export const COPY = {
  loadingMessage: "Loading cases...",
  errorLoadFailed:
    "We could not load the cases. Check your connection and try again.",
  errorNoCases:
    "No cases are ready to play right now. Please try again in a bit.",
  // Shown for ANY wrong candidate pick. Deliberately generic (the Case
  // data model only carries a "why" for the real planted mistake, not
  // one per wrong candidate) and written to be neutral and non-shaming:
  // no second-person blame words, no negative judgment of the kid
  // (Requirements 3.5, 3.7, 12.5). Kept at 53 characters, well under the
  // 120-character budget.
  wrongFeedback: "Not quite. Keep looking for the one made-up detail.",
  // Shown when a SPOT tool has no tip/searchPhrase content for the
  // current case (Requirement 4.5). Neutral, short, and keeps the case
  // active; it is not an error state.
  spotTipUnavailable: "That tip isn't available for this case right now.",
  // Shown on the Unmask screen's evidence recap when no SPOT tool was
  // used on the case just solved. Friendly, not a scold.
  evidenceEmptyTip: "Evidence helps. Try pinning a tip next time you play.",
};

/** Readable label for each SPOT tool key, used on evidence cards and in
 * the evidence recap's "Tools you used" line. Mirrors the button text
 * already shown on each tool in the Investigation tools panel.
 * @type {{ [key: string]: string }}
 */
const SPOT_TOOL_LABELS = {
  step_away: "Step away",
  pick_words: "Pick your search words",
  open_sources: "Open other sources",
  test_decide: "Test and decide",
};

/**
 * Capitalize only the first letter of a string, leaving the rest as-is.
 * Used to display a badge's mistake-type key (stored lowercase, e.g.
 * "extreme numbers") as the start of a readable list item rather than
 * a lowercase word leading the line.
 * @param {string} text
 * @returns {string}
 */
function capitalizeFirst(text) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Split an AI answer into sentence-sized chunks for the "mark as
 * suspicious" feature: one tappable `.suspect-line` button per chunk.
 * Splits only on whitespace that immediately follows a ".", "!", or
 * "?", so a decimal number like "109.4" (no space after the period)
 * is never split mid-number. Purely a display helper: it has no
 * relationship to `mistake.phrase` and never reveals which chunk holds
 * the planted mistake.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  if (typeof text !== "string") return [];
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Shorten a SPOT tip to a short version suitable for an evidence card,
 * cutting at the last whole word within `maxLen` characters rather
 * than mid-word. Returns the tip unchanged if it already fits.
 * @param {string} tip
 * @param {number} [maxLen]
 * @returns {string}
 */
function shortenTip(tip, maxLen = 60) {
  if (typeof tip !== "string") return "";
  const trimmed = tip.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 20 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

/** @type {{ [key: string]: HTMLElement | null }} */
let els = {};

/**
 * The current run's engine state (see engine.js's RunState shape).
 * Reassigned wholesale on every engine transition (never mutated in
 * place) so this module always holds exactly the state object the
 * engine returned. Private to this module; task 9.8 (main.js) does not
 * need direct access since ui.js owns the full Start-to-End flow.
 * @type {object | null}
 */
let runState = null;

/**
 * The shuffled candidate list (`{ token, phrase, isMistake }[]`) for the
 * case currently rendered on screen, as returned by
 * `cases.js`'s `buildCandidates`. Kept here, not on `runState`, and
 * never written into the DOM, so the `isMistake` flag stays out of
 * reach of anything inspecting the page (Requirement 9.2; see
 * design.md "Candidate phrase selection UI").
 * @type {Array<{ token: string, phrase: string, isMistake: boolean }>}
 */
let currentCandidates = [];

/**
 * The run-state snapshot taken when the pause menu was opened (task
 * 9.6), as returned by `engine.js`'s `snapshotRun`. Null whenever the
 * pause menu is closed. Holding this here (rather than just leaving
 * `runState` as-is while paused) means a future "discard changes made
 * while paused" path has an exact pre-pause state to fall back to, and
 * keeps `closePauseToResume`'s restore step a simple, explicit
 * `restoreRun(pausedSnapshot)` (Requirement 6.7).
 * @type {object | null}
 */
let pausedSnapshot = null;

/**
 * The full validated case pool from the most recent `loadCases` /
 * `validateCases` call. Kept here (rather than re-fetched) so "Next
 * case pack" (task 9.7) has the whole pool to select unplayed cases
 * from, without re-hitting the network (Requirement 8.6, 8.7).
 * @type {Array<object>}
 */
let allValidCases = [];

/**
 * The exact cases used for the run that just ended (or is ending), as
 * returned by `selectCases`. "Replay" reuses this array verbatim
 * (Requirement 8.5); "Next case pack" uses its ids to exclude already
 * played cases (Requirement 8.6) and then replaces this with the newly
 * selected pack.
 * @type {Array<object>}
 */
let lastSelectedCases = [];

/**
 * Evidence cards pinned for the case currently on screen, in the order
 * they were pinned: `{ tool, label, tip }[]`. Purely an in-memory UI
 * aid (never written to storage.js or the engine's aggregate) and
 * reset to an empty array for every new case by `renderCurrentCase()`.
 * @type {Array<{ tool: string, label: string, tip: string }>}
 */
let evidencePins = [];

/**
 * SPOT tool keys opened at least once on the case currently on screen.
 * Used only to build the Unmask screen's "Tools you used" recap line;
 * reset to an empty Set for every new case by `renderCurrentCase()`.
 * Not the same signal as `runState.aggregate.spotUsage`, which counts
 * uses across the whole run for the teacher dashboard and is never
 * touched by this module directly.
 * @type {Set<string>}
 */
let spotToolsUsed = new Set();

/**
 * Remove `.is-active` and set `aria-hidden="true"` on every `.screen`
 * element, then add `.is-active` and set `aria-hidden="false"` on the
 * screen matching `screenId`. The only place screen visibility is
 * toggled, so every transition goes through here.
 * @param {string} screenId - element id of the target `.screen` section
 * @returns {void}
 */
function showScreen(screenId) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach((screen) => {
    screen.classList.remove("is-active");
    screen.setAttribute("aria-hidden", "true");
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("is-active");
    target.setAttribute("aria-hidden", "false");
  }
}

/**
 * Show the Error screen with a given message, and move focus to the
 * message so screen readers announce it (Requirements 1.6, 1.7).
 * @param {string} message
 * @returns {void}
 */
function showError(message) {
  showScreen("screen-error");
  if (els.errorMessage) {
    els.errorMessage.textContent = message;
  }
  focusElement(els.errorMessage);
}

/**
 * Run the full case-loading flow: show the Loading screen, fetch and
 * validate cases, select a run-sized pack, and either hand off to the
 * (not-yet-implemented) case screen or show the appropriate Error
 * screen. Safe to call repeatedly (e.g. from Retry).
 * @returns {Promise<void>}
 */
async function startLoadingFlow() {
  showScreen("screen-loading");
  if (els.loadingMessage) {
    els.loadingMessage.textContent = COPY.loadingMessage;
  }

  let raw;
  try {
    raw = await loadCases();
  } catch (err) {
    // Network failure, timeout, or invalid JSON (Requirement 1.7).
    showError(COPY.errorLoadFailed);
    return;
  }

  const valid = validateCases(raw);
  // Remember the full validated pool so "Next case pack" (task 9.7) can
  // select unplayed cases from it later without re-fetching
  // (Requirements 8.6, 8.7).
  allValidCases = valid;

  const selected = selectCases(valid, 10);

  if (selected.length === 0) {
    // Cases loaded but none passed validation, or nothing left to
    // select (Requirement 1.6).
    showError(COPY.errorNoCases);
    return;
  }

  // Remember exactly which cases this run uses, so "Replay" can reuse
  // the same pack (Requirement 8.5) and "Next case pack" can exclude
  // these ids (Requirement 8.6).
  lastSelectedCases = selected;

  // Success path: build the run, render the first case's real content,
  // then reveal the case screen (Requirements 1.4, 1.5, 2.1, 2.6, 2.7).
  runState = createRun(selected);
  runState = { ...runState, aggregate: loadAggregate() ?? runState.aggregate };
  renderCurrentCase();
  showScreen("screen-case");
}

/**
 * Render the stepping-stone river for the current run: one
 * `.stepping-stone` element per case, in order, marked `is-current` for
 * the case at `runState.index` and `is-complete` for any case already
 * solved (Requirement 2.3).
 * @returns {void}
 */
function renderSteppingStones() {
  const track = document.getElementById("stepping-stone-track");
  if (!track) return;

  track.replaceChildren();

  runState.cases.forEach((aCase, i) => {
    const stone = document.createElement("div");
    stone.className = "stepping-stone";

    if (i === runState.index) {
      stone.classList.add("is-current");
    }

    const entry = runState.perCase[aCase.id];
    if (entry && entry.solved) {
      stone.classList.add("is-complete");
    }

    stone.textContent = String(i + 1);
    track.appendChild(stone);
  });
}

/**
 * Render the candidate phrase buttons for the current case into
 * `#candidate-list`. Each button carries only the phrase text, an
 * `aria-label`, and an opaque `data-token` (Requirement 2.2, 2.4, 2.10,
 * 9.2). The token-to-mistake mapping lives only in the module-scoped
 * `currentCandidates` closure, never in the DOM.
 * @returns {void}
 */
function renderCandidates() {
  const list = document.getElementById("candidate-list");
  if (!list) return;

  list.replaceChildren();

  currentCandidates.forEach((candidate) => {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "candidate-btn";
    button.textContent = candidate.phrase;
    button.setAttribute("aria-label", candidate.phrase);
    button.setAttribute("data-token", candidate.token);

    // Native <button> already fires `click` on Enter and Space when
    // focused, so a single click listener satisfies "click, Enter, and
    // Space only" with no manual keydown handling needed.
    button.addEventListener("click", () => {
      handleCandidateSelect(candidate.token);
    });

    item.appendChild(button);
    list.appendChild(item);
  });
}

/**
 * Render the full case screen (question, answer, counter, score,
 * stepping stones, and candidates) from the current `runState`
 * (Requirements 2.1, 2.2, 2.3, 2.6, 2.7).
 * @returns {void}
 */
function renderCurrentCase() {
  const currentCase = runState.cases[runState.index];
  if (!currentCase) return;

  const questionEl = document.getElementById("case-question");
  const counterEl = document.getElementById("question-counter");
  const scoreEl = document.getElementById("score-display");

  if (questionEl) questionEl.textContent = currentCase.question;
  renderAnswerSentences(currentCase);
  if (counterEl) {
    counterEl.textContent = `Case ${runState.index + 1} of ${runState.cases.length}`;
  }
  if (scoreEl) scoreEl.textContent = `Score: ${runState.score}`;

  renderSteppingStones();

  currentCandidates = buildCandidates(currentCase, Math.random);
  renderCandidates();

  // Fresh case: reset the clue button and any open SPOT tips left over
  // from the previous case, so neither carries state across cases
  // (Requirement 5.1's "while the case is unanswered" and the SPOT
  // panel's per-case tip content).
  const clueBtn = document.getElementById("clue-btn");
  if (clueBtn) {
    clueBtn.disabled = false;
    clueBtn.classList.remove("is-used");
  }

  document.querySelectorAll("#spot-panel .spot-tool").forEach((container) => {
    container.classList.remove("is-open");
    const tipEl = container.querySelector(".spot-tool__tip");
    const tipTextEl = container.querySelector(".spot-tool__tip-text");
    const pinBtn = container.querySelector(".spot-tool__pin-btn");
    if (tipEl) tipEl.hidden = true;
    if (tipTextEl) tipTextEl.textContent = "";
    if (pinBtn) {
      pinBtn.hidden = false;
      pinBtn.disabled = false;
      pinBtn.textContent = "Add to evidence";
    }
  });

  // Fresh case: the evidence board and the per-case "tools used"
  // tracking are both in-memory UI aids with no link to the engine's
  // state, so they are reset here directly rather than through a
  // run-state transition (Requirements: evidence is pinned per case
  // and never carries over).
  evidencePins = [];
  spotToolsUsed = new Set();
  renderEvidenceBoard();
}

/**
 * Render the AI's answer as one `.suspect-line` button per sentence
 * into `#case-answer`, replacing any previous case's buttons. Each
 * button toggles a "mark as suspicious" highlight on click, Enter, or
 * Space (native `<button>` behavior). Marking is a visual aid only:
 * it is never read by the candidate list, the engine, or the score,
 * and it resets automatically every time this function rebuilds the
 * button list for a new case.
 * @param {object} currentCase
 * @returns {void}
 */
function renderAnswerSentences(currentCase) {
  const answerEl = document.getElementById("case-answer");
  if (!answerEl) return;

  answerEl.replaceChildren();

  splitIntoSentences(currentCase.answer).forEach((sentence) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suspect-line";
    btn.textContent = sentence;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", `Mark as suspicious: ${sentence}`);
    btn.addEventListener("click", () => {
      playClick();
      toggleSuspectLine(btn, sentence);
    });
    answerEl.appendChild(btn);
  });
}

/**
 * Toggle one answer sentence's "marked as suspicious" highlight.
 * Updates the visible highlight class, `aria-pressed`, and the
 * `aria-label` so screen readers announce the current state using the
 * same "Mark as suspicious" / "Marked as suspicious" wording either
 * way (Requirement: clear label on the control).
 * @param {HTMLButtonElement} btn
 * @param {string} sentence
 * @returns {void}
 */
function toggleSuspectLine(btn, sentence) {
  const marked = btn.classList.toggle("is-suspect");
  btn.setAttribute("aria-pressed", String(marked));
  btn.setAttribute(
    "aria-label",
    `${marked ? "Marked" : "Mark"} as suspicious: ${sentence}`
  );
}

/**
 * Find the rendered candidate `<button>` for a given opaque token.
 * Tokens are unique per case (see `buildCandidates`), so a single
 * attribute-selector query is sufficient; no need to thread element
 * references through the render step.
 * @param {string} token
 * @returns {HTMLButtonElement | null}
 */
function findCandidateButton(token) {
  return document.querySelector(`#candidate-list button[data-token="${token}"]`);
}

/**
 * Show the in-case feedback region for a wrong pick: a neutral,
 * non-shaming one-line reason (Requirements 3.5, 3.7, 12.5), marked
 * with the `.feedback--wrong` variant so its glyph/color are distinct
 * from a correct outcome (Requirement 3.8). Moves focus to the region
 * so screen readers announce it.
 * @returns {void}
 */
function showWrongFeedback() {
  const region = document.getElementById("feedback-region");
  const why = document.getElementById("feedback-why");
  if (!region || !why) return;

  region.hidden = false;
  region.classList.remove("feedback--correct");
  region.classList.add("feedback--wrong");
  why.textContent = COPY.wrongFeedback;

  focusElement(region);
}

/**
 * Hide the in-case feedback region and clear its outcome classes, so a
 * fresh case (or a fresh attempt) does not show stale feedback.
 * @returns {void}
 */
function hideFeedback() {
  const region = document.getElementById("feedback-region");
  if (!region) return;

  region.hidden = true;
  region.classList.remove("feedback--correct", "feedback--wrong");
}

/**
 * Handle a SPOT tool activation: record the use against the engine's
 * aggregate, then show that tool's tip and neutral search phrase (or a
 * tip-unavailable message) in its own `.spot-tool__tip` span. Never
 * submits an answer, never advances the case, and is safe to call any
 * number of times for the same or different tools (Requirements 4.1,
 * 4.2, 4.3, 4.4, 4.5, 4.6).
 * @param {string} tool - one of spot.js's SPOT_TOOLS keys
 * @returns {void}
 */
function handleSpotToolActivate(tool) {
  if (!runState || !runState.cases[runState.index]) return;

  // Count this activation in the run's aggregate regardless of whether
  // tip content turns out to be available (Requirement 4.4).
  runState = useSpotTool(runState, tool);
  saveAggregate(runState.aggregate);

  // Tracked for the Unmask screen's evidence recap only (Requirement:
  // "which SPOT tools were used"); not the same counter as
  // `runState.aggregate.spotUsage` above, and never written to storage.
  spotToolsUsed.add(tool);

  const currentCase = runState.cases[runState.index];
  const content = toolContent(currentCase, tool);

  const container = document.querySelector(
    `#spot-panel .spot-tool[data-tool="${tool}"]`
  );
  const tipEl = container ? container.querySelector(".spot-tool__tip") : null;
  const tipTextEl = container
    ? container.querySelector(".spot-tool__tip-text")
    : null;
  const pinBtn = container
    ? container.querySelector(".spot-tool__pin-btn")
    : null;
  if (!tipEl || !tipTextEl) return;

  if (content.available) {
    // Each tool shows its own case-specific tip only. The "Pick your
    // search words" tip is the one tool whose data already names the
    // neutral search phrase itself (see data/cases.json's
    // spot.pick_words), so it alone needs no extra line appended; the
    // other three tools are not about searching and must not show a
    // search phrase at all. An earlier version of this line appended
    // "Try searching: {searchPhrase}" to every tool's tip, which made
    // all four tools look like the same generic search prompt.
    tipTextEl.textContent = content.tip;
    if (pinBtn) pinBtn.hidden = false;
  } else {
    tipTextEl.textContent = COPY.spotTipUnavailable;
    // No real tip to pin, so hide the pin control rather than letting
    // the kid pin a "not available" message as evidence.
    if (pinBtn) pinBtn.hidden = true;
  }

  tipEl.hidden = false;
  if (container) {
    container.classList.add("is-open");
  }
}

/**
 * Handle a SPOT tool's "Add to evidence" control: pin a small evidence
 * card (the tool's label plus a shortened version of its tip) to the
 * in-memory evidence board for the case currently on screen. Each tool
 * can be pinned once at a time; pressing the control again while its
 * card is already pinned is a no-op until the card is removed. Never
 * touches the engine's run state, the score, or storage.js.
 * @param {string} tool
 * @returns {void}
 */
function handlePinEvidence(tool) {
  if (!runState || !runState.cases[runState.index]) return;

  const currentCase = runState.cases[runState.index];
  const content = toolContent(currentCase, tool);
  if (!content.available) return;
  if (evidencePins.some((pin) => pin.tool === tool)) return;

  evidencePins.push({
    tool,
    label: SPOT_TOOL_LABELS[tool] || tool,
    tip: shortenTip(content.tip),
  });
  renderEvidenceBoard();

  const pinBtn = document.querySelector(
    `#spot-panel .spot-tool__pin-btn[data-tool="${tool}"]`
  );
  if (pinBtn) {
    pinBtn.disabled = true;
    pinBtn.textContent = "Added to evidence";
  }
}

/**
 * Remove one pinned evidence card by its tool key, and re-enable that
 * tool's "Add to evidence" control so it can be pinned again.
 * @param {string} tool
 * @returns {void}
 */
function handleRemoveEvidence(tool) {
  evidencePins = evidencePins.filter((pin) => pin.tool !== tool);
  renderEvidenceBoard();

  const pinBtn = document.querySelector(
    `#spot-panel .spot-tool__pin-btn[data-tool="${tool}"]`
  );
  if (pinBtn) {
    pinBtn.disabled = false;
    pinBtn.textContent = "Add to evidence";
  }
}

/**
 * Render the evidence board strip from `evidencePins`: one card per
 * pinned tool, each with a Remove control. Hides the whole board when
 * there is nothing pinned, so it never shows up as an empty strip.
 * @returns {void}
 */
function renderEvidenceBoard() {
  const board = document.getElementById("evidence-board");
  const list = document.getElementById("evidence-board-list");
  if (!board || !list) return;

  list.replaceChildren();

  if (evidencePins.length === 0) {
    board.hidden = true;
    return;
  }

  board.hidden = false;

  evidencePins.forEach((pin) => {
    const item = document.createElement("li");
    item.className = "evidence-card";

    const text = document.createElement("span");
    text.className = "evidence-card__text";
    text.textContent = `${pin.label}: ${pin.tip}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "evidence-card__remove";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute(
      "aria-label",
      `Remove ${pin.label} from the evidence board`
    );
    removeBtn.addEventListener("click", () => {
      playClick();
      handleRemoveEvidence(pin.tool);
    });

    item.appendChild(text);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

/**
 * Handle the Need a clue? control: charge the clue cost through the
 * engine (first use per case only; Requirements 5.2, 5.3, 5.5), update
 * the visible score, and reveal only the current case's mistake type
 * in the existing in-case feedback region, never which candidate is
 * correct (Requirement 5.4). Safe to call repeatedly on the same case;
 * `engine.js`'s `useClue` already guards the repeat charge.
 * @returns {void}
 */
function handleClueActivate() {
  if (!runState || !runState.cases[runState.index]) return;

  const currentCase = runState.cases[runState.index];

  runState = useClue(runState);

  const scoreEl = document.getElementById("score-display");
  if (scoreEl) scoreEl.textContent = `Score: ${runState.score}`;

  const region = document.getElementById("feedback-region");
  const why = document.getElementById("feedback-why");
  if (region && why) {
    region.classList.remove("feedback--correct", "feedback--wrong");
    why.textContent = `Clue: the mistake is "${currentCase.mistake.type}".`;
    region.hidden = false;
    focusElement(region);
  }

  const clueBtn = document.getElementById("clue-btn");
  if (clueBtn) {
    clueBtn.classList.add("is-used");
  }
}

/**
 * Handle a candidate phrase pick by token: resolve the token to its
 * phrase text via the `currentCandidates` closure, run it through the
 * engine, and update the module's `runState`. Implements the real
 * correct/wrong feedback and unmask flow (Requirements 2.8, 2.9, 3.1,
 * 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 12.5, 13.2).
 * @param {string} token
 * @returns {void}
 */
function handleCandidateSelect(token) {
  const candidate = currentCandidates.find((c) => c.token === token);
  if (!candidate) return;

  // The case being answered right now, captured BEFORE selectPhrase /
  // advance runs, so the unmask screen always describes the case that
  // was just solved (not whatever case `runState.index` points to
  // after a later `advance()`).
  const solvedCase = runState.cases[runState.index];

  const { nextState, result } = selectPhrase(runState, candidate.phrase);
  runState = nextState;
  saveAggregate(runState.aggregate);

  const button = findCandidateButton(token);

  const scoreEl = document.getElementById("score-display");
  if (scoreEl) scoreEl.textContent = `Score: ${runState.score}`;

  if (result === "correct") {
    hideFeedback();
    playDing();

    if (button) {
      button.classList.add("is-correct");
    }

    // Lock every candidate while the correct pick is highlighted; the
    // case is solved, so no further picks should be possible
    // (Requirement 2.8).
    const list = document.getElementById("candidate-list");
    if (list) {
      list.querySelectorAll("button").forEach((btn) => {
        btn.disabled = true;
      });
    }

    // The case is solved: a clue is no longer meaningful, so lock the
    // clue control too (Requirement 5.1).
    const clueBtn = document.getElementById("clue-btn");
    if (clueBtn) {
      clueBtn.disabled = true;
    }

    // Give the kid a moment to see the check mark on the button before
    // switching screens. runSkippable schedules the unmask after
    // durationMs, calls it immediately under reduced motion, and
    // returns a skip() function this task has no control to wire to
    // (no separate "skip" UI exists for this specific pause), so the
    // return value is intentionally unused here.
    runSkippable(
      () => {
        showUnmask(solvedCase);
      },
      { durationMs: 1200 }
    );

    return;
  }

  // Wrong pick: the case and its candidates stay active (Requirement
  // 3.6). Only the clicked button is disabled, so the kid can
  // immediately try a *different* candidate; the clicked one re-enables
  // itself after a short delay (see below) as the literal "retry
  // control that re-enables selection" the task calls for, while
  // keeping its `.is-wrong` history visible via CSS.
  if (button) {
    button.classList.add("is-wrong");
    button.disabled = true;
  }

  playThud();
  showWrongFeedback();

  runSkippable(
    () => {
      if (button) {
        button.disabled = false;
      }
    },
    { durationMs: 1500 }
  );
}

/**
 * Show the Unmask screen for the case that was just solved: the
 * mistake type and its one-sentence "why" (Requirements 3.1, 3.2),
 * read directly from the case's own data. Moves focus to the revealed
 * type so screen readers announce the reveal (Requirement 13.2).
 * @param {object} solvedCase - the Case object just solved
 * @returns {void}
 */
function showUnmask(solvedCase) {
  showScreen("screen-unmask");

  renderEvidenceRecap();

  const typeEl = document.getElementById("unmask-type");
  const whyEl = document.getElementById("unmask-why");

  if (typeEl) {
    typeEl.textContent = `Mistake type: ${solvedCase.mistake.type}`;
  }
  if (whyEl) {
    whyEl.textContent = solvedCase.mistake.why;
  }

  // Focus the evidence recap first, so screen readers announce the
  // kid's own detective work before the mistake type/why explanation
  // that follows it on screen.
  focusElement(document.getElementById("evidence-recap-heading"));
}

/**
 * Render the Unmask screen's "Your evidence" recap from the case just
 * solved: which SPOT tools were used, plus any evidence cards pinned
 * while working the case. If no SPOT tool was used at all, shows a
 * friendly one-line tip instead (Requirement: "if none were used").
 * Reads only the in-memory `evidencePins`/`spotToolsUsed` state; never
 * touches the engine, the score, or storage.js.
 * @returns {void}
 */
function renderEvidenceRecap() {
  const list = document.getElementById("evidence-recap-list");
  const emptyEl = document.getElementById("evidence-recap-empty");
  if (!list || !emptyEl) return;

  list.replaceChildren();

  if (spotToolsUsed.size === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = COPY.evidenceEmptyTip;
    return;
  }

  emptyEl.hidden = true;

  const toolsItem = document.createElement("li");
  const toolNames = Array.from(spotToolsUsed)
    .map((tool) => SPOT_TOOL_LABELS[tool] || tool)
    .join(", ");
  toolsItem.textContent = `Tools you used: ${toolNames}`;
  list.appendChild(toolsItem);

  evidencePins.forEach((pin) => {
    const item = document.createElement("li");
    item.textContent = `${pin.label}: ${pin.tip}`;
    list.appendChild(item);
  });
}

/**
 * Handle the Unmask screen's Continue control: advance the run to the
 * next case (Requirement 3.4) and either render it, or — once the run
 * is complete — fall back to a safe, non-crashing screen.
 * @returns {void}
 */
function handleUnmaskContinue() {
  runState = advance(runState);

  if (isComplete(runState)) {
    // Run finished: show the End screen (score, badges, Replay/Next
    // pack/Download certificate). Called synchronously with no
    // artificial delay, so it shows within 1 second of the final case
    // (Requirement 8.1).
    showEndScreen();
    return;
  }

  hideFeedback();
  renderCurrentCase();
  showScreen("screen-case");
}

/**
 * Show the End screen: final score, one badge per distinct mistake type
 * solved during the run, and the Replay/Next pack/Download certificate
 * controls (already static in index.html). Reads `earnedBadges` from
 * `badges.js` against the just-finished `runState` (Requirement 8.3).
 * Moves focus to the final score so screen readers announce it, since
 * the end screen's heading has no id to focus instead.
 * @returns {void}
 */
function showEndScreen() {
  const scoreEl = document.getElementById("final-score");
  if (scoreEl) {
    scoreEl.textContent = `Final score: ${runState.score}`;
  }

  const badges = earnedBadges(runState);
  const list = document.getElementById("badge-list");
  if (list) {
    list.replaceChildren();
    badges.forEach((badge) => {
      const item = document.createElement("li");
      item.className = "badge";
      item.textContent = `${capitalizeFirst(badge.type)} — ${badge.label}`;
      list.appendChild(item);
    });
  }

  showScreen("screen-end");
  focusElement(scoreEl);
}

/**
 * Replay control: start a brand-new run using the exact same case pack
 * that was just played (Requirement 8.5). Case order is reused as-is;
 * each case's candidate order is re-shuffled anyway by
 * `renderCurrentCase`'s call to `buildCandidates`, so a replay is not a
 * carbon-copy click-for-click of the prior run.
 * @returns {void}
 */
function handleReplay() {
  // Defensive guard: the End screen should only be reachable after a
  // completed run, so this should always be non-empty in practice.
  if (lastSelectedCases.length === 0) return;

  runState = createRun(lastSelectedCases);
  runState = { ...runState, aggregate: loadAggregate() ?? runState.aggregate };
  renderCurrentCase();
  showScreen("screen-case");
}

/**
 * Next case pack control: start a new run using only cases not played
 * in the prior pack (Requirement 8.6). When excluding the just-played
 * ids empties the pool, wrap around and select fresh from the full
 * pool with no exclusion, i.e. reset to the first pack (Requirement
 * 8.7).
 * @returns {void}
 */
function handleNextPack() {
  const playedIds = lastSelectedCases.map((c) => c.id);

  let nextSelected = selectCases(allValidCases, 10, playedIds);

  if (nextSelected.length === 0) {
    // No unplayed cases remain: wrap around to the first pack by
    // selecting again with no exclusion (Requirement 8.7).
    nextSelected = selectCases(allValidCases, 10, []);
  }

  // Defensive guard: only reachable if `allValidCases` itself is empty,
  // which should not happen since a run could not have started without
  // cases. Avoid crashing rather than starting an empty run.
  if (nextSelected.length === 0) return;

  lastSelectedCases = nextSelected;

  runState = createRun(nextSelected);
  runState = { ...runState, aggregate: loadAggregate() ?? runState.aggregate };
  renderCurrentCase();
  showScreen("screen-case");
}

/**
 * Download certificate control: fill in the just-finished run's score
 * and badges (reusing the same `earnedBadges` data as the End screen,
 * no new storage), then show the print-styled certificate screen. The
 * certificate's blank name and date lines are static markup in
 * index.html with no input control, so there is no name or date to
 * pre-fill or store here (Requirement 8.9). Moves focus to the
 * certificate's title so screen readers announce the new screen.
 * @returns {void}
 */
function handleCertificateOpen() {
  const scoreEl = document.getElementById("certificate-score");
  if (scoreEl && runState) {
    scoreEl.textContent = `Final score: ${runState.score}`;
  }

  const badgeListEl = document.getElementById("certificate-badge-list");
  if (badgeListEl) {
    badgeListEl.replaceChildren();
    if (runState) {
      earnedBadges(runState).forEach((badge) => {
        const item = document.createElement("li");
        item.textContent = `${capitalizeFirst(badge.type)} — ${badge.label}`;
        badgeListEl.appendChild(item);
      });
    }
  }

  showScreen("screen-certificate");
  focusElement(document.querySelector(".certificate__title"));
}

/**
 * Print or save as PDF control: trigger the browser's own print
 * dialog. The print stylesheet (styles.css's @media print block) hides
 * every button and every other screen, leaving only the certificate
 * itself in the printed/saved output. No data is generated or stored;
 * this only invokes the browser-native print flow.
 * @returns {void}
 */
function handleCertificatePrint() {
  window.print();
}

/**
 * Certificate screen's Back control: return to the End screen.
 * @returns {void}
 */
function handleCertificateClose() {
  showScreen("screen-end");
}

/**
 * Open the pause menu: snapshot the current run (Requirement 6.7),
 * show the pause screen as a modal overlay on top of the case screen
 * (halting progression simply by occupying the active screen, per the
 * existing `showScreen` convention), move focus to the dialog's
 * heading so screen readers announce "Paused", and sync the pause
 * menu's own Mute button label with the current mute state.
 * No-ops if no run is in progress (defensive; `#pause-btn` only exists
 * on the case screen in practice).
 * @returns {void}
 */
function openPause() {
  if (!runState) return;

  // Snapshot BEFORE anything else changes, so it reflects exactly the
  // state the kid was looking at when they pressed pause.
  pausedSnapshot = snapshotRun(runState);

  showScreen("screen-pause");

  const pauseHeading = document.getElementById("pause-heading");
  focusElement(pauseHeading);

  syncMuteControls();
}

/**
 * Resume action: restore the run from the pause snapshot
 * (Requirement 6.7), re-render the case screen from that restored
 * state, and move focus back to the case screen's pause control.
 *
 * `renderCurrentCase()` unconditionally resets the clue button and
 * SPOT tips (task 9.5's "fresh case" behavior), so this re-applies two
 * small corrections afterward so the restored screen visually matches
 * what was on screen before pausing:
 *  - if the current case's `clued` flag was already set, re-add the
 *    clue button's `.is-used` class (not disabled; `useClue` already
 *    makes a repeat click harmless)
 *  - if the current case was already `solved` (pause reachable after
 *    a correct pick but before the unmask transition fires), re-lock
 *    the candidate buttons and the clue button rather than leaving
 *    them freshly enabled
 * No-ops if the pause menu isn't actually open.
 * @returns {void}
 */
function closePauseToResume() {
  if (!pausedSnapshot) return;

  runState = restoreRun(pausedSnapshot);
  pausedSnapshot = null;

  renderCurrentCase();

  const currentCase = runState.cases[runState.index];
  const entry = currentCase ? runState.perCase[currentCase.id] : null;
  const clueBtn = document.getElementById("clue-btn");

  if (entry && entry.clued && clueBtn) {
    clueBtn.classList.add("is-used");
  }

  // Guard: the paused case was already solved (correct pick landed but
  // the unmask hadn't happened yet). renderCurrentCase() just rendered
  // fresh, enabled candidates, so re-lock them to match the
  // just-solved state instead of letting the kid re-answer.
  if (entry && entry.solved) {
    const list = document.getElementById("candidate-list");
    if (list) {
      list.querySelectorAll("button").forEach((btn) => {
        btn.disabled = true;
      });
    }
    if (clueBtn) {
      clueBtn.disabled = true;
    }
  }

  showScreen("screen-case");
  focusElement(document.getElementById("pause-btn"));
}

/**
 * Restart action: confirm with the kid before discarding the current
 * run (Requirement 6.6, 6.8), then, if confirmed, drop the pause
 * snapshot and kick off a brand-new run through the existing loading
 * flow. Does nothing (stays on the pause screen) if the confirmation
 * is declined.
 * @returns {void}
 */
function handleRestart() {
  const confirmed = window.confirm("Restart and lose your current progress?");
  if (!confirmed) return;

  pausedSnapshot = null;
  startLoadingFlow();
}

/**
 * Home action: discard the run (and any pause snapshot) with no
 * confirmation prompt, per Requirement 6.9, and return to the Start
 * screen.
 * @returns {void}
 */
function handleHome() {
  runState = null;
  pausedSnapshot = null;
  showScreen("screen-start");
}

/**
 * Sync both mute controls' visible state (icon, label, aria-pressed)
 * with `audio.js`'s current `isMuted()` value, the single source of
 * truth. Called after every mute toggle and whenever the pause menu
 * opens, so both controls always agree (Requirement 6.10).
 * @returns {void}
 */
function syncMuteControls() {
  const muted = isMuted();

  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) {
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    const onIcon = muteBtn.querySelector(".icon-on");
    const offIcon = muteBtn.querySelector(".icon-off");
    if (onIcon) onIcon.hidden = muted;
    if (offIcon) offIcon.hidden = !muted;
  }

  const pauseMuteBtn = document.getElementById("pause-mute-btn");
  if (pauseMuteBtn) {
    pauseMuteBtn.setAttribute("aria-pressed", String(muted));
    const onIcon = pauseMuteBtn.querySelector(".icon-on");
    const offIcon = pauseMuteBtn.querySelector(".icon-off");
    if (onIcon) onIcon.hidden = muted;
    if (offIcon) offIcon.hidden = !muted;
    const label = document.getElementById("pause-mute-label");
    if (label) label.textContent = muted ? "Unmute" : "Mute";
  }
}

/**
 * Toggle game audio mute state, shared by both the always-visible
 * case-screen mute control and the pause menu's Mute control
 * (Requirement 6.10). Keeps both controls' visible state in sync
 * regardless of which one was clicked.
 * @returns {void}
 */
function toggleMute() {
  setMuted(!isMuted());
  syncMuteControls();
}

/**
 * Initialize and render the game UI into the document.
 * Queries every element this task needs once, wires the Start screen's
 * Play button and the Error screen's Retry button, and leaves the
 * Start screen as the initially active screen (matching index.html's
 * static default).
 * @returns {void}
 */
export function initUI() {
  els = {
    playBtn: document.getElementById("play-btn"),
    retryBtn: document.getElementById("retry-btn"),
    errorMessage: document.getElementById("error-message"),
    loadingMessage: document.getElementById("loading-message"),
    unmaskContinueBtn: document.getElementById("unmask-continue-btn"),
  };

  if (els.loadingMessage) {
    els.loadingMessage.textContent = COPY.loadingMessage;
  }
  if (els.errorMessage) {
    els.errorMessage.textContent = COPY.errorLoadFailed;
  }

  if (els.playBtn) {
    els.playBtn.addEventListener("click", () => {
      // Audio must only ever start after this user gesture
      // (Requirements 6.1, 6.2, 6.3). Never call initAudio() elsewhere.
      initAudio();
      playClick();
      startLoadingFlow();
    });
  }

  if (els.retryBtn) {
    els.retryBtn.addEventListener("click", () => {
      playClick();
      startLoadingFlow();
    });
  }

  if (els.unmaskContinueBtn) {
    els.unmaskContinueBtn.addEventListener("click", () => {
      playClick();
      handleUnmaskContinue();
    });
  }

  // Investigation tools (SPOT toolkit): four static tool cards, each
  // with its own toggle button and "Add to evidence" button. Native
  // <button> already handles Enter/Space activation, so one click
  // listener per control satisfies "keyboard-operable" with no extra
  // keydown wiring (Requirement 4.1).
  SPOT_TOOLS.forEach((tool) => {
    const toggleBtn = document.querySelector(
      `#spot-panel .spot-tool__toggle[data-tool="${tool}"]`
    );
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        playClick();
        handleSpotToolActivate(tool);
      });
    }

    const pinBtn = document.querySelector(
      `#spot-panel .spot-tool__pin-btn[data-tool="${tool}"]`
    );
    if (pinBtn) {
      pinBtn.addEventListener("click", () => {
        playClick();
        handlePinEvidence(tool);
      });
    }
  });

  els.clueBtn = document.getElementById("clue-btn");
  if (els.clueBtn) {
    els.clueBtn.addEventListener("click", () => {
      playClick();
      handleClueActivate();
    });
  }

  // Pause menu + mute wiring (task 9.6).
  els.pauseBtn = document.getElementById("pause-btn");
  if (els.pauseBtn) {
    els.pauseBtn.addEventListener("click", () => {
      playClick();
      openPause();
    });
  }

  els.muteBtn = document.getElementById("mute-btn");
  if (els.muteBtn) {
    els.muteBtn.addEventListener("click", () => {
      toggleMute();
    });
  }

  els.pauseMuteBtn = document.getElementById("pause-mute-btn");
  if (els.pauseMuteBtn) {
    els.pauseMuteBtn.addEventListener("click", () => {
      toggleMute();
    });
  }

  els.resumeBtn = document.getElementById("resume-btn");
  if (els.resumeBtn) {
    els.resumeBtn.addEventListener("click", () => {
      playClick();
      closePauseToResume();
    });
  }

  els.restartBtn = document.getElementById("restart-btn");
  if (els.restartBtn) {
    els.restartBtn.addEventListener("click", () => {
      playClick();
      handleRestart();
    });
  }

  els.homeBtn = document.getElementById("home-btn");
  if (els.homeBtn) {
    els.homeBtn.addEventListener("click", () => {
      playClick();
      handleHome();
    });
  }

  // End screen + certificate wiring (task 9.7).
  els.replayBtn = document.getElementById("replay-btn");
  if (els.replayBtn) {
    els.replayBtn.addEventListener("click", () => {
      playClick();
      handleReplay();
    });
  }

  els.nextPackBtn = document.getElementById("next-pack-btn");
  if (els.nextPackBtn) {
    els.nextPackBtn.addEventListener("click", () => {
      playClick();
      handleNextPack();
    });
  }

  els.certificateBtn = document.getElementById("certificate-btn");
  if (els.certificateBtn) {
    els.certificateBtn.addEventListener("click", () => {
      playClick();
      handleCertificateOpen();
    });
  }

  els.certificatePrintBtn = document.getElementById("certificate-print-btn");
  if (els.certificatePrintBtn) {
    els.certificatePrintBtn.addEventListener("click", () => {
      playClick();
      handleCertificatePrint();
    });
  }

  els.certificateCloseBtn = document.getElementById("certificate-close-btn");
  if (els.certificateCloseBtn) {
    els.certificateCloseBtn.addEventListener("click", () => {
      playClick();
      handleCertificateClose();
    });
  }

  // Set the initial visible state of both mute controls to match
  // audio.js's actual (unmuted-by-default) state, rather than relying
  // on index.html's static markup to happen to agree with it.
  syncMuteControls();
}
