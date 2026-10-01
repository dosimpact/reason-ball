import type Phaser from "phaser";
import { PALETTE, type ColorId } from "../../entities/game";
type Point = { x: number; y: number };

// One atlas shared by every block and all 24 pooled cats. Vector paths run only at boot.
export function createAtlas(scene: Phaser.Scene) {
  const atlas = scene.textures.createCanvas("cat-atlas", 512, 256)!;
  const ctx = atlas.context;
  let index = 0;
  const frame = (name: string, paint: () => void) => {
    const x = (index % 16) * 32,
      y = Math.floor(index / 16) * 32;
    ctx.save();
    ctx.translate(x, y);
    paint();
    ctx.restore();
    atlas.add(name, 0, x, y, 32, 32);
    index++;
  };
  for (const color of Object.keys(PALETTE) as ColorId[]) {
    for (const exposed of [false, true])
      frame(`block-${color}-${exposed}`, () => {
        drawBlock(ctx, 0, 0, 30, PALETTE[color]);
        if (exposed) {
          ctx.fillStyle = "#364435";
          ctx.strokeStyle = "#fffaf3";
          ctx.lineWidth = 3;
          ctx.strokeRect(1.5, 1.5, 27, 27);
          ctx.fillStyle = "#fffef6";
          ctx.strokeStyle = "#393544";
          ctx.lineWidth = 1;
          ctx.strokeRect(1.5, 1.5, 27, 27);
        }
      });
    for (let step = 0; step < 3; step++)
      frame(`cat-${color}-${step}`, () => {
        ctx.translate(16, 16);
        drawCat(ctx, PALETTE[color], [0, -1.3, 1.3][step], 1);
      });
  }
  atlas.refresh();
}

export function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.strokeStyle = "#b78b5355";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(width * 0.1, height * 0.79);
  ctx.lineTo(width * 0.9, height * 0.79);
  for (let slot = 0; slot < 5; slot++) {
    const x = width * (0.1 + 0.2 * slot),
      approach = slot === 2 ? Math.min(width * 0.9, width / 2 + 35) : x;
    ctx.moveTo(x, height);
    ctx.lineTo(approach, height);
    ctx.lineTo(approach, height * 0.79);
  }
  ctx.stroke();
  drawTray(ctx, width, height);
  drawHole(ctx, { x: width / 2, y: height * 0.885 }, false);
}

function drawTray(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#ad83502b";
  ctx.beginPath();
  ctx.roundRect(1, 3, width - 2, height * 0.77, 17);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.roundRect(1, 0, width - 2, height * 0.77, 17);
  ctx.fill();
  ctx.strokeStyle = "#ffffffbd";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#eae4d7";
  ctx.beginPath();
  ctx.roundRect(8, 7, width - 16, height * 0.77 - 15, 12);
  ctx.fill();
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = "#27262030";
  ctx.fillRect(x + 0.7, y + 1.8, size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, Math.min(1.8, size * 0.16));
  ctx.fill();
  ctx.fillStyle = "#ffffff66";
  ctx.fillRect(
    x + 1,
    y + 0.7,
    Math.max(1, size - 2),
    Math.min(1.5, size * 0.16),
  );
  ctx.fillStyle = "#00000016";
  ctx.fillRect(x + 0.7, y + size - 1.5, Math.max(1, size - 1.4), 1.3);
}

function drawHole(
  ctx: CanvasRenderingContext2D,
  hole: Point,
  collecting: boolean,
) {
  for (const [dy, rx, ry, color] of [
    [3, 25, 13, "#f5d8ae"],
    [0, 23, 12, "#b0825f"],
    [-1, 19, 9, "#624735"],
    [1, 15, 6, "#392b23"],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "600 9px system-ui, sans-serif";
  ctx.fillStyle = "#624c34";
  ctx.textAlign = "center";
  ctx.fillText(
    collecting ? "집으로 운반 중" : "고양이의 집",
    hole.x,
    hole.y + 27,
  );
}

function drawCat(
  ctx: CanvasRenderingContext2D,
  color: string,
  stride: number,
  direction: number,
) {
  ctx.strokeStyle = "#493d34";
  ctx.lineWidth = 1;
  // A curled tail and four paws give the tiny silhouette feline proportions.
  ctx.beginPath();
  ctx.moveTo(direction * 5, 5);
  ctx.bezierCurveTo(
    direction * 13,
    8,
    direction * 12,
    -2 + stride,
    direction * 8,
    0,
  );
  ctx.lineWidth = 2.7;
  ctx.stroke();
  ctx.lineWidth = 0.9;
  ctx.fillStyle = "#fff6df";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 4.2, 8 + stride * side, 2.2, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 3, 6.2, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff6df";
  ctx.beginPath();
  ctx.moveTo(-6.2, -4);
  ctx.lineTo(-6, -11);
  ctx.lineTo(-1.8, -7);
  ctx.lineTo(1.8, -7);
  ctx.lineTo(6, -11);
  ctx.lineTo(6.2, -4);
  ctx.bezierCurveTo(8, 4, -8, 4, -6.2, -4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d99388";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 5.2, -8.6);
    ctx.lineTo(side * 3.1, -6.5);
    ctx.lineTo(side * 5.3, -5.9);
    ctx.fill();
  }
  ctx.fillStyle = "#392f2b";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 2.7, -3.5, 0.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#bb766d";
  ctx.beginPath();
  ctx.moveTo(-1, -1.6);
  ctx.lineTo(1, -1.6);
  ctx.lineTo(0, -0.6);
  ctx.fill();
  ctx.lineWidth = 0.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 4, -1);
    ctx.lineTo(side * 8, -2);
    ctx.moveTo(side * 4, 0);
    ctx.lineTo(side * 8, 1);
    ctx.stroke();
  }
}
