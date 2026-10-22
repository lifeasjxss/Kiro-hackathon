# Implementation Plan: AI Detective

## Overview

Build AI Detective as a plain static site: vanilla HTML, CSS, and native ES modules, with no build step, no bundler, and no backend. Hosting and deployment stay as they are.

The order follows the design: content and pure logic modules first (`shuffle`, `cases`, `spot`, `aggregate`, `badges`, `engine`), then the browser-facing shells (`storage`, `audio`, `a11y`, `ui`), then the teacher and source pages, then the cross-page privacy, content, and accessibility checks. The in-browser test harness is built in the first group so every later task can run tests immediately.

Property-based tests use the vendored single-file helper at `tests/vendor/pbt.js`. Each of the 19 correctness properties gets exactly one property test, runs a minimum of 100 iterations, and carries the tag comment `Feature: ai-detective, Property N: {property text}`. Shrinking comes from the vendored helper and is never hand-rolled.

## Tasks

- [x] 1. Set up project structure and the in-browser test harness
  - [x] 1.1 Create the folder structure and empty ES module stubs
    - Create `js/` with stub files that export the signatures from the design: `main.js`, `ui.js`, `engine.js`, `cases.js`, `shuffle.js`, `spot.js`, `badges.js`, `aggregate.js`, `storage.js`, `audio.js`, `a11y.js`, `teacher.js`, `sources.js`
    - Create empty `data/`, `docs/`, `tests/`, `tests/vendor/`, and `assets/audio/` folders
    - Add no package manager files, no bundler config, and no build script
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Vendor the property-testing helper and build `tests/index.html`
    - Commit a single-file generator-and-shrink property-testing helper to `tests/vendor/pbt.js`; do not hand-roll shrinking
    - Write a tiny assertion runner and a `tests/index.html` page that imports the pure modules as ES modules and prints pass/fail per test
    - Default every property run to a minimum of 100 iterations and support a seeded RNG for reproducibility
    - Add no install step and ship nothing from `tests/` to the game pages
    - _Requirements: 1.1, 1.2_

- [x] 2. Author case content and the source records
  - [x] 2.1 Draft the MVP case pack in `data/cases.json`
    - Write 12-15 cases using the Case schema: `id`, `topic`, `question`, `answer`, `mistake.phrase`, `mistake.type`, `mistake.why`, `decoys`, `spot`, `needsReview`, optional `sourceId`
    - Give every case exactly one planted mistake plus a `decoys` array of 2-3 TRUE phrase strings (not objects) that are exact substrings of the same answer
    - Use only the four allowed mistake types: `invented authority`, `extreme numbers`, `no specifics`, `overconfident tone`
    - Add a `needsReview` boolean to every case, set to `true` for any case containing a fact the author is uncertain about and `false` otherwise
    - Trace every real fact cited in a case to an actual entry in `docs/source-log.md` and `data/sources.json` via `sourceId`; never invent a source
    - Write each `mistake.why` as one neutral sentence and each `spot` block as four tips plus one neutral `searchPhrase`
    - Keep topics low-stakes and kid-friendly, keep sentences to 15 words or fewer, and give each answer at least one confident-tone phrase with no insults
    - _Requirements: 1.4, 1.8, 2.1, 2.2, 3.2, 4.2, 12.1, 12.2, 12.3_

  - [x] 2.2 Create `docs/source-log.md` and mirror it in `data/sources.json`
    - Log every real fact used in a case with source name, link, and date accessed, and label company sources
    - Mirror each entry in `data/sources.json` with `id`, `name`, `url`, `dateAccessed`, `companySource`, matching the `sourceId` values used in `data/cases.json`
    - Credit Common Sense Education for the lateral-reading adaptation and Google (Interland) for the game-format inspiration
    - _Requirements: 11.1, 11.2, 11.3_
- [x] 3. Checkpoint - human review of case content
  - A human reviews every case in `data/cases.json` for factual accuracy, exactly one planted mistake, truthful decoy phrases, tone, and reading level, and reviews every citation in `docs/source-log.md` and `data/sources.json`. Any case with `needsReview: true` requires the reviewer's explicit confirmation (not just general review) that the uncertain fact is accurate and properly sourced before it can be cleared. Fix anything flagged before moving on. Ask the user if questions arise.

