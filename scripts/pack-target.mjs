import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const target = (process.argv[2] || "").toLowerCase();
const allowedTargets = new Set(["chrome", "firefox"]);

if (!allowedTargets.has(target)) {
  console.error("Usage: node scripts/pack-target.mjs <chrome|firefox>");
  process.exit(1);
}

const distRoot = path.join(root, "dist");
const outDir = path.join(distRoot, target);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const entry of ["assets", "src"]) {
  await cp(path.join(root, entry), path.join(outDir, entry), { recursive: true });
}

await copyFile(path.join(root, `manifest.${target}.json`), path.join(outDir, "manifest.json"));

console.log(`Packed ${target} extension into dist/${target}`);

