#!/usr/bin/env node
/** Generate PWA PNG icons from SVG for Android/iOS install. */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const iconsDir = join(root, "public", "icons");
const svgPath = join(iconsDir, "abo-logo.svg");

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.warn("sharp not installed — skip PNG generation");
    process.exit(0);
  }

  const svg = readFileSync(svgPath);
  mkdirSync(iconsDir, { recursive: true });

  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "icon-maskable-512.png", size: 512, padding: 0.15 },
    { name: "abo-sports-tv-logo.png", size: 256 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  for (const { name, size, padding = 0.08 } of sizes) {
    const inner = Math.round(size * (1 - padding * 2));
    const buf = await sharp(svg)
      .resize(inner, inner, { fit: "contain", background: { r: 8, g: 10, b: 17, alpha: 1 } })
      .extend({
        top: Math.round(size * padding),
        bottom: Math.round(size * padding),
        left: Math.round(size * padding),
        right: Math.round(size * padding),
        background: { r: 8, g: 10, b: 17, alpha: 1 },
      })
      .png()
      .toBuffer();
    writeFileSync(join(iconsDir, name), buf);
    console.log("wrote", name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
