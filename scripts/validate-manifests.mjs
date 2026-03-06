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

for (const file of manifestFiles) {
  const manifestPath = path.join(root, file);
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);

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

    console.log(`${file}: OK`);
  } catch (err) {
    hasFailure = true;
    console.error(`${file}: ${err.message}`);
  }
}

if (hasFailure) process.exit(1);

