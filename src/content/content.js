const SOURCE = "PSPACER_PAGE";
const TARGET = "PSPACER_EXTENSION";
const ext = globalThis.browser ?? globalThis.chrome;

const pendingRequests = new Map();
let currentRules = null;
let territories = [];
let parkingLots = [];
let territoryControlRef = null;
let territoryHostRef = null;
let lotSelectRef = null;
let parkingNameInputRef = null;
let parkingNameComboRef = null;
let parkingNamePresetsRef = null;
let parkingNamePresetIndex = -1;
let parkingNamePresetArmedByKeyboard = false;
let lastTerritoryResolved = null;

injectPageHook();
bootstrapOverlay();
bootstrapPageParkingLotControl();

document.addEventListener("click", (event) => {
  if (!parkingNamePresetsRef || !parkingNameComboRef) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (parkingNameComboRef.contains(target)) return;
  hideParkingNamePresets();
});

async function safeSendMessage(message) {
  try {
    if (!ext?.runtime?.id) return null;
    return await ext.runtime.sendMessage(message);
  } catch (_) {
    return null;
  }
}

function injectPageHook() {
  const script = document.createElement("script");
  script.src = ext.runtime.getURL("src/injected/page-hook.js");
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

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    if (lotSelectRef && parkingNameInputRef || attempts >= 30) clearInterval(timer);
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
    const lotWrapper = document.createElement("div");
    lotWrapper.id = "pspacer-page-lot-filter";
    lotWrapper.className = "form-controll-select MuiBox-root css-0";

    const lotLabel = document.createElement("label");
    lotLabel.textContent = "Actual parking lot";
    lotLabel.className = "MuiFormLabel-root MuiInputLabel-root MuiInputLabel-animated MuiFormLabel-colorPrimary MuiInputLabel-root MuiInputLabel-animated input-label css-pmox31";

    const lotGridItem = document.createElement("div");
    lotGridItem.className = "MuiGrid-root MuiGrid-item MuiGrid-grid-xs-12 css-15j76c0";

    lotSelectRef = document.createElement("select");
    lotSelectRef.style.width = "100%";
    lotSelectRef.style.minHeight = "38px";
    lotSelectRef.style.padding = "8px 10px";
    lotSelectRef.style.border = "1px solid #d9d9d9";
    lotSelectRef.style.borderRadius = "4px";
    lotSelectRef.style.background = "#fff";
    lotSelectRef.addEventListener("change", persistTerritoryAndLot);

    lotGridItem.appendChild(lotSelectRef);
    lotWrapper.appendChild(lotLabel);
    lotWrapper.appendChild(lotGridItem);
    territoryHostRef?.insertAdjacentElement("afterend", lotWrapper);

    const nameWrapper = document.createElement("div");
    nameWrapper.id = "pspacer-page-name-filter";
    nameWrapper.className = "form-controll-select MuiBox-root css-0";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Parking name";
    nameLabel.className = "MuiFormLabel-root MuiInputLabel-root MuiInputLabel-animated MuiFormLabel-colorPrimary MuiInputLabel-root MuiInputLabel-animated input-label css-pmox31";

    const nameGridItem = document.createElement("div");
    nameGridItem.className = "MuiGrid-root MuiGrid-item MuiGrid-grid-xs-12 css-15j76c0";

    const parkingNameRow = document.createElement("div");
    parkingNameRow.style.position = "relative";
    parkingNameComboRef = parkingNameRow;

    parkingNameInputRef = document.createElement("input");
    parkingNameInputRef.type = "text";
    parkingNameInputRef.placeholder = "Any (type and press Enter)";
    parkingNameInputRef.autocomplete = "off";
    parkingNameInputRef.style.width = "100%";
    parkingNameInputRef.style.minHeight = "38px";
    parkingNameInputRef.style.padding = "8px 34px 8px 10px";
    parkingNameInputRef.style.border = "1px solid #d9d9d9";
    parkingNameInputRef.style.borderRadius = "4px";
    parkingNameInputRef.style.background = "#fff";

    const parkingNameToggle = document.createElement("button");
    parkingNameToggle.type = "button";
    parkingNameToggle.textContent = "▾";
    parkingNameToggle.style.position = "absolute";
    parkingNameToggle.style.right = "6px";
    parkingNameToggle.style.top = "50%";
    parkingNameToggle.style.transform = "translateY(-50%)";
    parkingNameToggle.style.border = "none";
    parkingNameToggle.style.background = "transparent";
    parkingNameToggle.style.cursor = "pointer";
    parkingNameToggle.style.fontSize = "14px";
    parkingNameToggle.style.color = "#666";

    parkingNamePresetsRef = document.createElement("div");
    parkingNamePresetsRef.style.position = "absolute";
    parkingNamePresetsRef.style.left = "0";
    parkingNamePresetsRef.style.right = "0";
    parkingNamePresetsRef.style.top = "calc(100% + 4px)";
    parkingNamePresetsRef.style.zIndex = "9999";
    parkingNamePresetsRef.style.background = "#fff";
    parkingNamePresetsRef.style.border = "1px solid #d9d9d9";
    parkingNamePresetsRef.style.borderRadius = "4px";
    parkingNamePresetsRef.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
    parkingNamePresetsRef.style.display = "none";

    for (const optionValue of ["", "El.", "El.stotelė", "El.lizdas"]) {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = optionValue === "" ? "Any" : optionValue;
      item.dataset.value = optionValue;
      item.style.display = "block";
      item.style.width = "100%";
      item.style.textAlign = "left";
      item.style.padding = "8px 10px";
      item.style.border = "none";
      item.style.background = "#fff";
      item.style.cursor = "pointer";
      item.addEventListener("mouseenter", () => {
        const items = getParkingNamePresetItems();
        const idx = items.indexOf(item);
        if (idx >= 0) setParkingNamePresetIndex(idx);
      });
      item.addEventListener("click", () => {
        if (parkingNameInputRef) parkingNameInputRef.value = optionValue;
        hideParkingNamePresets();
        persistTerritoryAndLot({ forceFetch: true });
      });
      parkingNamePresetsRef.appendChild(item);
    }

    parkingNameInputRef.addEventListener("change", persistTerritoryAndLot);
    parkingNameInputRef.addEventListener("input", () => {
      parkingNamePresetArmedByKeyboard = false;
    });
    parkingNameInputRef.addEventListener("focus", showParkingNamePresets);
    parkingNameInputRef.addEventListener("click", showParkingNamePresets);
    parkingNameInputRef.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        parkingNamePresetArmedByKeyboard = true;
        showParkingNamePresets();
        moveParkingNamePresetIndex(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        parkingNamePresetArmedByKeyboard = true;
        showParkingNamePresets();
        moveParkingNamePresetIndex(-1);
        return;
      }

      if (event.key === "Escape") {
        hideParkingNamePresets();
        return;
      }

      if (event.key !== "Enter") return;
      event.preventDefault();

      if (parkingNamePresetArmedByKeyboard && isParkingNamePresetsOpen() && parkingNamePresetIndex >= 0) {
        const item = getParkingNamePresetItems()[parkingNamePresetIndex];
        if (item) {
          if (parkingNameInputRef) parkingNameInputRef.value = item.dataset.value || "";
          parkingNamePresetArmedByKeyboard = false;
          hideParkingNamePresets();
          persistTerritoryAndLot({ forceFetch: true });
          return;
        }
      }

      parkingNamePresetArmedByKeyboard = false;

      hideParkingNamePresets();
      persistTerritoryAndLot({ forceFetch: true });
    });

    parkingNameToggle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showParkingNamePresets();
      parkingNameInputRef?.focus();
    });

    parkingNameRow.appendChild(parkingNameInputRef);
    parkingNameRow.appendChild(parkingNameToggle);
    parkingNameRow.appendChild(parkingNamePresetsRef);
    nameGridItem.appendChild(parkingNameRow);
    nameWrapper.appendChild(nameLabel);
    nameWrapper.appendChild(nameGridItem);
    lotWrapper.insertAdjacentElement("afterend", nameWrapper);
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
  lotSelectRef.replaceChildren();
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

  if (parkingNameInputRef) {
    const parkingName = currentRules.filter.parkingName || "";
    parkingNameInputRef.value = String(parkingName || "");
  }

}

