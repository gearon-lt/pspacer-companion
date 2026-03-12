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

- Firefox desktop `>= 140.0`
- Firefox for Android `>= 142.0`
- Chrome / Chromium - supported, but not published to Google yet (see `DEVELOPERS.md` for details).

## Firefox listing (AMO)

The extension is published on Mozilla Add-ons (listed):

- https://addons.mozilla.org/en-US/firefox/addon/pspacer-companion/

Install flow for end users:

```text
1. Open the AMO page
2. Click Add to Firefox
3. Confirm requested permissions
```

If Firefox version is below the minimum, AMO/install prompt may show incompatibility.

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

## Troubleshooting

- For Chrome developer/local installation, see `DEVELOPERS.md`.
- If Firefox says add-on is incompatible, confirm your Firefox version matches the minimum in this README.
- If behavior breaks after Spacer frontend updates, report it with page URL + console logs.
- For developer/local installation steps, use `DEVELOPERS.md`.
