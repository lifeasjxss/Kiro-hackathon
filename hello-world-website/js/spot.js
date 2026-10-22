// js/spot.js
// Pure, DOM-free module defining the SPOT toolkit's four tools and the
// tip/search-phrase content they show for a given case.
// See design.md "spot.js - toolkit logic" (Requirement 4).

/** The four SPOT tool keys, in routine order. */
export const SPOT_TOOLS = ["step_away", "pick_words", "open_sources", "test_decide"];

/**
 * Get the tip and neutral search phrase for a SPOT tool on a given case.
 *
 * Returns a discriminated result instead of throwing, so the UI can branch
 * cleanly on `available` (Requirement 4.5):
 *   - Content present:  { available: true,  tip: string, searchPhrase: string }
 *   - Content missing:  { available: false, tip: null,   searchPhrase: null }
 *
 * Content counts as "missing" when `tool` is not one of SPOT_TOOLS, `aCase`
 * is not an object, `aCase.spot` is not an object, `aCase.spot[tool]` is
 * empty, or `aCase.spot.searchPhrase` is empty.
 *
 * By data-authoring convention (checked separately, not enforced here),
 * every tip in `data/cases.json` is 160 characters or fewer.
 *
 * @param {object} aCase - the current case
 * @param {string} tool - one of SPOT_TOOLS
 * @returns {{ available: boolean, tip: (string|null), searchPhrase: (string|null) }}
 */
export function toolContent(aCase, tool) {
  const unavailable = { available: false, tip: null, searchPhrase: null };

  if (!SPOT_TOOLS.includes(tool)) {
    return unavailable;
  }
  if (!aCase || typeof aCase !== "object") {
    return unavailable;
  }

  const spot = aCase.spot;
  if (!spot || typeof spot !== "object") {
    return unavailable;
  }

  const tip = spot[tool];
  const searchPhrase = spot.searchPhrase;
  if (typeof tip !== "string" || tip.length === 0) {
    return unavailable;
  }
  if (typeof searchPhrase !== "string" || searchPhrase.length === 0) {
    return unavailable;
  }

  return { available: true, tip, searchPhrase };
}
