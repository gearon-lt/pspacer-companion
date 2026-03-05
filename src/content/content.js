const SOURCE = "PSPACER_PAGE";
const TARGET = "PSPACER_EXTENSION";

const pendingRequests = new Map();

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

  const { source, type, payload, requestId } = event.data || {};
  if (source !== SOURCE) return;

  if (type === "REQUEST_RULES") {
    const response = await chrome.runtime.sendMessage({ type: "GET_RULES" });
    window.postMessage({ source: TARGET, type: "RULES", payload: response?.rules }, "*");
    return;
  }

  if (type === "FILTERED_LISTING_BATCH") {
    renderOverlay(payload);
    return;
  }

  if (type === "LOOKUPS_RESULT" || type === "LOOKUPS_ERROR") {
    const waiter = pendingRequests.get(requestId);
    if (!waiter) return;
    pendingRequests.delete(requestId);
    if (type === "LOOKUPS_ERROR") waiter.reject(new Error(payload?.message || "Failed to load lookups"));
    else waiter.resolve(payload);
    return;
  }

  if (type === "LOG") {
    chrome.runtime.sendMessage({ type: "LOG", payload });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_LOOKUPS") return false;

  const requestId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    pendingRequests.delete(requestId);
    sendResponse({ ok: false, error: "Timed out while loading lookups" });
  }, 8000);

  pendingRequests.set(requestId, {
    resolve: (payload) => {
      clearTimeout(timeout);
      sendResponse({ ok: true, payload });
    },
    reject: (err) => {
      clearTimeout(timeout);
      sendResponse({ ok: false, error: err?.message || "Lookup error" });
    }
  });

  window.postMessage({ source: TARGET, type: "FETCH_LOOKUPS", requestId }, "*");
  return true;
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
