// js/tutorial.js
// Pure, DOM-free module: the four coach-mark steps shown on the first
// case of every run, plus the callout-positioning math used to place
// each step's arrow/callout next to the real case-screen element it
// describes. No DOM access happens here; element lookups,
// measurements, and style writes all live in js/ui.js, the only
// module that touches the document. This split mirrors spot.js and
// cases.js, which are also pure logic modules ui.js reads from.

/**
 * The four coach-mark steps shown on the first case of every run.
 * `targetId` names the real case-screen element (see index.html) each
 * step's highlight and arrow point at. Every `body` string is written
 * at roughly a 6th-grade reading level: short sentences, plain words,
 * no shaming language, matching the rest of the game's copy.
 * @type {Array<{ targetId: string, heading: string, body: string }>}
 */
export const TUTORIAL_STEPS = [
  {
    targetId: "bot-card",
    heading: "Read",
    body: "Read the question and the Confident Bot's answer.",
  },
  {
    targetId: "case-answer",
    heading: "Mark it",
    body: "Tap any sentence that seems fishy. It gets marked so you can check it later.",
  },
  {
    targetId: "spot-panel",
    heading: "Investigate",
    body: "Open a tool to investigate. Find something useful? Add it to your evidence.",
  },
  {
    targetId: "candidate-list",
    heading: "Accuse",
    body: "Pick the one made-up detail. That is your accusation.",
  },
];

/**
 * Clamp a number between a minimum and maximum.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute where to place the tutorial callout relative to a target
 * element's bounding rect, and where its arrow should point from.
 * Pure function: the same inputs always produce the same output, so
 * this can be unit-tested with plain rect objects, no real DOM.
 *
 * Prefers placing the callout directly below the target (arrow
 * pointing up at it). Falls back to placing it above (arrow pointing
 * down) if there is not enough room below. Falls back to a centered
 * placement with no arrow if neither direction has room.
 *
 * @param {{top:number,left:number,width:number,height:number}} targetRect
 * @param {{width:number,height:number}} calloutSize
 * @param {{width:number,height:number}} viewport
 * @param {number} [margin] - gap, in px, between the target and the callout
 * @returns {{top:number, left:number, placement:("below"|"above"|"center"), arrowOffset:number}}
 */
export function computeCalloutPosition(targetRect, calloutSize, viewport, margin = 16) {
  const spaceBelow = viewport.height - (targetRect.top + targetRect.height);
  const spaceAbove = targetRect.top;

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const idealLeft = targetCenterX - calloutSize.width / 2;
  const maxLeft = Math.max(margin, viewport.width - calloutSize.width - margin);
  const left = clamp(idealLeft, margin, maxLeft);

  // Distance from the callout's own left edge to where the arrow
  // should sit, so it still points roughly at the target's center even
  // after `left` was clamped to keep the callout fully on-screen.
  const arrowOffset = clamp(targetCenterX - left, 20, Math.max(20, calloutSize.width - 20));

  if (spaceBelow >= calloutSize.height + margin) {
    return {
      top: targetRect.top + targetRect.height + margin,
      left,
      placement: "below",
      arrowOffset,
    };
  }

  if (spaceAbove >= calloutSize.height + margin) {
    return {
      top: targetRect.top - calloutSize.height - margin,
      left,
      placement: "above",
      arrowOffset,
    };
  }

  // Neither direction has room: center the callout in the viewport and
  // skip the arrow rather than pointing it at an overlapping box.
  return {
    top: clamp(
      viewport.height / 2 - calloutSize.height / 2,
      margin,
      Math.max(margin, viewport.height - calloutSize.height - margin)
    ),
    left: clamp(viewport.width / 2 - calloutSize.width / 2, margin, maxLeft),
    placement: "center",
    arrowOffset,
  };
}
