#!/usr/bin/env node
// Shim that execs the downloaded lazyvec binary.
// The postinstall script (install.js) places the binary at bin/lazyvec (or bin/lazyvec.exe on Windows).

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const isWindows = process.platform === "win32";
const binaryPath = path.join(__dirname, isWindows ? "lazyvec.exe" : "lazyvec");

if (!fs.existsSync(binaryPath)) {
  console.error(
    "lazyvec binary was not found. The postinstall step may have failed.\n" +
    "Try reinstalling: npm install -g lazyvec\n" +
    "Or install directly: curl -sSf https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/install.sh | sh",
  );
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
