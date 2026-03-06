# pspacer-companion

MV3 browser extension that enhances `spacer.click` sharings filtering directly in the browser.

Developer workflow, build scripts, and project internals are in `DEVELOPERS.md`.

## What it does

- Intercepts Sharings API requests (`/AssignSharedSpace/Sharings?`)
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

## Browser support

- Chrome / Chromium
- Firefox desktop `>= 140.0`
- Firefox for Android `>= 142.0`

## In-page filters (on Spacer form)

The extension injects extra controls below territory:

1. **Actual parking lot**
   - Dynamic options from Spacer API
   - Scoped to currently selected territory
   - Default: `Any`

2. **Parking name**
   - Presets only: `Any`, `El.`, `El.stotelė`, `El.lizdas`

Changing parking lot or parking name updates extension rules and triggers Spacer shared-spaces fetch.

## Popup settings

The popup controls:

- Enable filtering
- Page size
- Max cycles
- Min matched items

Territory / parking lot / parking name are configured on the Spacer page itself.

## Install in Chrome (developer mode)

```text
1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select this folder: pspacer-companion/
```

If extension installs are blocked by enterprise policy, ask IT to allowlist/forcelist the extension.

## Install in Firefox (temporary)

```text
1. Build Firefox artifact: npm run pack:firefox
2. Open about:debugging#/runtime/this-firefox
3. Click Load Temporary Add-on
4. Select dist/firefox/manifest.json
```

Temporary Firefox add-ons are removed when Firefox restarts.

## Troubleshooting

- If Chrome says installation is blocked by policy, check browser policy (`chrome://policy`) and contact IT.
- If Firefox says add-on is incompatible, confirm your Firefox version matches the minimum in this README.
- If behavior breaks after Spacer frontend updates, report it with page URL + console logs.