async function persistTerritoryAndLot({ forceFetch = false } = {}) {
  const territoryId = getSelectedTerritoryId() || null;
  const parkingLotId = lotSelectRef?.value || null;
  const parkingName = getParkingNameValue();

  const base = (await safeSendMessage({ type: "GET_RULES" }))?.rules || {};
  const prevLotId = base?.filter?.parkingLotId || null;
  const prevParkingName = base?.filter?.parkingName || null;

  const nextRules = {
    ...base,
    filter: {
      ...(base.filter || {}),
      territoryId,
      parkingLotId,
      parkingName
    }
  };

  currentRules = nextRules;
  await safeSendMessage({ type: "SET_RULES", rules: nextRules });

  if (forceFetch || prevLotId !== parkingLotId || prevParkingName !== parkingName) {
    window.postMessage({ source: TARGET, type: "TRIGGER_SHARED_SPACES_FETCH" }, "*");
  }
}

function getParkingNameValue() {
  if (!parkingNameInputRef) return null;
  return normalizeParkingName(parkingNameInputRef.value);
}

function showParkingNamePresets() {
  if (!parkingNamePresetsRef) return;
  parkingNamePresetsRef.style.display = "block";
  if (parkingNamePresetIndex < 0) setParkingNamePresetIndex(0);
}

