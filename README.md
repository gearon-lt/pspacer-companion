# pspacer-companion

MV3 Chrome extension that enhances `spacer.click` sharings filtering directly in the browser.

## Current state

This project now ports the important behavior from the Java Playwright app into a Chrome extension:

- Intercepts Sharings API requests (`/AssignSharedSpace/Sharings?`) in page context
- Supports both `fetch` and `XMLHttpRequest` interception paths
- Replays additional API calls (`Limit`/`Offset`) with:
  - `pageSize`
  - `maxFetchCycles`
  - `minItemCount`
- Filters results by:
  - selected territory
  - selected parking lot
  - selected parking name preset
- Rewrites Sharings response payload returned to Spacer UI
- Shows compact debug overlay (Total / Kept / Dropped)

## In-page filters (on Spacer form)

The extension injects extra controls below territory:

1. **Actual parking lot**
   - Dynamic options from Spacer API
   - Scoped to currently selected territory
   - Includes `Any`

2. **Parking name**
   - Presets only: `Any`, `El.`, `El.stotelė`, `El.lizdas`

Changing parking lot or parking name updates extension rules and triggers Spacer shared-spaces fetch via page-context React method invocation.

## Extension popup

Popup is now for core engine settings only:

- Enable filtering
- Page size
- Max cycles
- Min matched items

Territory / lot / parking name are configured on the Spacer page itself.

## Install / run (developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `pspacer-companion/`
5. Open `https://spacer.click`
6. Reload the tab after extension updates

## Notes

- Extension icon uses Spacer mark-only graphics generated to PNG set (`16/32/48/128`).
- If behavior breaks after Spacer frontend updates, check:
  - `src/injected/page-hook.js` (network interception + fetch trigger)
  - `src/content/content.js` (in-page controls + rule sync)

## Project structure

- `manifest.json`
- `assets/icons/*`
- `src/background/service-worker.js`
- `src/content/content.js`
- `src/injected/page-hook.js`
- `src/popup/popup.html`
- `src/popup/popup.js`
- `src/styles/overlay.css`
