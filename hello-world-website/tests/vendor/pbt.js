// tests/vendor/pbt.js
//
// Vendored, single-file, dependency-free property-based testing helper.
// No npm install, no bundler — this is plain ES module JS committed to the
// repo. It is used only by the in-browser test harness (tests/index.html);
// nothing in here is imported by the game pages.
//
// What it provides:
//   - A small set of built-in generators (Arbitrary): integer, number,
//     string, array, object, oneOf, constant, boolean
//   - Composition helpers on Arbitrary: .map(), .chain(), .filter()
//   - custom(generateFn, shrinkFn) for fully custom generators
//   - forAll(name, arbitrary, predicate, options) — runs the predicate
//     against generated values for a configurable number of iterations
//     (default 100), and on failure, shrinks the counterexample toward a
//     minimal failing case using a real (if simple) generic shrink loop.
//   - A seeded PRNG (mulberry32) so runs are reproducible via { seed }.
//
// Shrinking design: every generated value is wrapped in a `Shrinkable`,
// which pairs the value with a `shrink()` method returning a list of
// "smaller" Shrinkables of the same shape. This is the one, generic
// shrinking mechanism in the library — built-in generators implement it
// once here, and `.map()`/`.filter()` preserve it, so no test ever has to
// hand-roll its own ad hoc shrinking.

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

/**
 * mulberry32 — small, fast, seeded PRNG. Returns a function () => number
 * producing values in [0, 1), deterministic for a given seed.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Shrinkable + Arbitrary
// ---------------------------------------------------------------------------

/** Pairs a generated value with a way to produce smaller candidate values. */
export class Shrinkable {
  /**
   * @param {*} value
   * @param {() => Shrinkable[]} [shrinkFn]
   */
  constructor(value, shrinkFn) {
    this.value = value;
    this._shrinkFn = shrinkFn || (() => []);
  }

  /** @returns {Shrinkable[]} smaller candidates, same shape as this.value */
  shrink() {
    return this._shrinkFn();
  }
}

function mapShrinkable(shrinkable, fn) {
  return new Shrinkable(fn(shrinkable.value), () =>
    shrinkable.shrink().map((s) => mapShrinkable(s, fn))
  );
}

function filterShrinkable(shrinkable, predicate) {
  return new Shrinkable(shrinkable.value, () =>
    shrinkable
      .shrink()
      .filter((s) => predicate(s.value))
      .map((s) => filterShrinkable(s, predicate))
  );
}

/** A generator: knows how to produce a Shrinkable from a random source. */
export class Arbitrary {
  /** @param {(rng: () => number) => Shrinkable} generateFn */
  constructor(generateFn) {
    this._generate = generateFn;
  }

  /** @param {() => number} rng */
  generate(rng) {
    return this._generate(rng);
  }

  /** Transform generated values, preserving shrink structure. */
  map(fn) {
    const self = this;
    return new Arbitrary((rng) => mapShrinkable(self.generate(rng), fn));
  }

  /** Build a dependent generator from this one's value (basic support; the
   * resulting generator's shrink is driven by the dependent arbitrary). */
  chain(fn) {
    const self = this;
    return new Arbitrary((rng) => {
      const shrinkable = self.generate(rng);
      return fn(shrinkable.value).generate(rng);
    });
  }

  /** Keep only generated values matching predicate, preserving shrink. */
  filter(predicate, maxTries = 1000) {
    const self = this;
    return new Arbitrary((rng) => {
      for (let i = 0; i < maxTries; i++) {
        const shrinkable = self.generate(rng);
        if (predicate(shrinkable.value)) {
          return filterShrinkable(shrinkable, predicate);
        }
      }
      throw new Error(
        `Arbitrary.filter: no value satisfied the predicate after ${maxTries} tries`
      );
    });
  }
}

/**
 * Build a fully custom Arbitrary from a value generator and an optional
 * shrink function operating on plain values (not Shrinkables).
 * @param {(rng: () => number) => *} generateValueFn
 * @param {(value: *) => Array<*>} [shrinkValueFn]
 */
export function custom(generateValueFn, shrinkValueFn = () => []) {
  function build(value) {
    return new Shrinkable(value, () => shrinkValueFn(value).map(build));
  }
  return new Arbitrary((rng) => build(generateValueFn(rng)));
}

