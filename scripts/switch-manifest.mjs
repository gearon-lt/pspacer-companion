import { copyFile } from "node:fs/promises";
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

await copyFile(sourcePath, manifestPath);
console.log(`Copied ${path.basename(sourcePath)} -> manifest.json`);

