// js/main.js
// Entry point for index.html. Boots the game by initializing js/ui.js,
// which owns the full Start -> Loading -> Case -> Unmask -> Pause -> End
// -> Certificate flow (including its own wiring to engine.js, cases.js,
// aggregate.js, storage.js, audio.js, and a11y.js). This file's only job
// is to call initUI() once the DOM is ready. No timer is started here or
// anywhere in this file; the game is untimed by default.
// See design.md "File and Project Structure" (Requirements 1.1, 1.3,
// 2.3, 9.6, 13.3, 13.5, 13.6).

import { initUI } from "./ui.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}
