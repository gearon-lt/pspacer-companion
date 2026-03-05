const SOURCE = "PSPACER_PAGE";
const TARGET = "PSPACER_EXTENSION";

const pendingRequests = new Map();
let currentRules = null;
let territories = [];
let parkingLots = [];
let territoryControlRef = null;
let territoryHostRef = null;
let lotSelectRef = null;
let lastTerritoryResolved = null;

injectPageHook();
bootstrapOverlay();
bootstrapPageParkingLotControl();

async function safeSendMessage(message) {
  try {
    if (!chrome?.runtime?.id) return null;
    return await chrome.runtime.sendMessage(message);
  } catch (_) {
    return null;
  }
}

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
    const response = await safeSendMessage({ type: "GET_RULES" });
    currentRules = response?.rules || currentRules;
    window.postMessage({ source: TARGET, type: "RULES", payload: response?.rules }, "*");
    syncLotSelectionFromRules();
    return;
  }

  if (type === "TERRITORY_USED") {
    lastTerritoryResolved = payload?.territoryId || lastTerritoryResolved;
    renderLotOptions();
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
    safeSendMessage({ type: "LOG", payload });
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
    territoryControlRef.addEventListener("focus", onTerritoryChanged, true);
    territoryControlRef.addEventListener("click", () => setTimeout(onTerritoryChanged, 300), true);
  }

  territoryHostRef = findTerritoryHost(territoryControl);

  if (!lotSelectRef || !document.contains(lotSelectRef)) {
    const wrapper = document.createElement("div");
    wrapper.id = "pspacer-page-lot-filter";
    wrapper.className = "form-controll-select MuiBox-root css-0";

    const label = document.createElement("label");
    label.textContent = "Actual parking lot";
    label.className = "MuiFormLabel-root MuiInputLabel-root MuiInputLabel-animated MuiFormLabel-colorPrimary MuiInputLabel-root MuiInputLabel-animated input-label css-pmox31";

    const gridItem = document.createElement("div");
    gridItem.className = "MuiGrid-root MuiGrid-item MuiGrid-grid-xs-12 css-15j76c0";

    lotSelectRef = document.createElement("select");
    lotSelectRef.style.width = "100%";
    lotSelectRef.style.minHeight = "38px";
    lotSelectRef.style.padding = "8px 10px";
    lotSelectRef.style.border = "1px solid #d9d9d9";
    lotSelectRef.style.borderRadius = "4px";
    lotSelectRef.style.background = "#fff";
    lotSelectRef.addEventListener("change", persistTerritoryAndLot);

    gridItem.appendChild(lotSelectRef);
    wrapper.appendChild(label);
    wrapper.appendChild(gridItem);
    territoryHostRef?.insertAdjacentElement("afterend", wrapper);
  }

  renderLotOptions();
  syncLotSelectionFromRules();
}

function onTerritoryChanged() {
  setTimeout(() => {
    renderLotOptions();
    persistTerritoryAndLot();
  }, 50);
}

function renderLotOptions() {
  if (!lotSelectRef) return;

  const selectedTerritory = getSelectedTerritoryId() || lastTerritoryResolved || currentRules?.filter?.territoryId || "";
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

  const base = (await safeSendMessage({ type: "GET_RULES" }))?.rules || {};
  const prevLotId = base?.filter?.parkingLotId || null;

  const nextRules = {
    ...base,
    filter: {
      ...(base.filter || {}),
      territoryId,
      parkingLotId
    }
  };

  currentRules = nextRules;
  await safeSendMessage({ type: "SET_RULES", rules: nextRules });

  if (prevLotId !== parkingLotId) {
    triggerReactSharedSpacesFetch();
  }
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

  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

  if (!raw && territoryHostRef) {
    const singleValue = territoryHostRef.querySelector(".css-1dimb5e-singleValue");
    raw = (singleValue?.textContent || "").trim();
  }

  if (territories.some((t) => t.id === raw)) {
    lastTerritoryResolved = raw;
    return raw;
  }

  const rawNorm = norm(raw);
  if (!rawNorm) return lastTerritoryResolved;

  const exact = territories.find((t) => norm(t.name) === rawNorm);
  if (exact) {
    lastTerritoryResolved = exact.id;
    return exact.id;
  }

  const contains = territories.find((t) => norm(t.name).includes(rawNorm) || rawNorm.includes(norm(t.name)));
  if (contains) {
    lastTerritoryResolved = contains.id;
    return contains.id;
  }

  return lastTerritoryResolved;
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

let cachedFetchInstance = null;

function triggerReactSharedSpacesFetch() {
  try {
    const predicate = (inst) => typeof inst?.fetchSharedSpaces === "function" || typeof inst?.setLot === "function";

    const seed = territoryControlRef
      || document.querySelector('input[id^="react-select-"][id$="-input"]')
      || document.querySelector("form.ExchangesForm")
      || document.querySelector("#root");

    let instance = null;

    if (cachedFetchInstance && predicate(cachedFetchInstance)) {
      instance = cachedFetchInstance;
    }

    if (!instance && seed) {
      instance = findReactComponentInstance(seed, predicate);
    }

    if (!instance) {
      instance = findAnyReactComponentInstance(predicate);
    }

    if (!instance) return;
    cachedFetchInstance = instance;

    if (typeof instance.fetchSharedSpaces === "function") {
      instance.fetchSharedSpaces();
      return;
    }

    if (typeof instance.setLot === "function") {
      const currentLot = instance.state?.lot ?? instance.props?.lot ?? null;
      instance.setLot(currentLot);
    }
  } catch (_) {
    // no-op
  }
}

function findReactComponentInstance(seedEl, predicate) {
  let el = seedEl;
  while (el) {
    const keys = Object.keys(el);
    const fiberKey = keys.find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    const fiber = fiberKey ? el[fiberKey] : null;

    let node = fiber;
    while (node) {
      const candidate = node.stateNode;
      if (candidate && predicate(candidate)) return candidate;
      node = node.return;
    }

    el = el.parentElement;
  }

  return null;
}

function findAnyReactComponentInstance(predicate) {
  const all = document.querySelectorAll("*");
  for (const el of all) {
    const found = findReactComponentInstance(el, predicate);
    if (found) return found;
  }
  return null;
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
