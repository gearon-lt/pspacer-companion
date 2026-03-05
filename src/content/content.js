const SOURCE = "PSPACER_PAGE";
const TARGET = "PSPACER_EXTENSION";

const pendingRequests = new Map();
let currentRules = null;
let territories = [];
let parkingLots = [];
let territoryControlRef = null;
let territoryHostRef = null;
let lotSelectRef = null;

injectPageHook();
bootstrapOverlay();
bootstrapPageParkingLotControl();

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
    currentRules = response?.rules || currentRules;
    window.postMessage({ source: TARGET, type: "RULES", payload: response?.rules }, "*");
    syncLotSelectionFromRules();
    return;
  }

  if (type === "FILTERED_LISTING_BATCH") {
    renderOverlay(payload);
    if (!parkingLots.length) refreshLookupsSilently();
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
  if (message?.type === "RULES_UPDATED") {
    currentRules = message.rules || currentRules;
    window.postMessage({ source: TARGET, type: "RULES", payload: message.rules }, "*");
    syncLotSelectionFromRules();
    sendResponse?.({ ok: true });
    return false;
  }
  return false;
});

async function bootstrapPageParkingLotControl() {
  await refreshLookupsSilently();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    mountOrUpdateControl();
    if (lotSelectRef || attempts >= 30) clearInterval(timer);
  }, 500);
}

async function refreshLookupsSilently() {
  try {
    const lookups = await requestLookups();
    territories = dedupeById(lookups?.territories || []);
    parkingLots = dedupeById(lookups?.parkingLots || []);
    renderLotOptions();
  } catch (_) {}
}

function mountOrUpdateControl() {
  const territoryControl = findTerritoryControl();
  if (!territoryControl) return;

  if (territoryControlRef !== territoryControl) {
    territoryControlRef = territoryControl;
    territoryControlRef.addEventListener("change", onTerritoryChanged, true);
    territoryControlRef.addEventListener("input", onTerritoryChanged, true);
    territoryControlRef.addEventListener("blur", onTerritoryChanged, true);
    territoryControlRef.addEventListener("click", () => setTimeout(onTerritoryChanged, 300), true);
  }

  territoryHostRef = findTerritoryHost(territoryControl);

  if (!lotSelectRef || !document.contains(lotSelectRef)) {
    const wrapper = document.createElement("div");
    wrapper.id = "pspacer-page-lot-filter";
    wrapper.style.position = "absolute";
    wrapper.style.left = "0";
    wrapper.style.top = "calc(100% + 6px)";
    wrapper.style.width = "320px";
    wrapper.style.zIndex = "2147483647";
    wrapper.style.pointerEvents = "auto";
    wrapper.style.background = "#fff";
    wrapper.style.padding = "6px";
    wrapper.style.border = "1px solid #d9d9d9";
    wrapper.style.borderRadius = "6px";
    wrapper.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";

    const label = document.createElement("label");
    label.textContent = "Parking lot";
    label.style.display = "block";
    label.style.fontSize = "12px";
    label.style.marginBottom = "4px";

    lotSelectRef = document.createElement("select");
    lotSelectRef.style.width = "100%";
    lotSelectRef.style.minHeight = "36px";
    lotSelectRef.style.padding = "4px";
    lotSelectRef.style.pointerEvents = "auto";
    lotSelectRef.addEventListener("change", persistTerritoryAndLot);

    wrapper.appendChild(label);
    wrapper.appendChild(lotSelectRef);
    if (territoryHostRef) {
      territoryHostRef.style.position = territoryHostRef.style.position || "relative";
      territoryHostRef.style.overflow = "visible";
      territoryHostRef.appendChild(wrapper);
    }
  }

  renderLotOptions();
  syncLotSelectionFromRules();
}

function onTerritoryChanged() {
  renderLotOptions();
  persistTerritoryAndLot();
}

