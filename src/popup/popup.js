const enabled = document.querySelector("#enabled");
const pageSize = document.querySelector("#pageSize");
const maxFetchCycles = document.querySelector("#maxFetchCycles");
const minItemCount = document.querySelector("#minItemCount");
const territorySelect = document.querySelector("#territoryId");
const parkingLotSelect = document.querySelector("#parkingLotId");
const parkingName = document.querySelector("#parkingName");
const refreshBtn = document.querySelector("#refresh");
const saveBtn = document.querySelector("#save");
const statusEl = document.querySelector("#status");

let savedRules = null;
let territoryOptions = [];
let parkingLotOptions = [];

init();

async function init() {
  const { rules } = await chrome.storage.sync.get("rules");
  savedRules = rules ?? {};

  enabled.checked = Boolean(savedRules.enabled);
  pageSize.value = savedRules.pageSize ?? "";
  maxFetchCycles.value = savedRules.maxFetchCycles ?? "";
  minItemCount.value = savedRules.minItemCount ?? "";
  parkingName.value = savedRules.filter?.parkingName ?? "";

  renderTerritories([]);
  renderParkingLots([], null);
  await refreshLookups();

  territorySelect.addEventListener("change", () => {
    renderParkingLots(parkingLotOptions, territorySelect.value || null);
  });
}

refreshBtn.addEventListener("click", async () => {
  await refreshLookups();
});

saveBtn.addEventListener("click", async () => {
  const rules = {
    enabled: enabled.checked,
    urlPattern: "/AssignSharedSpace/Sharings?",
    pageSize: parseOrDefault(pageSize.value, 200),
    maxFetchCycles: parseOrDefault(maxFetchCycles.value, 10),
    minItemCount: parseOrDefault(minItemCount.value, 5),
    filter: {
      territoryId: textOrNull(territorySelect.value),
      parkingLotId: textOrNull(parkingLotSelect.value),
      parkingName: textOrNull(parkingName.value)
    }
  };

  await chrome.runtime.sendMessage({ type: "SET_RULES", rules });
  window.close();
});

async function refreshLookups() {
  setStatus("Loading territories and parking lots…");
  try {
    const tab = await getActiveSpacerTab();
    if (!tab?.id) {
      setStatus("Open spacer.click in an active tab first.");
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_LOOKUPS" });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load lookups");
    }

    territoryOptions = dedupeById(response.payload?.territories || []);
    parkingLotOptions = dedupeById(response.payload?.parkingLots || []);

    const selectedTerritory = savedRules?.filter?.territoryId ?? null;
    const selectedLot = savedRules?.filter?.parkingLotId ?? null;

    renderTerritories(territoryOptions, selectedTerritory);
    renderParkingLots(parkingLotOptions, territorySelect.value || null, selectedLot);

    setStatus(`Loaded ${territoryOptions.length} territories, ${parkingLotOptions.length} lots.`);
  } catch (err) {
    setStatus(err?.message || "Failed to load lookup data");
  }
}

function renderTerritories(items, selectedId = null) {
  territorySelect.innerHTML = "";
  territorySelect.append(new Option("Any", ""));

  for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
    territorySelect.append(new Option(item.name, item.id));
  }

  territorySelect.value = selectedId || "";
}

function renderParkingLots(items, territoryId = null, selectedLotId = null) {
  parkingLotSelect.innerHTML = "";
  parkingLotSelect.append(new Option("Any", ""));

  const filtered = items
    .filter((x) => !territoryId || x.territoryId === territoryId)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const item of filtered) {
    parkingLotSelect.append(new Option(item.name, item.id));
  }

  if (selectedLotId && filtered.some((x) => x.id === selectedLotId)) {
    parkingLotSelect.value = selectedLotId;
  } else {
    parkingLotSelect.value = "";
  }
}

async function getActiveSpacerTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (activeTab?.url?.includes("spacer.click")) return activeTab;

  const spacerTabs = await chrome.tabs.query({ url: ["https://spacer.click/*", "https://*.spacer.click/*"] });
  return spacerTabs[0];
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

function textOrNull(value) {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}

function parseOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function setStatus(text) {
  statusEl.textContent = text;
}
