import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
async function loadPureModule(path) {
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
}
const { stageArtwork } = await loadPureModule("src/entities/game/artworks.ts");
const { PALETTE } = await loadPureModule("src/entities/game/palette.ts");
if (process.env.CAT_ART_DATA)
  writeFileSync(
    process.env.CAT_ART_DATA,
    JSON.stringify({
      palette: PALETTE,
      stages: Array.from({ length: 100 }, (_, i) => stageArtwork(i + 1)),
    }),
  );
const tiles = Array.from({ length: 100 }, (_, i) => {
  const stage = stageArtwork(i + 1);
  return `<figure><svg viewBox="-1 -1 28 28" role="img" aria-label="${stage.name}">${stage.pixels.map((p) => `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="${PALETTE[p.color]}"/>`).join("")}</svg><figcaption>${i + 1}. ${stage.name}</figcaption></figure>`;
}).join("");
writeFileSync(
  "docs/research/stage-art-gallery.html",
  `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Cat Atelier · 100 stage artwork maps</title><style>body{margin:24px;background:#f6f1e8;color:#393544;font:14px system-ui}main{display:grid;grid-template-columns:repeat(10,1fr);gap:12px}figure{margin:0;padding:8px;background:#fffaf3;border-radius:12px}svg{display:block;width:100%;image-rendering:pixelated}figcaption{text-align:center;font-size:11px}h1{font-size:22px}</style><h1>100 stages · 20 original characters & foods × 5 themes</h1><p>도안의 윤곽·얼굴·속재료 색상은 모든 난이도에서 보존합니다.</p><main>${tiles}</main></html>`,
);
console.log("Generated docs/research/stage-art-gallery.html");