// ---------------------------------------------------------------------------
// Built-in generators
// ---------------------------------------------------------------------------

/** Always generates the same value; no shrink candidates. */
export function constant(value) {
  return new Arbitrary(() => new Shrinkable(value, () => []));
}

/** Random boolean; shrinks true -> false. */
export function boolean() {
  function build(value) {
    return new Shrinkable(value, () => (value === true ? [build(false)] : []));
  }
  return new Arbitrary((rng) => build(rng() < 0.5));
}

/**
 * Random integer in [min, max] inclusive. Shrinks toward 0 when 0 is in
 * range, otherwise toward whichever bound is closest to 0. Always includes
 * a unit step toward the target so the shrinker can walk to an exact
 * boundary one step at a time, not just converge asymptotically.
 */
export function integer(min = -100, max = 100) {
  if (min > max) throw new Error("integer: min must be <= max");
  const target = min <= 0 && max >= 0 ? 0 : min > 0 ? min : max;

  function build(value) {
    return new Shrinkable(value, () => {
      if (value === target) return [];
      const diff = value - target;
      const towardTarget = diff > 0 ? -1 : 1;
      const candidates = new Set();
      candidates.add(target);
      candidates.add(value + towardTarget);
      let d = diff;
      while (Math.abs(d) > 1) {
        d = Math.trunc(d / 2);
        candidates.add(value - d);
      }
      return [...candidates]
        .filter((c) => c !== value && c >= min && c <= max)
        .map(build);
    });
  }

  return new Arbitrary((rng) => {
    const value = min + Math.floor(rng() * (max - min + 1));
    return build(value);
  });
}

/** Random float in [min, max). Shrinks toward 0 (or the nearest bound). */
export function number(min = -100, max = 100) {
  if (min > max) throw new Error("number: min must be <= max");
  const target = min <= 0 && max >= 0 ? 0 : min > 0 ? min : max;

  function build(value) {
    return new Shrinkable(value, () => {
      if (value === target) return [];
      const diff = value - target;
      const candidates = [target, value - diff / 2];
      return candidates
        .filter((c) => c !== value && c >= min && c <= max)
        .map(build);
    });
  }

  return new Arbitrary((rng) => build(min + rng() * (max - min)));
}

const DEFAULT_CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

/**
 * Random string. Options: { minLength = 0, maxLength = 20, charset }.
 * Shrinks by shortening (half, drop-last, drop-first, empty).
 */
export function string(options = {}) {
  const { minLength = 0, maxLength = 20, charset = DEFAULT_CHARSET } = options;
  if (minLength > maxLength) throw new Error("string: minLength must be <= maxLength");

  function build(value) {
    return new Shrinkable(value, () => {
      if (value.length <= minLength) return [];
      const candidates = new Set();
      const half = value.slice(0, Math.floor(value.length / 2));
      if (half.length >= minLength) candidates.add(half);
      const dropLast = value.slice(0, value.length - 1);
      if (dropLast.length >= minLength) candidates.add(dropLast);
      const dropFirst = value.slice(1);
      if (dropFirst.length >= minLength) candidates.add(dropFirst);
      if (minLength === 0) candidates.add("");
      return [...candidates].filter((c) => c !== value).map(build);
    });
  }

  return new Arbitrary((rng) => {
    const len = minLength + Math.floor(rng() * (maxLength - minLength + 1));
    let out = "";
    for (let i = 0; i < len; i++) {
      out += charset[Math.floor(rng() * charset.length)];
    }
    return build(out);
  });
}

/**
 * Random array of values from elementArb. Options:
 * { minLength = 0, maxLength = 10 }. Shrinks by removing elements (half,
 * drop-last, drop-first) and by shrinking individual elements in place.
 */