- [x] 4. Implement the pure case core: shuffle, load, validate, select
  - [x] 4.1 Implement `js/shuffle.js`
    - Write `shuffle(items, rng = Math.random)` as Fisher-Yates with an injected RNG so tests are reproducible
    - Keep the module DOM-free
    - _Requirements: 2.2_

  - [x] 4.2 Implement `js/cases.js`
    - Write `loadCases(url, timeoutMs = 10000)` that fetches `data/cases.json` and rejects on timeout or parse error
    - Write `validateCases(raw)` that keeps only cases with every required field and a `decoys` length of 2 or 3
    - Write `selectCases(valid, n = 10, exclude = [])` returning `min(n, valid.length)` cases and `[]` only when no valid cases exist
    - Write a pure `buildCandidates(aCase, rng)` that returns the shuffled candidate list of `mistake.phrase` plus every phrase in `decoys`, each tagged with an opaque token and an internal is-mistake flag
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.2, 8.6_

  - [ ]* 4.3 Write property test for case selection count
    - **Property 1: Selection count equals the available minimum**
    - **Validates: Requirements 1.4, 1.5, 1.6**

  - [ ]* 4.4 Write property test for case validation
    - **Property 2: Validation keeps only complete cases**
    - **Validates: Requirements 1.8**

  - [ ]* 4.5 Write property test for candidate structure
    - **Property 3: Candidate structure is 3-4 with exactly one mistake**
    - **Validates: Requirements 2.2**

  - [ ]* 4.6 Write property test for next-pack exclusion
    - **Property 14: Next case pack excludes played cases**
    - **Validates: Requirements 8.6**

  - [ ]* 4.7 Write unit tests for the load flow
    - Cover slow fetch past the 10 second budget, network failure, invalid JSON, zero valid cases, and preservation of previously loaded cases
    - Inject a fake fetch so no network is needed
    - _Requirements: 1.3, 1.6, 1.7_

- [x] 5. Implement the pure SPOT, aggregate, and badge modules
  - [x] 5.1 Implement `js/spot.js`
    - Export `SPOT_TOOLS` as the four tool keys and `toolContent(aCase, tool)` returning the tip plus the case's neutral search phrase
    - Keep each tip to 160 characters or fewer and return a clear unavailable result when case content is missing
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ]* 5.2 Write property test for SPOT content
    - **Property 10: SPOT content is present and within length**
    - **Validates: Requirements 4.2**

  - [x] 5.3 Implement `js/aggregate.js`
    - Export `emptyAggregate()`, `recordMiss(agg, mistakeType)`, and `recordSpotUse(agg, tool)` as pure functions returning new objects
    - Allow only `version`, `missesByType` with the four fixed mistake types, and `spotUsage` with the four fixed tools, all non-negative integers
    - Add no field that could hold an id, name, timestamp, or free text
    - _Requirements: 4.4, 9.3, 9.5, 10.1, 10.2, 10.5_

  - [ ]* 5.4 Write property test for the aggregate store shape
    - **Property 12: Aggregate store holds only anonymous counts**
    - **Validates: Requirements 9.3, 9.5, 10.5**

  - [x] 5.5 Implement `js/badges.js`
    - Export `earnedBadges(state)` returning one badge per distinct mistake type solved at least once, with a one-line skill label of 60 characters or fewer
    - _Requirements: 8.3_

  - [ ]* 5.6 Write property test for badges
    - **Property 13: Badges match the set of solved mistake types**
    - **Validates: Requirements 8.3**

