#!/usr/bin/env node
// Postinstall: download the platform-matching lazyvec binary from GitHub Releases
// (tagged v<package.json#version>), verify the SHA256 from SHA256SUMS.txt, and
// drop it into bin/.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");
const zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");

const REPO = "armgabrielyan/lazyvec";
const pkg = require("./package.json");
const version = pkg.version;

const targetMap = {
  "darwin-x64": { target: "darwin-x64", ext: "tar.gz", exe: "lazyvec" },
  "darwin-arm64": { target: "darwin-arm64", ext: "tar.gz", exe: "lazyvec" },
  "linux-x64": { target: "linux-x64", ext: "tar.gz", exe: "lazyvec" },
  "linux-arm64": { target: "linux-arm64", ext: "tar.gz", exe: "lazyvec" },
  "win32-x64": { target: "windows-x64", ext: "zip", exe: "lazyvec.exe" },
};

const key = `${process.platform}-${process.arch}`;
const entry = targetMap[key];
if (!entry) {
  console.error(`lazyvec: unsupported platform/arch "${key}". Falling back to "npx lazyvec" is not possible — please install from source: https://github.com/${REPO}`);
  process.exit(1);
}

const archiveName = `lazyvec-${version}-${entry.target}.${entry.ext}`;
const baseUrl = `https://github.com/${REPO}/releases/download/v${version}`;
const archiveUrl = `${baseUrl}/${archiveName}`;
const sumsUrl = `${baseUrl}/SHA256SUMS.txt`;

const binDir = path.join(__dirname, "bin");
fs.mkdirSync(binDir, { recursive: true });

async function main() {
  const [archiveBuf, sumsText] = await Promise.all([
    fetch(archiveUrl),
    fetch(sumsUrl).then((buf) => buf.toString("utf8")),
  ]);

  const sumLine = sumsText.split(/\r?\n/).find((line) => line.endsWith(" " + archiveName));
  if (!sumLine) {
    throw new Error(`SHA256 for ${archiveName} not found in SHA256SUMS.txt`);
  }
  const expected = sumLine.split(/\s+/)[0];
  const actual = crypto.createHash("sha256").update(archiveBuf).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${archiveName}: expected ${expected}, got ${actual}`);
  }

  const target = path.join(binDir, entry.exe);
  if (entry.ext === "tar.gz") {
    extractTarGz(archiveBuf, binDir, entry.exe);
  } else {
    extractZipEntry(archiveBuf, binDir, entry.exe);
  }
  fs.chmodSync(target, 0o755);

  console.log(`lazyvec ${version} installed at ${target}`);
}

function fetch(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (redirects <= 0) return reject(new Error(`Too many redirects fetching ${url}`));
        return resolve(fetch(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GET ${url} → ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function extractTarGz(buf, destDir, wantedFile) {
  const tarPath = path.join(destDir, "__lazyvec_archive.tar.gz");
  fs.writeFileSync(tarPath, buf);
  try {
    execFileSync("tar", ["-xzf", tarPath, "-C", destDir, wantedFile], { stdio: "inherit" });
  } finally {
    fs.unlinkSync(tarPath);
  }
}

function extractZipEntry(buf, destDir, wantedFile) {
  // Minimal zip parser that finds `wantedFile` in the central directory and
  // inflates it. Keeps this script dependency-free.
  const eocdIndex = findEndOfCentralDirectory(buf);
  if (eocdIndex === -1) throw new Error("Zip end-of-central-directory not found");
  const cdOffset = buf.readUInt32LE(eocdIndex + 16);
  const cdSize = buf.readUInt32LE(eocdIndex + 12);
  const cd = buf.subarray(cdOffset, cdOffset + cdSize);

  let pos = 0;
  while (pos < cd.length) {
    if (cd.readUInt32LE(pos) !== 0x02014b50) throw new Error("Zip central directory corrupt");
    const nameLen = cd.readUInt16LE(pos + 28);
    const extraLen = cd.readUInt16LE(pos + 30);
    const commentLen = cd.readUInt16LE(pos + 32);
    const localHeaderOffset = cd.readUInt32LE(pos + 42);
    const fileName = cd.subarray(pos + 46, pos + 46 + nameLen).toString("utf8");

    if (fileName === wantedFile) {
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSize = buf.readUInt32LE(localHeaderOffset + 18);
      const compressionMethod = buf.readUInt16LE(localHeaderOffset + 8);
      const compressed = buf.subarray(dataStart, dataStart + compressedSize);
      const data = compressionMethod === 0
        ? compressed
        : zlib.inflateRawSync(compressed);
      fs.writeFileSync(path.join(destDir, wantedFile), data);
      return;
    }

    pos += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error(`${wantedFile} not found in zip archive`);
}

function findEndOfCentralDirectory(buf) {
  // EOCD signature 0x06054b50 at most 22+65535 bytes from the end.
  const min = Math.max(0, buf.length - (22 + 65535));
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

main().catch((err) => {
  console.error("lazyvec postinstall failed:", err.message);
  console.error("Install from source instead: https://github.com/" + REPO);
  process.exit(1);
});
