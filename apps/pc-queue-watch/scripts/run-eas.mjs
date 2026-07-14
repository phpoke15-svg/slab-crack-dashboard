#!/usr/bin/env node
/**
 * Cross-platform EAS runner for the CollecTools Expo app.
 *
 * Always cds to apps/pc-queue-watch (this script's parent), so
 * `eas submit` / `eas build` work from the monorepo root or any cwd.
 * Also silences Node's harmless DEP0040 (punycode) warning from eas-cli
 * without Unix-only `NODE_OPTIONS='...'` shell syntax (breaks on Windows cmd).
 *
 * Usage:
 *   node apps/pc-queue-watch/scripts/run-eas.mjs submit -p android --profile production
 *   node apps/pc-queue-watch/scripts/run-eas.mjs build -p android --profile apk
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-eas.mjs <eas-args...>");
  console.error("Example: node scripts/run-eas.mjs submit -p android --profile production");
  process.exit(1);
}

for (const required of ["app.json", "eas.json", "package.json"]) {
  if (!fs.existsSync(path.join(appDir, required))) {
    console.error(`Missing ${required} in ${appDir}`);
    console.error("Run this from the CollecTools repo (apps/pc-queue-watch).");
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(appDir, "node_modules", "expo"))) {
  console.error(`Expo dependencies are not installed in ${appDir}`);
  console.error("Run: cd apps/pc-queue-watch && npm install");
  process.exit(1);
}

process.chdir(appDir);

const existing = process.env.NODE_OPTIONS?.trim() ?? "";
if (!existing.includes("DEP0040")) {
  process.env.NODE_OPTIONS = [existing, "--disable-warning=DEP0040"]
    .filter(Boolean)
    .join(" ");
}

const child = spawn("npx", ["--yes", "eas-cli", ...args], {
  cwd: appDir,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
