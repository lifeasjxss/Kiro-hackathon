// js/audio.js
// Browser-facing module: the ONLY module that touches the Web Audio
// API. Synthesizes three short sound effects with oscillators (a
// typewriter-style "ding" for correct, a soft low "thud" for wrong,
// and a quiet click for buttons) — no audio files, no external
// libraries. The AudioContext is created only after the kid's first
// tap (the Play button), per browser autoplay rules. A single master
// gain node lets mute silence every sound at once, and isMuted() lets
// the UI read the current state as the single source of truth.
// See design.md "audio.js" (Requirement 6).

/** @type {AudioContext | null} */
let ctx = null;

/** @type {GainNode | null} */
let masterGain = null;

/** Tracks whether audio is currently muted. */
let muted = false;

/**
 * Lazily create the shared AudioContext and master gain node. Safe to
 * call many times; only builds the graph once. Returns null (rather
 * than throwing) if the Web Audio API is unavailable in this browser.
 * @returns {AudioContext | null}
 */
function ensureContext() {
  if (ctx) return ctx;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    ctx = new AudioContextClass();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
  } catch (err) {
    console.warn("audio.js: could not create AudioContext", err);
    ctx = null;
    masterGain = null;
  }

  return ctx;
}

/**
 * Unlock and prepare the audio engine. Must only ever be called after
 * a user gesture (the Play button press), per browser autoplay policy.
 * Never call this anywhere else (Requirements 6.1, 6.2, 6.3). Safe to
 * call more than once.
 * @returns {void}
 */
export function initAudio() {
  const audioCtx = ensureContext();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => {
      console.warn("audio.js: resume() was rejected", err);
    });
  }
}

/**
 * Play one short tone: an oscillator through its own gain envelope
 * (quick attack, exponential decay) so it reads as a clean, short
 * blip rather than a hard click or a sudden stop. No-ops silently when
 * muted, when the AudioContext hasn't been created yet (initAudio()
 * not called yet, e.g. before the Play button), or if the Web Audio
 * API throws for any reason — sound effects are never allowed to break
 * gameplay.
 * @param {number} freq - starting frequency in Hz
 * @param {number} durationSec - tone length in seconds
 * @param {{ type?: OscillatorType, endFreq?: number, peakGain?: number, startOffsetSec?: number }} [options]
 * @returns {void}
 */
function playTone(freq, durationSec, options = {}) {
  if (muted || !ctx || !masterGain) return;

  try {
    const { type = "sine", endFreq = freq, peakGain = 0.2, startOffsetSec = 0 } = options;
    const startAt = ctx.currentTime + startOffsetSec;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), startAt + durationSec);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(startAt);
    osc.stop(startAt + durationSec + 0.05);
  } catch (err) {
    console.warn("audio.js: playTone() failed", err);
  }
}

/**
 * A bright, typewriter-style "ding" for a correct answer: two quick
 * ascending notes, scheduled on the Web Audio clock (not setTimeout)
 * so the timing stays accurate even under a throttled tab.
 * @returns {void}
 */
export function playDing() {
  playTone(880, 0.09, { type: "triangle", peakGain: 0.18 });
  playTone(1320, 0.14, { type: "triangle", peakGain: 0.18, startOffsetSec: 0.09 });
}

/**
 * A soft, low thud for a wrong answer: one short low tone that dips
 * slightly lower as it decays.
 * @returns {void}
 */
export function playThud() {
  playTone(160, 0.22, { type: "sine", endFreq: 90, peakGain: 0.22 });
}

/**
 * A quiet click for general button presses.
 * @returns {void}
 */
export function playClick() {
  playTone(600, 0.035, { type: "square", peakGain: 0.08 });
}

/**
 * Mute or unmute all game audio by setting the master gain to 0 or 1.
 * Safe to call before initAudio() has ever run (the value is applied
 * once the context/gain node exist) and safe to call repeatedly.
 * @param {boolean} value
 * @returns {void}
 */
export function setMuted(value) {
  muted = Boolean(value);
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : 1;
  }
}

/**
 * The current mute state. The single source of truth for both mute
 * controls (the case-screen button and the pause menu's button), so
 * neither the UI nor this module needs a second copy of the flag.
 * @returns {boolean}
 */
export function isMuted() {
  return muted;
}
