// tests/vendor/assert.js
//
// Tiny, dependency-free assertion + test registration runner, vendored for
// the in-browser test harness (tests/index.html). No install, no framework.
//
// Usage in a *.test.js file:
//
//   import { test } from "./vendor/assert.js";
//   import { ok, equal, deepEqual, throws } from "./vendor/assert.js";
//
//   test("1 + 1 is 2", () => {
//     equal(1 + 1, 2);
//   });
//
// Then tests/index.html imports the test files (which calls `test()` to
// register them) and calls `runAll()` to execute everything and render a
// report.

/** @type {Array<{ name: string, fn: () => void | Promise<void> }>} */
const registry = [];

/** Register a test by name. `fn` may be sync or async. */
export function test(name, fn) {
  registry.push({ name, fn });
}

/** Clear all registered tests (mainly useful for re-running in dev). */
export function resetRegistry() {
  registry.length = 0;
}

// ---------------------------------------------------------------------------
// Assertions — each throws an Error with a readable message on failure.
// ---------------------------------------------------------------------------

export function ok(value, message) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${describe(value)}`);
  }
}

export function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected ${describe(actual)} to equal ${describe(expected)} (===)`
    );
  }
}

export function notEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(
      message || `Expected ${describe(actual)} to not equal ${describe(expected)}`
    );
  }
}

export function deepEqual(actual, expected, message) {
  if (!isDeepEqual(actual, expected)) {
    throw new Error(
      message ||
        `Expected ${describe(actual)} to deep-equal ${describe(expected)}`
    );
  }
}

/**
 * Asserts that `fn` throws. Returns the caught error so callers can inspect
 * it further if needed.
 */
export function throws(fn, message) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error(message || "Expected function to throw, but it did not");
}

function isDeepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => isDeepEqual(item, b[i]));
  }

  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set)) return false;
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }

  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map)) return false;
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !isDeepEqual(v, b.get(k))) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => isDeepEqual(a[k], b[k]));
}

function describe(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run every registered test, catching failures individually so one failing
 * test never stops the rest from running.
 *
 * @returns {Promise<{
 *   results: Array<{ name: string, pass: boolean, error?: string }>,
 *   passed: number,
 *   failed: number,
 *   total: number
 * }>}
 */
export async function runAll() {
  const results = [];

  for (const { name, fn } of registry) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (e) {
      results.push({ name, pass: false, error: e && e.message ? e.message : String(e) });
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  return { results, passed, failed, total: results.length };
}