function hideParkingNamePresets() {
  if (!parkingNamePresetsRef) return;
  parkingNamePresetArmedByKeyboard = false;
  parkingNamePresetsRef.style.display = "none";
  setParkingNamePresetIndex(-1);
}

function isParkingNamePresetsOpen() {
  return Boolean(parkingNamePresetsRef && parkingNamePresetsRef.style.display !== "none");
}

function getParkingNamePresetItems() {
  if (!parkingNamePresetsRef) return [];
  return [...parkingNamePresetsRef.querySelectorAll("button")];
}

function setParkingNamePresetIndex(nextIndex) {
  parkingNamePresetIndex = nextIndex;
  const items = getParkingNamePresetItems();
  items.forEach((item, idx) => {
    const active = idx === parkingNamePresetIndex;
    item.style.background = active ? "#f2f6ff" : "#fff";
  });
}

function moveParkingNamePresetIndex(delta) {
  const items = getParkingNamePresetItems();
  if (!items.length) return;

  const max = items.length - 1;
  let next = parkingNamePresetIndex;

  if (next < 0) next = delta > 0 ? 0 : max;
  else next += delta;

  if (next < 0) next = max;
  if (next > max) next = 0;

  setParkingNamePresetIndex(next);
}

function normalizeParkingName(value) {
  const v = String(value || "").trim();
  return v === "" ? null : v;
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

  if (!raw && territoryHostRef) {
    const singleValue = territoryHostRef.querySelector(".css-1dimb5e-singleValue");
    raw = (singleValue?.textContent || "").trim();
  }

  if (!raw) return null;

  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

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

  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = "PSpacer Companion";

  const status = document.createElement("span");
  status.id = "pspacer-status";
  status.textContent = "Waiting for listing API...";

  const summary = document.createElement("div");
  summary.id = "pspacer-summary";

  header.appendChild(title);
  header.appendChild(status);
  root.appendChild(header);
  root.appendChild(summary);

  document.documentElement.appendChild(root);
}

function renderOverlay(payload = {}) {
  const status = document.querySelector("#pspacer-status");
  const summary = document.querySelector("#pspacer-summary");
  if (!status || !summary) return;

  const { total = 0, kept = 0, dropped = 0 } = payload;
  status.textContent = "Listings processed";

  summary.textContent = "";
  summary.appendChild(createSummaryLine("Total", total));
  summary.appendChild(createSummaryLine("Kept", kept));
  summary.appendChild(createSummaryLine("Dropped", dropped));
}

function createSummaryLine(label, value) {
  const row = document.createElement("div");
  row.append(`${label}: `);

  const strongValue = document.createElement("b");
  strongValue.textContent = String(Number.isFinite(Number(value)) ? Number(value) : 0);
  row.appendChild(strongValue);

  return row;
}
