// PWA manifest icons (public/icons/icon-{192,512}x{192,512}.png) を生成する。
// 実行: npx --yes --package=sharp@^0.33 -- node scripts/generate-pwa-icons.mjs
// ロゴ素材が固まったら同じ出力パスで上書きすること。
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const OUT_DIR = "public/icons";
const BG = "#6366f1"; // theme_color と一致 (manifest.json)
const FG = "#ffffff";
const TEXT = "DT";

async function generate(size) {
  const fontSize = Math.round(size * 0.55);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" ry="${Math.round(size * 0.18)}" fill="${BG}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
    font-family="Arial Black, Arial, sans-serif"
    font-size="${fontSize}" font-weight="900" fill="${FG}">${TEXT}</text>
</svg>`;
  const out = `${OUT_DIR}/icon-${size}x${size}.png`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`generated ${out}`);
}

await mkdir(OUT_DIR, { recursive: true });
await generate(192);
await generate(512);
