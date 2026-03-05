const enabled = document.querySelector("#enabled");
const pageSize = document.querySelector("#pageSize");
const maxFetchCycles = document.querySelector("#maxFetchCycles");
const minItemCount = document.querySelector("#minItemCount");
const parkingName = document.querySelector("#parkingName");
const saveBtn = document.querySelector("#save");

let savedRules = null;

init();

async function init() {
  const { rules } = await chrome.storage.sync.get("rules");
  savedRules = rules ?? {};

  enabled.checked = Boolean(savedRules.enabled);
  pageSize.value = savedRules.pageSize ?? "";
  maxFetchCycles.value = savedRules.maxFetchCycles ?? "";
  minItemCount.value = savedRules.minItemCount ?? "";
  parkingName.value = savedRules.filter?.parkingName ?? "";
}

saveBtn.addEventListener("click", async () => {
  const rules = {
    ...savedRules,
    enabled: enabled.checked,
    urlPattern: "/AssignSharedSpace/Sharings?",
    pageSize: parseOrDefault(pageSize.value, 200),
    maxFetchCycles: parseOrDefault(maxFetchCycles.value, 10),
    minItemCount: parseOrDefault(minItemCount.value, 5),
    filter: {
      ...(savedRules?.filter || {}),
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