export function array(elementArb, options = {}) {
  const { minLength = 0, maxLength = 10 } = options;
  if (minLength > maxLength) throw new Error("array: minLength must be <= maxLength");

  function build(shrinkables) {
    const value = shrinkables.map((s) => s.value);
    return new Shrinkable(value, () => {
      const candidates = [];

      if (shrinkables.length > minLength) {
        const half = Math.floor(shrinkables.length / 2);
        if (half >= minLength) candidates.push(build(shrinkables.slice(0, half)));
        if (shrinkables.length - 1 >= minLength) {
          candidates.push(build(shrinkables.slice(0, shrinkables.length - 1)));
          candidates.push(build(shrinkables.slice(1)));
        }
      }

      shrinkables.forEach((s, i) => {
        const subShrinks = s.shrink();
        if (subShrinks.length > 0) {
          const copy = shrinkables.slice();
          copy[i] = subShrinks[0];
          candidates.push(build(copy));
        }
      });

      return candidates;
    });
  }

  return new Arbitrary((rng) => {
    const len = minLength + Math.floor(rng() * (maxLength - minLength + 1));
    const shrinkables = [];
    for (let i = 0; i < len; i++) shrinkables.push(elementArb.generate(rng));
    return build(shrinkables);
  });
}

/**
 * Random object with a fixed shape: { key: Arbitrary, ... }. Shrinks by
 * shrinking one field at a time, keeping the others fixed.
 */
export function object(shape) {
  const keys = Object.keys(shape);

  function build(shrinkableMap) {
    const value = {};
    for (const k of keys) value[k] = shrinkableMap[k].value;
    return new Shrinkable(value, () => {
      const candidates = [];
      for (const k of keys) {
        const subShrinks = shrinkableMap[k].shrink();
        for (const sub of subShrinks.slice(0, 3)) {
          candidates.push(build({ ...shrinkableMap, [k]: sub }));
        }
      }
      return candidates;
    });
  }

  return new Arbitrary((rng) => {
    const shrinkableMap = {};
    for (const k of keys) shrinkableMap[k] = shape[k].generate(rng);
    return build(shrinkableMap);
  });
}

/** Picks one of several arbitraries at random; shrink comes from whichever
 * arbitrary was chosen for a given run. */
export function oneOf(...arbitraries) {
  if (arbitraries.length === 0) {
    throw new Error("oneOf: at least one arbitrary is required");
  }
  return new Arbitrary((rng) => {
    const idx = Math.floor(rng() * arbitraries.length);
    return arbitraries[idx].generate(rng);
  });
}

// ---------------------------------------------------------------------------
// forAll — the property runner
// ---------------------------------------------------------------------------

function runPredicate(predicate, value) {
  try {
    return { pass: !!predicate(value), error: undefined };
  } catch (e) {
    return { pass: false, error: e && e.message ? e.message : String(e) };
  }
}

function shrinkToMinimal(shrinkable, predicate, maxSteps) {
  let current = shrinkable;
  let currentOutcome = runPredicate(predicate, current.value);
  let steps = 0;

  let improved = true;
  while (improved && steps < maxSteps) {
    improved = false;
    const candidates = current.shrink();
    for (const candidate of candidates) {
      steps++;
      const outcome = runPredicate(predicate, candidate.value);
      if (!outcome.pass) {
        current = candidate;
        currentOutcome = outcome;
        improved = true;
        break;
      }
      if (steps >= maxSteps) break;
    }
  }

  return { value: current.value, error: currentOutcome.error };
}

/**
 * Run `predicate` against values generated by `arbitrary` for a minimum of
 * `options.iterations` (default 100) runs. On the first failing value,
 * shrinks it toward a minimal counterexample.
 *
 * @param {string} name
 * @param {Arbitrary} arbitrary
 * @param {(value: *) => boolean} predicate
 * @param {{ iterations?: number, seed?: number, maxShrinkSteps?: number }} [options]
 * @returns {{ pass: boolean, name: string, iterations: number, seed: number,
 *             counterexample?: *, error?: string }}
 */
export function forAll(name, arbitrary, predicate, options = {}) {
  const iterations = options.iterations ?? 100;
  const seed = options.seed ?? randomSeed();
  const maxShrinkSteps = options.maxShrinkSteps ?? 2000;
  const rng = mulberry32(seed);

  for (let i = 0; i < iterations; i++) {
    const shrinkable = arbitrary.generate(rng);
    const outcome = runPredicate(predicate, shrinkable.value);
    if (!outcome.pass) {
      const shrunk = shrinkToMinimal(shrinkable, predicate, maxShrinkSteps);
      return {
        pass: false,
        name,
        iterations: i + 1,
        seed,
        counterexample: shrunk.value,
        error: shrunk.error,
      };
    }
  }

  return { pass: true, name, iterations, seed };
}

/** Alias for forAll, for callers who prefer `check(...)`. */
export { forAll as check };
