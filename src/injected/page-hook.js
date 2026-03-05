(() => {
  const SOURCE = "PSPACER_PAGE";
  const TARGET = "PSPACER_EXTENSION";

  const API_PATTERNS = [
    /\/api\/.*sharing/i,
    /\/api\/.*listing/i
  ];

  let rules = null;

  requestRules();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    const { source, type, payload } = event.data || {};
    if (source !== TARGET) return;

    if (type === "RULES") {
      rules = payload;
    }
  });

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    try {
      const [input] = args;
      const url = typeof input === "string" ? input : input?.url;
      if (!isCandidateEndpoint(url)) return response;

      const clone = response.clone();
      const contentType = clone.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return response;

      const data = await clone.json();
      const listings = extractListings(data);
      const filtered = applyRules(listings, rules);

      emitFilteredBatch({
        endpoint: url,
        total: listings.length,
        kept: filtered.length,
        dropped: listings.length - filtered.length,
        sample: filtered.slice(0, 5)
      });

      // NOTE: Skeleton sends telemetry only.
      // Future: rebuild Response with rewritten payload if you want in-place UI filtering.
    } catch (err) {
      emitLog({ type: "fetch_hook_error", message: err?.message });
    }

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__pspacer_url = url;
    this.__pspacer_method = method;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.__pspacer_url;
        if (!isCandidateEndpoint(url)) return;

        const type = this.getResponseHeader("content-type") || "";
        if (!type.includes("application/json")) return;

        const data = JSON.parse(this.responseText);
        const listings = extractListings(data);
        const filtered = applyRules(listings, rules);

        emitFilteredBatch({
          endpoint: url,
          total: listings.length,
          kept: filtered.length,
          dropped: listings.length - filtered.length,
          sample: filtered.slice(0, 5)
        });
      } catch (err) {
        emitLog({ type: "xhr_hook_error", message: err?.message });
      }
    });

    return originalSend.call(this, ...args);
  };

  function requestRules() {
    window.postMessage({
      source: SOURCE,
      type: "REQUEST_RULES"
    }, "*");
  }

  function isCandidateEndpoint(url = "") {
    return API_PATTERNS.some((pattern) => pattern.test(url));
  }

  function extractListings(payload) {
    if (!payload || typeof payload !== "object") return [];

    // Adapt these field paths to real Spacer API payloads.
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.items)) return payload.data.items;
    if (Array.isArray(payload.results)) return payload.results;

    return [];
  }

  function applyRules(listings, activeRules) {
    if (!Array.isArray(listings)) return [];
    if (!activeRules?.enabled) return listings;

    return listings.filter((item) => {
      const price = item?.pricePerHour ?? item?.price?.hourly ?? null;
      if (activeRules.minPricePerHour != null && price != null && price < activeRules.minPricePerHour) {
        return false;
      }
      if (activeRules.minPricePerHour != null && price == null && !activeRules.includeUnknownPrice) {
        return false;
      }

      const distance = item?.distanceMeters ?? item?.distance ?? null;
      if (activeRules.maxDistanceMeters != null && distance != null && distance > activeRules.maxDistanceMeters) {
        return false;
      }
      if (activeRules.maxDistanceMeters != null && distance == null && !activeRules.includeUnknownDistance) {
        return false;
      }

      if (activeRules.allowedVehicleTypes?.length) {
        const vehicleType = item?.vehicleType ?? item?.vehicle?.type ?? "";
        if (!activeRules.allowedVehicleTypes.includes(vehicleType)) {
          return false;
        }
      }

      return true;
    });
  }

  function emitFilteredBatch(payload) {
    window.postMessage({
      source: SOURCE,
      type: "FILTERED_LISTING_BATCH",
      payload
    }, "*");
  }

  function emitLog(payload) {
    window.postMessage({ source: SOURCE, type: "LOG", payload }, "*");
  }
})();
