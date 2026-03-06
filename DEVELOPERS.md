# Developer Guide

This guide contains developer-facing workflows for `pspacer-companion`.

For end-user installation and feature overview, see `README.md`.

## Prerequisites

- Node.js (current project workflows use npm scripts)
- A local clone of this repository

## Project layout

- `manifest.json` (active manifest used by browsers when loading root folder)
- `manifest.chrome.json` (Chrome target manifest)
- `manifest.firefox.json` (Firefox target manifest)
- `scripts/switch-manifest.mjs` (copies target manifest to `manifest.json`)
- `scripts/validate-manifests.mjs` (checks manifest validity)
- `scripts/pack-target.mjs` (builds browser-specific output under `dist/`)
- `scripts/build-firefox-xpi.mjs` (builds unsigned Firefox XPI)
- `src/background/service-worker.js`
- `src/content/content.js`
- `src/injected/page-hook.js`
- `src/popup/popup.html`
- `src/popup/popup.js`
- `src/styles/overlay.css`

## Key npm scripts

- `npm run use:chrome` - set active manifest to Chrome
- `npm run use:firefox` - set active manifest to Firefox
- `npm run validate` - validate manifests
- `npm run pack:chrome` - build `dist/chrome`
- `npm run pack:firefox` - build `dist/firefox`
- `npm run pack` - build both targets
- `npm run xpi:firefox` - build unsigned Firefox XPI (local packaging; no AMO credentials required)
- `npm run sign:firefox` - default Firefox signing flow (listed)
- `npm run sign:firefox:listed` - submit/sign for AMO listed distribution
- `npm run sign:firefox:unlisted` - submit/sign for AMO unlisted distribution

## Environment settings for Firefox packaging

- `npm run xpi:firefox` only creates an unsigned local XPI via `scripts/build-firefox-xpi.mjs`.
- No special env vars are required for `npm run xpi:firefox`.
- If you later run `npm run sign:firefox`, you must set AMO signing credentials:
  - `WEB_EXT_API_KEY`
  - `WEB_EXT_API_SECRET`
- In restricted corporate networks, signing may also require proxy env vars:
  - `HTTP_PROXY`
  - `HTTPS_PROXY`

## Common workflow

1. Update code in `src/`.
2. Validate manifests.
3. Build target artifacts.
4. Load from `dist/chrome/` or `dist/firefox/` in browser dev pages.

Example commands:

```bash
cd /path/to/pspacer-companion
npm run validate
npm run pack:chrome
npm run pack:firefox
npm run xpi:firefox
```

## Listed AMO workflow (CLI)

1. Ensure your add-on exists in AMO listed track and metadata is configured in AMO UI.
2. Bump extension version in manifests/package.
3. Export AMO credentials.
4. Run listed signing script.
5. Monitor AMO review state in Developer Hub.

Example commands:

```bash
cd /path/to/pspacer-companion
export WEB_EXT_API_KEY="<amo-jwt-issuer>"
export WEB_EXT_API_SECRET="<amo-jwt-secret>"
npm run sign:firefox:listed
```

## Browser-specific notes

- Firefox package uses `background.scripts` in `manifest.firefox.json`.
- Chrome package uses `background.service_worker` in `manifest.chrome.json`.
- Version should be bumped consistently across:
  - `package.json`
  - `manifest.json`
  - `manifest.chrome.json`
  - `manifest.firefox.json`

## Debugging pointers

- Cross-context interception and messaging:
  - `src/injected/page-hook.js`
  - `src/content/content.js`
- Popup storage/rules UI:
  - `src/popup/popup.js`
- Background message handling:
  - `src/background/service-worker.js`
