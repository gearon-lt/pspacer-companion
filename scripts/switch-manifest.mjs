import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const target = (process.argv[2] || "").toLowerCase();

if (!target || !["chrome", "firefox"].includes(target)) {
  console.error("Usage: node scripts/switch-manifest.mjs <chrome|firefox>");
  process.exit(1);
}

const sourcePath = path.join(root, `manifest.${target}.json`);
const manifestPath = path.join(root, "manifest.json");
const packageJsonPath = path.join(root, "package.json");

const pkg = JSON.parse(await readFile(packageJsonPath, "utf8"));
const sourceManifest = JSON.parse(await readFile(sourcePath, "utf8"));
sourceManifest.version = pkg.version;

await writeFile(manifestPath, `${JSON.stringify(sourceManifest, null, 2)}\n`, "utf8");
console.log(`Generated manifest.json from ${path.basename(sourcePath)} (version ${pkg.version})`);

