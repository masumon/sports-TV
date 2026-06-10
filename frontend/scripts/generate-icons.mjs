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

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const darkBg = { r: 8, g: 10, b: 17, alpha: 1 };

  const sizes = [
    { name: "icon-192.png", size: 192, padding: 0.08, bg: transparent },
    { name: "icon-512.png", size: 512, padding: 0.08, bg: transparent },
    { name: "icon-maskable-512.png", size: 512, padding: 0.15, bg: darkBg },
    { name: "abo-sports-tv-logo.png", size: 256, padding: 0.04, bg: transparent },
    { name: "apple-touch-icon.png", size: 180, padding: 0.1, bg: darkBg },
    { name: "og-image.png", size: 1200, padding: 0.22, bg: darkBg, width: 1200, height: 630 },
  ];

  for (const { name, size, padding = 0.08, bg = transparent, width, height } of sizes) {
    const outW = width ?? size;
    const outH = height ?? size;
    const inner = Math.round(Math.min(outW, outH) * (1 - padding * 2));
    const padX = Math.round((outW - inner) / 2);
    const padY = Math.round((outH - inner) / 2);

    const buf = await sharp(svg)
      .resize(inner, inner, { fit: "contain", background: bg })
      .extend({
        top: padY,
        bottom: outH - inner - padY,
        left: padX,
        right: outW - inner - padX,
        background: bg,
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
