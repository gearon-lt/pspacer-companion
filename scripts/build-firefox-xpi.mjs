import { access, rm, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const sourceDir = path.join(root, "dist", "firefox");
const outPath = path.join(root, "dist", "pspacer-companion-firefox.xpi");
const zipOutPath = path.join(root, "dist", "pspacer-companion-firefox.zip");

async function ensureSourceExists() {
  try {
    await access(path.join(sourceDir, "manifest.json"));
  } catch {
    console.error("dist/firefox is missing. Run: npm run pack:firefox");
    process.exit(1);
  }
}

await ensureSourceExists();
await rm(outPath, { force: true });
await rm(zipOutPath, { force: true });

const escapedSource = sourceDir.replace(/'/g, "''");
const escapedZipOut = zipOutPath.replace(/'/g, "''");

const command = [
  "$ErrorActionPreference = 'Stop'",
  `Compress-Archive -Path '${escapedSource}\\*' -DestinationPath '${escapedZipOut}' -CompressionLevel Optimal`
].join("; ");

const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

await rename(zipOutPath, outPath);
console.log("Created dist/pspacer-companion-firefox.xpi");
