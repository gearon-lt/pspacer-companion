# pspacer-companion

MV3 Chrome extension skeleton for in-browser interception/filtering of Spacer listing API payloads.

## What this skeleton does

- Injects a page-context hook into `spacer.click`
- Intercepts both `fetch` and `XMLHttpRequest` JSON responses for candidate listing endpoints
- Applies sample filter rules
- Shows a small on-page debug overlay with totals (kept/dropped)
- Stores rules in `chrome.storage.sync` via popup

## What this skeleton intentionally does NOT do yet

- Rewrite API response body consumed by the native app UI
- Patch React state/store directly
- Handle auth renewal / anti-bot protections
- Guarantee schema compatibility (you must adapt extraction paths)

## Load locally (developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `pspacer-companion/`
5. Open `https://spacer.click`
6. Open extension popup to set rules, then reload the page

## Project structure

- `manifest.json`
- `src/background/service-worker.js`
- `src/content/content.js`
- `src/injected/page-hook.js`
- `src/popup/popup.html`
- `src/popup/popup.js`
- `src/styles/overlay.css`

## Next implementation steps

1. Map real Spacer API endpoints and payload paths in `API_PATTERNS` + `extractListings()`.
2. Add robust rule model (vehicle types, time windows, district allowlist, etc.).
3. Decide UX model:
   - **Overlay-only** (safer, low coupling), or
   - **In-place filtering** (rewrite response / patch app store).
4. Add telemetry guardrails:
   - no raw tokens in logs,
   - optional redaction,
   - enterprise policy toggles.
5. Package/sign for enterprise deployment and publish internal install docs.

## Enterprise readiness checklist

- Keep permissions minimal (`storage` + precise `host_permissions`)
- Avoid remote code execution/dynamic eval
- Document data flow for IT review
- Add versioned changelog and rollback package
- Optionally support policy-managed config (managed storage)
