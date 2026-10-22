// js/audio.js
// Browser-facing module: the ONLY module that touches the Audio API.
// Owns a single Audio element for background music, starts playback
// only after the Start screen's Play press, and exposes mute/unmute
// that restore the prior audio state.
// See design.md "audio.js" (Requirement 6).

// Path to the background music file. The actual audio asset is added by a
// later content/asset task; until then this path simply 404s, which play()
// handles gracefully (see below).
const MUSIC_SRC = "assets/audio/background-music.mp3";

/** @type {HTMLAudioElement | null} */
let audioEl = null;

/** Tracks whether audio is currently muted, independent of element lifecycle. */
let muted = false;

/**
 * Lazily create (if needed) and return the single shared Audio element.
 * Creating it here, rather than at module load time, keeps importing this
 * module free of side effects.
 * @returns {HTMLAudioElement}
 */
function getAudioEl() {
  if (!audioEl) {
    audioEl = new Audio(MUSIC_SRC);
    audioEl.loop = true;
    audioEl.muted = muted;
  }
  return audioEl;
}

/**
 * Start background music. Must only ever be called after a user
 * gesture (the Play button press), per browser autoplay policy.
 * Playback rejection (blocked autoplay, missing/404 audio file, etc.) is
 * caught and swallowed so this never throws or produces an unhandled
 * rejection. Respects the current mute state rather than un-muting as a
 * side effect.
 * @returns {void}
 */
export function play() {
  const el = getAudioEl();
  el.muted = muted;
  try {
    const result = el.play();
    if (result && typeof result.catch === "function") {
      result.catch((err) => {
        console.warn("audio.js: play() was rejected", err);
      });
    }
  } catch (err) {
    console.warn("audio.js: play() threw synchronously", err);
  }
}

/**
 * Mute all game audio. Safe to call before play() has ever been invoked,
 * and safe to call repeatedly (idempotent).
 * @returns {void}
 */
export function mute() {
  muted = true;
  if (audioEl) {
    audioEl.muted = true;
  }
}

/**
 * Restore audio to its state prior to muting. Safe to call even if
 * mute() was never called, and safe even if the audio element does not
 * exist yet.
 * @returns {void}
 */
export function unmute() {
  muted = false;
  if (audioEl) {
    audioEl.muted = false;
  }
}
