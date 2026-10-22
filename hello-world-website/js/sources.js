// js/sources.js
// Entry point for sources.html. Fetches data/sources.json and renders
// each source's name, link, and date accessed, with an
// unavailable/empty-state fallback. See design.md (Requirement 11).
//
// This module is self-contained: it does not import loadCases from
// cases.js (that function is tied to the Case schema and hardcoded to
// data/cases.json) and it never touches localStorage (sources have
// nothing to do with the Aggregate store).

const SOURCES_URL = "data/sources.json";

const UNAVAILABLE_MESSAGE =
  "We could not load the sources right now. Try again later.";

const EMPTY_MESSAGE = "No sources are listed yet.";

/**
 * Fetch and parse data/sources.json. Throws on network failure,
 * a non-OK response, or invalid JSON; callers catch and show the
 * unavailable message.
 * @returns {Promise<Array<object>>}
 */
async function fetchSources() {
  const response = await fetch(SOURCES_URL);
  if (!response.ok) {
    throw new Error(`Failed to load sources: ${response.status}`);
  }
  return response.json();
}

/**
 * Build one <li> for a single source record, with a real <a> link,
 * the date accessed as plain text, and a company-source label when
 * applicable. Uses only DOM APIs and textContent, never innerHTML.
 * @param {{ name: string, url: string, dateAccessed: string, companySource?: boolean }} source
 * @returns {HTMLLIElement}
 */
function buildSourceItem(source) {
  const li = document.createElement("li");

  const link = document.createElement("a");
  link.setAttribute("href", source.url);
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener noreferrer");
  link.textContent = source.name;
  li.appendChild(link);

  const dateSpan = document.createElement("span");
  dateSpan.textContent = ` — Checked: ${source.dateAccessed}`;
  li.appendChild(dateSpan);

  if (source.companySource === true) {
    const companySpan = document.createElement("span");
    companySpan.textContent = " (company source)";
    li.appendChild(companySpan);
  }

  return li;
}

/**
 * Clear a list element's children.
 * @param {HTMLElement} listEl
 */
function clearList(listEl) {
  while (listEl.firstChild) {
    listEl.removeChild(listEl.firstChild);
  }
}

/**
 * Render the source dashboard: fetch sources.json and show either the
 * rendered list, the empty-state message, or the unavailable message.
 */
async function renderSourcesPage() {
  const listEl = document.getElementById("source-list");
  const unavailableEl = document.getElementById("sources-unavailable");
  const emptyEl = document.getElementById("sources-empty");

  clearList(listEl);
  unavailableEl.hidden = true;
  unavailableEl.textContent = "";
  emptyEl.hidden = true;
  emptyEl.textContent = "";

  let sources;
  try {
    sources = await fetchSources();
  } catch (error) {
    unavailableEl.textContent = UNAVAILABLE_MESSAGE;
    unavailableEl.hidden = false;
    return;
  }

  if (!Array.isArray(sources) || sources.length === 0) {
    emptyEl.textContent = EMPTY_MESSAGE;
    emptyEl.hidden = false;
    return;
  }

  for (const source of sources) {
    listEl.appendChild(buildSourceItem(source));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderSourcesPage);
} else {
  renderSourcesPage();
}
