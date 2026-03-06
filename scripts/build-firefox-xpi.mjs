import { access, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const sourceDir = path.join(root, "dist", "firefox");
const outPath = path.join(root, "dist", "pspacer-companion-firefox.xpi");

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

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCmd,
  [
    "--yes",
    "web-ext",
    "build",
    "-s",
    sourceDir,
    "-a",
    path.dirname(outPath),
    "-n",
    path.basename(outPath),
    "--overwrite-dest"
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Created dist/pspacer-companion-firefox.xpi");