- [x] 6. Implement the pure engine: state machine and scoring
  - [x] 6.1 Implement the run state and core transitions in `js/engine.js`
    - Write `createRun(cases)`, `selectPhrase(state, phraseId)` returning `{ nextState, result }`, `advance(state)`, and `isComplete(state)`
    - Track `index`, `perCase` wrong attempts and solved flags, and `solvedTypes`; keep the module DOM-free
    - On a wrong pick, increment wrong attempts, record the miss in the aggregate, and leave the case index and solved flag unchanged
    - _Requirements: 2.6, 2.8, 2.9, 3.1, 3.4, 3.5, 3.6, 10.1_

  - [x] 6.2 Implement scoring and the clue cost in `js/engine.js`
    - Award `max(100 - wrongAttempts * 25, 1)` points on a correct pick
    - Write `useClue(state)` that charges 5 points on the first clue per case, charges nothing on repeat clues, and reveals only the mistake type
    - Route every score write through `clampScore(n) = max(0, n)` so the score is never negative
    - _Requirements: 2.7, 3.3, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.3 Implement SPOT recording and pause snapshot/restore in `js/engine.js`
    - Record each SPOT activation through `recordSpotUse` without changing the case index or solved flag, and allow unlimited activations
    - Add a snapshot/restore pair that captures and restores the full run state, including current case and score
    - _Requirements: 4.3, 4.4, 4.6, 6.7_

  - [ ]* 6.4 Write property test for the question counter
    - **Property 5: Question counter matches progress**
    - **Validates: Requirements 2.6**

  - [ ]* 6.5 Write property test for pick outcomes
    - **Property 6: Correct pick solves, wrong pick retains the case**
    - **Validates: Requirements 2.8, 2.9, 3.5, 3.6**

  - [ ]* 6.6 Write property test for awarded points
    - **Property 7: Award points are bounded and non-increasing in wrong attempts**
    - **Validates: Requirements 3.3**

  - [ ]* 6.7 Write property test for score non-negativity
    - **Property 8: Score is always a non-negative integer**
    - **Validates: Requirements 2.7, 5.5**

  - [ ]* 6.8 Write property test for the clue charge
    - **Property 9: Clue is charged at most once per case**
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ]* 6.9 Write property test for SPOT activations
    - **Property 11: SPOT use never advances and counts exactly once**
    - **Validates: Requirements 4.3, 4.4, 4.6**

  - [ ]* 6.10 Write property test for pause round-trip
    - **Property 15: Resume restores the run exactly (round trip)**
    - **Validates: Requirements 6.7**

  - [ ] 6.11 Write unit tests for engine edge cases
    - Cover the first and last case of a run, `isComplete` after the final solve, a clue taken when the score is below 5, and a correct pick after four or more wrong attempts
    - _Requirements: 3.3, 5.5, 8.1_

- [x] 7. Checkpoint - run the harness
  - Open `tests/index.html` and ensure all unit and property tests for the pure core pass. Ask the user if questions arise.

- [x] 8. Implement the browser shells: storage, audio, accessibility, styles
  - [x] 8.1 Implement `js/storage.js`
    - Make this the only module touching `localStorage`, using key `aiDetective.aggregate.v1`
    - Serialize and deserialize the aggregate, ignore unknown keys, and catch unavailable or quota errors so the game falls back to an in-memory aggregate without blocking play
    - Write nothing but the anonymous aggregate; never write a name or any personal field
    - _Requirements: 8.9, 9.5, 9.6, 10.5_

  - [x] 8.2 Implement `js/audio.js`
    - Own a single `Audio` element for the background music in `assets/audio/`, start playback only after the Start screen Play press, and expose mute and unmute that restore the prior state
    - _Requirements: 6.2, 6.3, 6.10_

  - [ ]* 8.3 Write property test for mute round-trip
    - **Property 16: Mute then unmute restores audio state (round trip)**
    - **Validates: Requirements 6.10**

  - [x] 8.4 Implement `js/a11y.js`
    - Add focus-move helpers, a reduced-motion check using `matchMedia("(prefers-reduced-motion: reduce)")`, and skip handling that stops an intro or animation within 200 milliseconds and shows its end state
    - Add a helper that moves focus to a message element when an error or feedback screen appears
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 13.7_

  - [x] 8.5 Rebuild `styles.css` for accessibility and layout
    - Define color tokens meeting 4.5:1 for body text and control labels and 3:1 for large text and control boundaries
    - Add paired non-color cues for right, wrong, selected, focused, disabled, and active states (text label plus shape or glyph)
    - Add a visible focus indicator that meets WCAG AA contrast, a responsive layout from 320 to 1920 pixels with no horizontal scrolling, the foggy-river stepping-stone styling, a reduced-motion media query, and print styles for the certificate
    - _Requirements: 3.8, 7.5, 8.8, 13.1, 13.2, 13.7, 13.8_

  - [ ]* 8.6 Write unit tests for storage and accessibility helpers
    - Cover a throwing `localStorage` falling back to memory, reading an unknown stored key, mocked `prefers-reduced-motion` showing end states, and skip completing within budget
    - _Requirements: 7.2, 7.3, 10.5, 13.7_

