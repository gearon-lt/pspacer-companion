const enabled = document.querySelector("#enabled");
const minPrice = document.querySelector("#minPricePerHour");
const maxDistance = document.querySelector("#maxDistanceMeters");
const saveBtn = document.querySelector("#save");

init();

async function init() {
  const { rules } = await chrome.storage.sync.get("rules");
  const r = rules ?? {};

  enabled.checked = Boolean(r.enabled);
  minPrice.value = r.minPricePerHour ?? "";
  maxDistance.value = r.maxDistanceMeters ?? "";
}

saveBtn.addEventListener("click", async () => {
  const rules = {
    enabled: enabled.checked,
    minPricePerHour: parseOrNull(minPrice.value),
    maxDistanceMeters: parseOrNull(maxDistance.value),
    allowedVehicleTypes: [],
    includeUnknownDistance: true,
    includeUnknownPrice: true
  };

  await chrome.runtime.sendMessage({ type: "SET_RULES", rules });
  window.close();
});

function parseOrNull(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
