(() => {
  const SOURCE = "PSPACER_PAGE";
  const TARGET = "PSPACER_EXTENSION";

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
    const [input, init = {}] = args;
    const url = typeof input === "string" ? input : input?.url;

    if (!isSharingsRequest(url, rules)) {
      return originalFetch(...args);
    }

    const reqUrl = new URL(url, window.location.origin);

    if (!shouldFilterByTerritory(reqUrl, rules)) {
      emitLog({ type: "skip_territory_mismatch", url });
      return originalFetch(...args);
    }

    try {
      const baseOffset = parseInt(reqUrl.searchParams.get("Offset") || "0", 10) || 0;
      const headersObj = flattenHeaders(input, init);
      const out = await fetchAndFilter(reqUrl, headersObj, baseOffset, rules);

      emitFilteredBatch({
        endpoint: reqUrl.toString(),
        total: out.totalFetched,
        kept: out.filteredItems.length,
        dropped: out.totalFetched - out.filteredItems.length,
        sample: out.filteredItems.slice(0, 5)
      });

      return new Response(JSON.stringify(out.payload), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      });
    } catch (err) {
      emitLog({ type: "fetch_hook_error", message: err?.message });
      return originalFetch(...args);
    }
  };

  function shouldFilterByTerritory(reqUrl, activeRules) {
    const wanted = activeRules?.filter?.territoryId;
    const actual = reqUrl.searchParams.get("TerritoryId");
    if (!wanted || !actual) return true;
    return wanted === actual;
  }

  function isSharingsRequest(url = "", activeRules) {
    const pattern = activeRules?.urlPattern || "/AssignSharedSpace/Sharings?";
    return url.includes(pattern);
  }

  async function fetchAndFilter(baseUrl, headersObj, baseOffset, activeRules) {
    const pageSize = Number(activeRules?.pageSize ?? 200);
    const maxFetchCycles = Number(activeRules?.maxFetchCycles ?? 10);
    const minItemCount = Number(activeRules?.minItemCount ?? 5);

    let root = null;
    const filteredItems = [];
    let totalFetched = 0;

    for (let fetchCycle = 0; fetchCycle < maxFetchCycles; fetchCycle++) {
      const offset = baseOffset + fetchCycle * pageSize;
      const nextUrl = new URL(baseUrl.toString());
      nextUrl.searchParams.set("Limit", String(pageSize));
      nextUrl.searchParams.set("Offset", String(offset));

      const resp = await originalFetch(nextUrl.toString(), {
        method: "GET",
        headers: headersObj,
        credentials: "include"
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Failed to fetch data. ${resp.status} ${resp.statusText}. Body: ${body.slice(0, 500)}`);
      }

      root = await resp.json();
      const items = Array.isArray(root?.items) ? root.items : [];
      totalFetched += items.length;

      for (const item of items) {
        if (matchesFilter(item, activeRules?.filter)) {
          filteredItems.push(item);
        }
      }

      if (filteredItems.length >= minItemCount) {
        break;
      }
    }

    const payload = {
      ...(root || {}),
      count: filteredItems.length,
      items: filteredItems
    };

    if (filteredItems.length === 0) {
      payload.nextOffset = 0;
    }

    return { payload, filteredItems, totalFetched };
  }

  function matchesFilter(item, filter = {}) {
    const parkingSpaceName = asString(item?.parkingSpaceName);
    const parkingLotId = asString(item?.parkingLotId);

    if (filter?.parkingName) {
      if (!parkingSpaceName.toLowerCase().includes(String(filter.parkingName).toLowerCase())) {
        return false;
      }
    }

    if (filter?.parkingLotId) {
      if (parkingLotId !== String(filter.parkingLotId)) {
        return false;
      }
    }

    return true;
  }

  function asString(value) {
    return value == null ? "" : String(value);
  }

  function flattenHeaders(input, init) {
    const output = {};

    const append = (headersLike) => {
      if (!headersLike) return;
      const h = new Headers(headersLike);
      h.forEach((value, key) => {
        output[key] = value;
      });
    };

    if (input instanceof Request) append(input.headers);
    append(init?.headers);

    return output;
  }

  function requestRules() {
    window.postMessage({ source: SOURCE, type: "REQUEST_RULES" }, "*");
  }

  function emitFilteredBatch(payload) {
    window.postMessage({ source: SOURCE, type: "FILTERED_LISTING_BATCH", payload }, "*");
  }

  function emitLog(payload) {
    window.postMessage({ source: SOURCE, type: "LOG", payload }, "*");
  }
})();
