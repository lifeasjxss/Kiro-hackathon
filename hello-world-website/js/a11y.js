// js/a11y.js
// Browser-facing module: focus-move helpers, the reduced-motion check
// (matchMedia "(prefers-reduced-motion: reduce)"), and skip handling
// that stops an intro/animation within 200ms and shows its end state.
// See design.md "a11y.js" (Requirements 7, 13).

/**
 * Whether the user has requested reduced motion.
 * Reads the media query fresh on every call (no caching) since the
 * preference can change at runtime. Never throws: environments without
 * `window.matchMedia` (older browsers, non-browser test contexts) are
 * treated as "motion is fine" (returns false).
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

/**
 * Move keyboard focus to the given element (e.g. an error or feedback message).
 * Plain elements (a heading or message `<div>`) are not focusable by default,
 * so if `el` has no `tabindex` attribute already, one is added (`-1`) so it
 * can receive programmatic focus without joining the normal tab order.
 * Safe to call with a null/undefined element, or an element whose `focus`
 * method is missing or throws.
 * @param {HTMLElement} el
 * @returns {void}
 */
export function focusElement(el) {
  if (!el) {
    return;
  }
  try {
    if (!el.hasAttribute("tabindex")) {
      el.setAttribute("tabindex", "-1");
    }
    el.focus();
  } catch {
    // Swallow: focus() is not guaranteed to exist or succeed in every
    // environment, and failing to move focus should never break the app.
  }
}

/**
 * Run a skippable intro/animation. `onEnd` is called either naturally
 * after `durationMs`, or immediately (within ~200ms, per Requirement 7.2)
 * if `skip()` (the function returned by this call) is invoked first.
 * Calling the returned skip() function more than once is a safe no-op.
 *
 * If the user prefers reduced motion (Requirement 13.7), `onEnd` is called
 * immediately and synchronously, and the returned skip function is a no-op
 * since there is nothing left to skip.
 *
 * @param {() => void} onEnd - called once, when the intro reaches its end state
 * @param {{ durationMs?: number }} [options]
 * @returns {() => void} a skip function; call it to end the intro immediately
 */
export function runSkippable(onEnd, options = {}) {
  const durationMs = typeof options.durationMs === "number" ? options.durationMs : 2000;

  if (prefersReducedMotion()) {
    onEnd();
    return function skip() {};
  }

  let done = false;
  const timerId = setTimeout(function () {
    if (done) {
      return;
    }
    done = true;
    onEnd();
  }, durationMs);

  return function skip() {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timerId);
    onEnd();
  };
}