function renderLotOptions() {
  if (!lotSelectRef) return;

  const selectedTerritory = getSelectedTerritoryId() || currentRules?.filter?.territoryId || "";
  const allowedLots = parkingLots
    .filter((x) => !selectedTerritory || x.territoryId === selectedTerritory)
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentValue = lotSelectRef.value;
  lotSelectRef.innerHTML = "";
  lotSelectRef.append(new Option("Any", ""));
  for (const lot of allowedLots) lotSelectRef.append(new Option(lot.name, lot.id));

  if ([...lotSelectRef.options].some((o) => o.value === currentValue)) lotSelectRef.value = currentValue;
}

function syncLotSelectionFromRules() {
  if (!lotSelectRef || !currentRules?.filter) return;
  renderLotOptions();

  const lotId = currentRules.filter.parkingLotId || "";
  if ([...lotSelectRef.options].some((o) => o.value === lotId)) lotSelectRef.value = lotId;
  else lotSelectRef.value = "";
}

async function persistTerritoryAndLot() {
  const territoryId = getSelectedTerritoryId() || null;
  const parkingLotId = lotSelectRef?.value || null;

  const base = (await chrome.runtime.sendMessage({ type: "GET_RULES" }))?.rules || {};
  const nextRules = {
    ...base,
    filter: {
      ...(base.filter || {}),
      territoryId,
      parkingLotId
    }
  };

  currentRules = nextRules;
  await chrome.runtime.sendMessage({ type: "SET_RULES", rules: nextRules });
}

function getSelectedTerritoryId() {
  const ctrl = territoryControlRef;
  if (!ctrl) return null;

  let raw = "";
  if (ctrl.tagName === "SELECT") raw = ctrl.value || "";
  else if (ctrl.tagName === "INPUT") raw = ctrl.value || ctrl.getAttribute("value") || "";
  else {
    const input = ctrl.querySelector("input");
    raw = input?.value || ctrl.getAttribute("aria-label") || ctrl.textContent || "";
  }

  raw = String(raw).trim();
  if (!raw) return null;

  if (territories.some((t) => t.id === raw)) return raw;

  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const rawNorm = norm(raw);

  const exact = territories.find((t) => norm(t.name) === rawNorm);
  if (exact) return exact.id;

  const contains = territories.find((t) => norm(t.name).includes(rawNorm) || rawNorm.includes(norm(t.name)));
  return contains?.id || null;
}

function requestLookups() {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Timed out while loading lookups"));
    }, 8000);

    pendingRequests.set(requestId, {
      resolve: (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    });

    window.postMessage({ source: TARGET, type: "FETCH_LOOKUPS", requestId }, "*");
  });
}


function findTerritoryControl() {
  const direct = [
    'select[id*="territory" i]',
    'select[name*="territory" i]',
    'input[id*="territory" i]',
    'input[name*="territory" i]',
    'input[id^="react-select-"][id$="-input"]',
    '[role="combobox"][aria-label*="territory" i]'
  ];
  for (const s of direct) {
    const el = document.querySelector(s);
    if (el) return el;
  }

  const labelNode = [...document.querySelectorAll("label, div, span, p")].find((n) => {
    const t = (n.textContent || "").trim().toLowerCase();
    return t === "stovėjimo aikštelė" || t === "territory";
  });
  if (!labelNode) return null;

  const field = labelNode.parentElement;
  if (!field) return null;

  return field.querySelector("select, input, [role='combobox']") || field.nextElementSibling?.querySelector?.("select, input, [role='combobox']") || null;
}

function findTerritoryHost(control) {
  const explicit = control.closest(".form-controll-select");
  if (explicit) return explicit;

  let node = control;
  while (node && node !== document.body) {
    const text = (node.textContent || "").toLowerCase();
    const hasTerritoryLabel = text.includes("stovėjimo aikštelė") || text.includes("territory");
    const hasDateFields = text.includes("pradžia") || text.includes("pabaiga") || text.includes("from") || text.includes("to");

    if (hasTerritoryLabel && !hasDateFields) return node;
    node = node.parentElement;
  }

  return control.parentElement;
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(String(item.id), {
      id: String(item.id),
      territoryId: item.territoryId ? String(item.territoryId) : "",
      name: String(item.name || item.id)
    });
  }
  return [...map.values()];
}

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
