const enabled = document.querySelector("#enabled");
const pageSize = document.querySelector("#pageSize");
const maxFetchCycles = document.querySelector("#maxFetchCycles");
const minItemCount = document.querySelector("#minItemCount");
const territoryId = document.querySelector("#territoryId");
const parkingLotId = document.querySelector("#parkingLotId");
const parkingName = document.querySelector("#parkingName");
const saveBtn = document.querySelector("#save");

init();

async function init() {
  const { rules } = await chrome.storage.sync.get("rules");
  const r = rules ?? {};

  enabled.checked = Boolean(r.enabled);
  pageSize.value = r.pageSize ?? "";
  maxFetchCycles.value = r.maxFetchCycles ?? "";
  minItemCount.value = r.minItemCount ?? "";
  territoryId.value = r.filter?.territoryId ?? "";
  parkingLotId.value = r.filter?.parkingLotId ?? "";
  parkingName.value = r.filter?.parkingName ?? "";
}

saveBtn.addEventListener("click", async () => {
  const rules = {
    enabled: enabled.checked,
    urlPattern: "/AssignSharedSpace/Sharings?",
    pageSize: parseOrDefault(pageSize.value, 200),
    maxFetchCycles: parseOrDefault(maxFetchCycles.value, 10),
    minItemCount: parseOrDefault(minItemCount.value, 5),
    filter: {
      territoryId: textOrNull(territoryId.value),
      parkingLotId: textOrNull(parkingLotId.value),
      parkingName: textOrNull(parkingName.value)
    }
  };

  await chrome.runtime.sendMessage({ type: "SET_RULES", rules });
  window.close();
});

function textOrNull(value) {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}

function parseOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
