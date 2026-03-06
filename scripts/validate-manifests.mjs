import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const manifestFiles = [
  "manifest.json",
  "manifest.chrome.json",
  "manifest.firefox.json"
];

let hasFailure = false;
const parsedByFile = new Map();

for (const file of manifestFiles) {
  const manifestPath = path.join(root, file);
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    parsedByFile.set(file, parsed);

    const requiredTopLevelKeys = ["manifest_version", "name", "version", "background"];
    const missing = requiredTopLevelKeys.filter((k) => !(k in parsed));

    if (missing.length > 0) {
      hasFailure = true;
      console.error(`${file}: missing keys -> ${missing.join(", ")}`);
      continue;
    }

    if (parsed.manifest_version !== 3) {
      hasFailure = true;
      console.error(`${file}: expected manifest_version to be 3, got ${parsed.manifest_version}`);
      continue;
    }

    const hasServiceWorker = Boolean(parsed.background?.service_worker);
    const hasBackgroundScripts = Array.isArray(parsed.background?.scripts) && parsed.background.scripts.length > 0;

    if (!hasServiceWorker && !hasBackgroundScripts) {
      hasFailure = true;
      console.error(`${file}: background must define service_worker or scripts`);
      continue;
    }

    if (file === "manifest.chrome.json" && !hasServiceWorker) {
      hasFailure = true;
      console.error(`${file}: Chrome build must use background.service_worker`);
      continue;
    }

    if (file === "manifest.firefox.json") {
      if (!hasBackgroundScripts) {
        hasFailure = true;
        console.error(`${file}: Firefox build must use background.scripts`);
        continue;
      }

      const gecko = parsed.browser_specific_settings?.gecko;
      if (!gecko?.id) {
        hasFailure = true;
        console.error(`${file}: missing browser_specific_settings.gecko.id`);
        continue;
      }
    }

    console.log(`${file}: OK`);
  } catch (err) {
    hasFailure = true;
    console.error(`${file}: ${err.message}`);
  }
}

const manifests = [...parsedByFile.values()];
if (manifests.length === manifestFiles.length) {
  const versions = new Set(manifests.map((m) => m.version));
  if (versions.size !== 1) {
    hasFailure = true;
    console.error(`Version mismatch across manifests: ${[...versions].join(", ")}`);
  }

  const names = new Set(manifests.map((m) => m.name));
  if (names.size !== 1) {
    hasFailure = true;
    console.error(`Name mismatch across manifests: ${[...names].join(", ")}`);
  }
}

if (hasFailure) process.exit(1);