- [x] 9. Build the game page and UI
  - [x] 9.1 Rebuild `index.html` as the game page shell
    - Add the Start, Loading, Error, Intro, Case, Unmask, Pause, End, and print-certificate sections, loaded with a single `<script type="module" src="js/main.js">`
    - Include the always-visible mute control, pause control, skip control, question counter, and score region, each keyboard-focusable with a screen reader label
    - Include no sign-in control, no free-text input, and no third-party script
    - _Requirements: 1.1, 1.2, 2.3, 2.6, 2.7, 6.1, 6.4, 6.5, 9.1, 9.2, 9.4, 13.6_

  - [x] 9.2 Implement the Start, Loading, and Error screens in `js/ui.js`
    - Render the Start screen with the Play button before any audio, then the Loading screen, then the load-failure and no-cases-available screens, each with a heading, a plain-language message, a Retry control, and focus moved to the message
    - Export the UI copy strings as module constants so content tests can import them
    - Insert all case and message text with `textContent`, never `innerHTML`
    - _Requirements: 1.6, 1.7, 6.1, 6.2, 6.3, 12.1, 12.2, 12.4_

  - [x] 9.3 Implement the case screen and candidate controls in `js/ui.js`
    - Render the question, the Confident Bot answer, the stepping-stone river progress, the question counter from 1 to 10, and the score
    - Render each candidate as a native `<button>` carrying only the phrase text, an `aria-label`, and a random `data-token`; keep the token-to-mistake mapping in a module-scoped closure so nothing in the DOM reveals the answer
    - Accept click, Enter, and Space only; add no free-text control
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.10, 9.2, 13.3_

  - [x] 9.4 Implement answer feedback and the unmask in `js/ui.js`
    - On a correct pick, mark the button with a check glyph plus color, unmask the Confident Bot, show the mistake type and the one-sentence why, and advance to the next stone within 3 seconds of the reveal
    - On a wrong pick, show a 1 to 3 second fail moment, mark the button with an X glyph plus color, show a neutral one-line reason of at most 120 characters, keep the case and its candidates active, and show a retry control that re-enables selection
    - Give right and wrong outcomes distinct text labels and distinct glyphs so they are distinguishable without color
    - _Requirements: 2.8, 2.9, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 12.5, 13.2_

  - [x] 9.5 Implement the SPOT toolkit panel and the clue button in `js/ui.js`
    - Render the four SPOT tools as keyboard-operable controls with visible text labels and screen reader labels, showing the tip and neutral search phrase on activation without submitting or advancing the case, unlimited times
    - Show a tip-unavailable message that keeps the case active when tool content is missing
    - Render the Need a clue? control while the case is unanswered, revealing only the mistake type and keeping the correct candidate concealed, charging 5 points on the first use per case and nothing after
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 9.6 Implement the pause menu and mute wiring in `js/ui.js`
    - Open the pause menu from a keyboard-accessible control, halt progression, and offer mute, resume, restart, and home
    - Restore the case and score exactly on resume, ask for confirmation before restart discards the run, and return to the Start screen on home
    - Wire the always-visible mute control to `audio.js` so mute silences all audio and unmute restores the prior state
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [x] 9.7 Implement the end screen and certificate in `js/ui.js`
    - Show the end screen within 1 second of the final case, with the final score and one badge per solved mistake type
    - Render exactly three controls (Replay, Next case pack, Download certificate), each keyboard-focusable with a screen reader label
    - Make Replay reuse the same pack, make Next case pack select only unplayed cases and reset to the first pack when none remain, and make Download certificate open the print-styled certificate with a blank handwritten name line and no pre-filled or stored name
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 9.8 Wire everything together in `js/main.js`
    - Boot the UI, load and validate cases, create the run, connect the engine to the UI, aggregate, storage, audio, and accessibility modules, and run the full Start to End flow with no timer by default
    - _Requirements: 1.1, 1.3, 2.3, 9.6, 13.3, 13.5, 13.6_

- [x] 10. Build the teacher page and source dashboard
  - [x] 10.1 Implement `teacher.html` and `js/teacher.js`
    - Show totals of missed answers per mistake type and totals of SPOT tool use, in plain language with no names and no individual results
    - State that the baseline store reflects plays on this one device and browser, and show an empty-state message when no plays are recorded
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 9.5_

  - [x] 10.2 Implement `sources.html` and `js/sources.js`
    - Render each source's name, link, and date accessed from `data/sources.json`, with a sources-unavailable message on fetch failure and an empty-state message for an empty list
    - Label company sources and keep the page keyboard-operable with labeled controls
    - _Requirements: 11.1, 11.4, 11.5, 13.3, 13.5_

