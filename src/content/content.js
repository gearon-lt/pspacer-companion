const SOURCE = "PSPACER_PAGE";
const TARGET = "PSPACER_EXTENSION";

injectPageHook();
bootstrapOverlay();

function injectPageHook() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/injected/page-hook.js");
  script.dataset.source = SOURCE;
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const { source, type, payload } = event.data || {};
  if (source !== SOURCE) return;

  if (type === "REQUEST_RULES") {
    const response = await chrome.runtime.sendMessage({ type: "GET_RULES" });
    window.postMessage({
      source: TARGET,
      type: "RULES",
      payload: response?.rules
    }, "*");
    return;
  }

  if (type === "FILTERED_LISTING_BATCH") {
    renderOverlay(payload);
    return;
  }

  if (type === "LOG") {
    chrome.runtime.sendMessage({ type: "LOG", payload });
  }
});

function bootstrapOverlay() {
  const root = document.createElement("section");
  root.id = "pspacer-overlay";
  root.innerHTML = `
    <header>
      <strong>PSpacer Companion</strong>
      <span id="pspacer-status">Waiting for listing API…</span>
    </header>
    <div id="pspacer-summary"></div>
  `;
  document.documentElement.appendChild(root);
}

function renderOverlay(payload = {}) {
  const status = document.querySelector("#pspacer-status");
  const summary = document.querySelector("#pspacer-summary");
  if (!status || !summary) return;

  const { total = 0, kept = 0, dropped = 0 } = payload;
  status.textContent = "Listings processed";

  summary.innerHTML = [
    `<div>Total: <b>${total}</b></div>`,
    `<div>Kept: <b>${kept}</b></div>`,
    `<div>Dropped: <b>${dropped}</b></div>`
  ].join("");
}
