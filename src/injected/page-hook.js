(() => {
  const SOURCE = "PSPACER_PAGE";
  const TARGET = "PSPACER_EXTENSION";

  let rules = null;
  let authHeadersCache = {};

  requestRules();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const { source, type, payload, requestId } = event.data || {};
    if (source !== TARGET) return;
    if (type === "RULES") {
      rules = payload;
      return;
    }
    if (type === "FETCH_LOOKUPS") {
      fetchLookups()
        .then((lookups) => {
          window.postMessage({ source: SOURCE, type: "LOOKUPS_RESULT", requestId, payload: lookups }, "*");
        })
        .catch((err) => {
          window.postMessage({
            source: SOURCE,
            type: "LOOKUPS_ERROR",
            requestId,
            payload: { message: err?.message || "Failed to fetch lookup values" }
          }, "*");
        });
    }
  });

  const originalFetch = window.fetch.bind(window);

  // Keep fetch interception for compatibility.
  window.fetch = async (...args) => {
    const [input, init = {}] = args;
    const url = typeof input === "string" ? input : input?.url;

    captureAuthHeaders(url, flattenHeaders(input, init));

    if (!shouldIntercept(url, rules)) return originalFetch(...args);

    try {
      const reqUrl = new URL(url, window.location.origin);
      const out = await runSharingsFlow(reqUrl, flattenHeaders(input, init), rules);
      emitTerritoryUsed(reqUrl.searchParams.get("TerritoryId"));
      emitFilteredBatch(summary(reqUrl, out));
      return jsonResponse(out.payload);
    } catch (err) {
      emitLog({ type: "fetch_hook_error", message: err?.message });
      return originalFetch(...args);
    }
  };

  // XHR interception (primary for Spacer).
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, async = true, user, password) {
    this.__pspacer_method = method;
    this.__pspacer_url = url;
    this.__pspacer_async = async !== false;
    this.__pspacer_headers = {};
    return originalOpen.call(this, method, url, async, user, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name, value) {
    this.__pspacer_headers ||= {};
    this.__pspacer_headers[String(name).toLowerCase()] = String(value);
    captureAuthHeaders(this.__pspacer_url, this.__pspacer_headers);
    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const method = String(this.__pspacer_method || "GET").toUpperCase();
    const rawUrl = this.__pspacer_url;

    if (!this.__pspacer_async || method !== "GET" || !shouldIntercept(rawUrl, rules)) {
      return originalSend.call(this, body);
    }

    const xhr = this;

    (async () => {
      try {
        const reqUrl = new URL(rawUrl, window.location.origin);
        const out = await runSharingsFlow(reqUrl, xhr.__pspacer_headers || {}, rules);
        const responseText = JSON.stringify(out.payload);
        patchXhrInstance(xhr, reqUrl.toString(), responseText);
        emitTerritoryUsed(reqUrl.searchParams.get("TerritoryId"));
        emitFilteredBatch(summary(reqUrl, out));
        dispatchXhrSuccess(xhr);
      } catch (err) {
        emitLog({ type: "xhr_hook_error", message: err?.message });
        try {
          originalSend.call(xhr, body);
        } catch (fallbackErr) {
          emitLog({ type: "xhr_fallback_error", message: fallbackErr?.message });
          dispatchXhrFailure(xhr);
        }
      }
    })();
  };

  async function fetchLookups() {
    let headers = { ...authHeadersCache, ...extractAuthHeadersFromStorage() };

    let [territoriesResp, parkingLotsResp] = await Promise.all([
      originalFetch("https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots?Territory=true", { credentials: "include", headers }),
      originalFetch("https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots", { credentials: "include", headers })
    ]);

    // Retry once after warming header cache from latest requests/storage.
    if (territoriesResp.status === 401 || parkingLotsResp.status === 401) {
      headers = { ...authHeadersCache, ...extractAuthHeadersFromStorage() };
      [territoriesResp, parkingLotsResp] = await Promise.all([
        originalFetch("https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots?Territory=true", { credentials: "include", headers }),
        originalFetch("https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots", { credentials: "include", headers })
      ]);
    }

    if (!territoriesResp.ok) {
      throw new Error(`ParkingLots?Territory=true failed: ${territoriesResp.status} ${territoriesResp.statusText}. Open sharing list once, then retry.`);
    }
    if (!parkingLotsResp.ok) {
      throw new Error(`ParkingLots failed: ${parkingLotsResp.status} ${parkingLotsResp.statusText}. Open sharing list once, then retry.`);
    }

    const territoriesRaw = await territoriesResp.json();
    const parkingLotsRaw = await parkingLotsResp.json();

    const territories = normalizeArray(territoriesRaw).map((item) => ({
      id: String(item.id ?? item.territoryId ?? ""),
      name: String(item.name ?? item.parkingSpaceName ?? item.title ?? item.id ?? "")
    })).filter((x) => x.id && x.name);

    const parkingLots = normalizeArray(parkingLotsRaw).map((item) => ({
      id: String(item.id ?? item.parkingLotId ?? ""),
      territoryId: String(item.parkingSpaceId ?? item.territoryId ?? ""),
      name: String(item.name ?? item.parkingLotName ?? item.title ?? item.id ?? "")
    })).filter((x) => x.id && x.name);

    return { territories, parkingLots };
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  function captureAuthHeaders(url, headers = {}) {
    if (!url || !String(url).includes("/api/private-")) return;

    const allowed = ["authorization", "x-api-key", "x-authorization", "x-client-id", "x-tenant-id"];
    for (const [k, v] of Object.entries(headers || {})) {
      const key = String(k).toLowerCase();
      if (!allowed.includes(key)) continue;
      if (v == null || v === "") continue;
      authHeadersCache[key] = String(v);
    }
  }

  function extractAuthHeadersFromStorage() {
    const out = {};

    const candidates = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        candidates.push(localStorage.getItem(key));
      }
    } catch (_) {}
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        candidates.push(sessionStorage.getItem(key));
      }
    } catch (_) {}

    const token = findBearerToken(candidates);
    if (token && !authHeadersCache.authorization) {
      out.authorization = `Bearer ${token}`;
    }

    return out;
  }

  function findBearerToken(values) {
    for (const raw of values) {
      if (!raw || typeof raw !== "string") continue;

      if (raw.startsWith("eyJ") && raw.split(".").length >= 3) return raw;

      try {
        const obj = JSON.parse(raw);
        const direct = obj?.access_token || obj?.accessToken || obj?.token || obj?.jwt;
        if (typeof direct === "string" && direct.startsWith("eyJ")) return direct;
      } catch (_) {}
    }
    return null;
  }

  function shouldIntercept(url = "", activeRules) {
    if (!activeRules?.enabled) return false;
    const pattern = activeRules?.urlPattern || "/AssignSharedSpace/Sharings?";
    if (!String(url).includes(pattern)) return false;

    const reqUrl = new URL(url, window.location.origin);
    const wanted = activeRules?.filter?.territoryId;
    const actual = reqUrl.searchParams.get("TerritoryId");
    return !wanted || !actual || wanted === actual;
  }

  async function runSharingsFlow(baseUrl, headersObj, activeRules) {
    const baseOffset = parseInt(baseUrl.searchParams.get("Offset") || "0", 10) || 0;
    const pageSize = Number(activeRules?.pageSize ?? 200);
    const maxFetchCycles = Number(activeRules?.maxFetchCycles ?? 10);
    const minItemCount = Number(activeRules?.minItemCount ?? 5);

    let root = null;
    let totalFetched = 0;
    const filteredItems = [];

    for (let fetchCycle = 0; fetchCycle < maxFetchCycles; fetchCycle++) {
      const offset = baseOffset + fetchCycle * pageSize;
      const nextUrl = new URL(baseUrl.toString());
      nextUrl.searchParams.set("Limit", String(pageSize));
      nextUrl.searchParams.set("Offset", String(offset));

      const resp = await originalFetch(nextUrl.toString(), {
        method: "GET",
        headers: { ...authHeadersCache, ...headersObj },
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
        if (matchesFilter(item, activeRules?.filter)) filteredItems.push(item);
      }

      if (filteredItems.length >= minItemCount) break;
    }

    const payload = { ...(root || {}), count: filteredItems.length, items: filteredItems };
    if (filteredItems.length === 0) payload.nextOffset = 0;

    return { payload, filteredItems, totalFetched };
  }

  function matchesFilter(item, filter = {}) {
    const parkingSpaceName = String(item?.parkingSpaceName ?? "");
    const parkingLotId = String(item?.parkingLotId ?? "");

    if (filter?.parkingName && !parkingSpaceName.toLowerCase().includes(String(filter.parkingName).toLowerCase())) return false;
    if (filter?.parkingLotId && parkingLotId !== String(filter.parkingLotId)) return false;

    return true;
  }

  function flattenHeaders(input, init) {
    const output = {};
    const append = (headersLike) => {
      if (!headersLike) return;
      const h = new Headers(headersLike);
      h.forEach((value, key) => (output[key] = value));
    };
    if (input instanceof Request) append(input.headers);
    append(init?.headers);
    return output;
  }

  function patchXhrInstance(xhr, responseURL, body) {
    const state = {
      readyState: 4,
      status: 200,
      statusText: "OK",
      responseText: body,
      response: body,
      responseURL
    };

    defineGetter(xhr, "readyState", () => state.readyState);
    defineGetter(xhr, "status", () => state.status);
    defineGetter(xhr, "statusText", () => state.statusText);
    defineGetter(xhr, "responseText", () => state.responseText);
    defineGetter(xhr, "response", () => state.response);
    defineGetter(xhr, "responseURL", () => state.responseURL);
  }

  function defineGetter(obj, prop, getter) {
    try {
      Object.defineProperty(obj, prop, { configurable: true, get: getter });
    } catch (_) {
      // ignore: best effort
    }
  }

  function dispatchXhrSuccess(xhr) {
    trigger(xhr, "readystatechange");
    trigger(xhr, "load");
    trigger(xhr, "loadend");
  }

  function dispatchXhrFailure(xhr) {
    trigger(xhr, "readystatechange");
    trigger(xhr, "error");
    trigger(xhr, "loadend");
  }

  function trigger(xhr, type) {
    const handler = xhr[`on${type}`];
    try {
      if (typeof handler === "function") handler.call(xhr, new Event(type));
    } catch (_) {}
    try {
      xhr.dispatchEvent(new Event(type));
    } catch (_) {}
  }

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  function summary(reqUrl, out) {
    return {
      endpoint: reqUrl.toString(),
      total: out.totalFetched,
      kept: out.filteredItems.length,
      dropped: out.totalFetched - out.filteredItems.length,
      sample: out.filteredItems.slice(0, 5)
    };
  }

  function requestRules() {
    window.postMessage({ source: SOURCE, type: "REQUEST_RULES" }, "*");
  }

  function emitTerritoryUsed(territoryId) {
    if (!territoryId) return;
    window.postMessage({ source: SOURCE, type: "TERRITORY_USED", payload: { territoryId } }, "*");
  }

  function emitFilteredBatch(payload) {
    window.postMessage({ source: SOURCE, type: "FILTERED_LISTING_BATCH", payload }, "*");
  }

  function emitLog(payload) {
    window.postMessage({ source: SOURCE, type: "LOG", payload }, "*");
  }
})();