- [ ] 11. Add the cross-page privacy, content, and UI test suite
  - [ ]* 11.1 Write property test for the absence of free-text input
    - **Property 4: No free-text input on any screen**
    - **Validates: Requirements 2.5, 9.2**

  - [ ]* 11.2 Write property test for instruction and feedback copy
    - **Property 17: Feedback and instruction copy is neutral and plain**
    - **Validates: Requirements 3.7, 12.1, 12.2, 12.5**

  - [ ]* 11.3 Write property test for Confident Bot answers
    - **Property 18: Confident Bot answers are confident but never insulting**
    - **Validates: Requirements 12.3**

  - [ ]* 11.4 Write property test for explanation length
    - **Property 19: Explanation screens stay within the word budget**
    - **Validates: Requirements 12.4**

  - [ ]* 11.5 Write unit tests for the game UI
    - Cover candidate activation by click, Enter, and Space; no correct-answer id in any DOM attribute; unmask showing type and why; right and wrong rendering a label plus glyph; no audio playback before the Play press; the pause menu control set and restart confirmation; the end screen control count; and the certificate having an empty name line with no name written to storage
    - _Requirements: 2.4, 3.1, 3.2, 3.8, 6.3, 6.6, 6.8, 8.4, 8.8, 8.9_

  - [ ]* 11.6 Write unit tests for the teacher and source pages
    - Cover known aggregate totals rendering, the empty-state for an empty aggregate, the single-device disclosure, a known `sources.json` rendering, the unavailable message on fetch failure, and the empty-state for an empty list
    - _Requirements: 10.1, 10.2, 10.6, 10.7, 11.1, 11.4, 11.5_

- [x] 12. Retire the old script and audit for third-party code
  - [x] 12.1 Remove `script.js` and confirm the pages stay self-contained
    - Delete `script.js` and remove any reference to it, leaving `js/` modules as the only scripts
    - Confirm `index.html`, `teacher.html`, and `sources.html` load only same-origin files and contain no analytics, advertising, tracking, or sign-in code
    - _Requirements: 1.1, 1.2, 9.1, 9.4_

- [ ] 13. Optional manual verification passes
  - [ ]* 13.1 Audit color contrast with tooling
    - Check all body text, control labels, large text, control boundaries, and focus indicators against WCAG AA ratios and record the results
    - _Requirements: 13.1, 7.5_

  - [ ]* 13.2 Run a screen reader pass
    - Confirm every control announces a useful label, right and wrong outcomes are announced, and error messages receive focus
    - _Requirements: 2.10, 4.1, 13.2, 13.3_

  - [ ]* 13.3 Play a full keyboard-only run
    - Complete a 10 case run without a pointing device, confirming reachable controls, visible focus, and reading-order focus movement
    - _Requirements: 7.4, 7.5, 7.6, 13.5_

  - [ ] 13.4 Run the privacy network check
    - Load each page with the network panel open and confirm requests go only to same-origin files with zero third-party analytics, advertising, or tracking domains
    - _Requirements: 9.4, 9.6_

  - [ ]* 13.5 Check Chromebook and phone viewports
    - Review the layout from 320 to 1920 pixels for no horizontal scrolling and no loss of content or function, and confirm the game runs with no install and no sign-in
    - _Requirements: 13.6, 13.8_

- [x] 14. Final checkpoint
  - Open `tests/index.html` and ensure all unit and property tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. All manual-only verification is in task 13 and is optional.
- Every property test uses the vendored helper in `tests/vendor/pbt.js`, runs at least 100 iterations, and is tagged `Feature: ai-detective, Property N: {property text}`. One test per property, no hand-rolled shrinking.
- Pure modules (`cases`, `shuffle`, `spot`, `badges`, `aggregate`, `engine`) stay DOM-free so tests need no browser APIs; network, audio, and storage are injected as fakes.
- No task adds a build step, a bundler, a package manager, or a backend. Deployment stays unchanged.
- Case content is authored and human-reviewed before any logic depends on it (tasks 2 and 3).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "5.1", "5.3", "5.5", "8.1", "8.2", "8.4", "8.5"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "5.2", "5.4", "5.6", "8.3", "8.6", "6.1", "9.1"] },
    { "id": 4, "tasks": ["6.2", "9.2"] },
    { "id": 5, "tasks": ["6.3", "9.3"] },
    { "id": 6, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "9.4"] },
    { "id": 7, "tasks": ["9.5"] },
    { "id": 8, "tasks": ["9.6"] },
    { "id": 9, "tasks": ["9.7"] },
    { "id": 10, "tasks": ["9.8", "10.1", "10.2"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"] }
  ]
}
```
