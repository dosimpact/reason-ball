import Phaser from "phaser";
import {
  exposedIds,
  MAX_ACTIVE_ANTS,
  type GameState,
  type Pixel,
} from "../../entities/game";
import { catPaths, walkPosition } from "./walking-path";
import { createAtlas, paintBackdrop } from "./texture-art";

type Frame = { state: GameState; reducedMotion: boolean; animate: boolean };
type Update = (now: number, delta: number) => Frame;
type Layout = { cell: number; ox: number; oy: number };

/** Phaser owns the only animation loop. React owns the surrounding accessible controls. */
export function createRenderer(host: HTMLDivElement, update: Update) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => ({
    width: Math.max(1, Math.round(host.clientWidth * dpr)),
    height: Math.max(1, Math.round(host.clientHeight * dpr)),
  });
  const scene = new CatScene(update, dpr);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    ...size(),
    zoom: 1 / dpr,
    transparent: true,
    banner: false,
    autoFocus: false,
    input: false,
    audio: { noAudio: true },
    fps: { target: 60, smoothStep: false },
    render: { antialias: true, antialiasGL: false, roundPixels: false },
    scene,
  });
  const resize = new ResizeObserver(() => {
    const next = size();
    if (
      game.scale &&
      (next.width !== game.scale.width || next.height !== game.scale.height)
    ) {
      game.scale.resize(next.width, next.height);
      scene.invalidateLayout();
    }
  });
  resize.observe(host);
  return {
    game,
    destroy() {
      resize.disconnect();
      // destroy is processed on the next engine frame, including when hidden/sleeping.
      game.destroy(true);
      if (game.isBooted) game.loop.wake();
    },
  };
}

export class CatScene extends Phaser.Scene {
  private blocks: Phaser.GameObjects.Image[] = [];
  private cats: Phaser.GameObjects.Image[] = [];
  private cargo: Phaser.GameObjects.Image[] = [];
  private background!: Phaser.GameObjects.Image;
  private backdrop!: Phaser.Textures.CanvasTexture;
  private previous: GameState | null = null;
  private levelKey = "";
  private layout: Layout = { cell: 1, ox: 0, oy: 0 };
  private pixels = new Map<number, Pixel>();
  private dirty = true;
  private motionTime = 0;
  private routes = new Map<
    number,
    {
      source: GameState["ants"][number]["route"];
      paths: ReturnType<typeof catPaths>;
    }
  >();

  constructor(
    private readonly frame: Update,
    private readonly dpr: number,
  ) {
    super({ key: "cats", plugins: [] });
  }
  create() {
    createAtlas(this);
    this.backdrop = this.textures.createCanvas("cat-backdrop", 1, 1)!;
    this.background = this.add
      .image(0, 0, "cat-backdrop")
      .setOrigin(0)
      .setDepth(-1);
    for (let i = 0; i < MAX_ACTIVE_ANTS; i++) {
      this.cats.push(
        this.add
          .image(0, 0, "cat-atlas", "cat-gold-0")
          .setDepth(2)
          .setVisible(false),
      );
      this.cargo.push(
        this.add
          .image(0, 0, "cat-atlas", "block-gold-false")
          .setDepth(3)
          .setVisible(false),
      );
    }
    this.game.canvas.dataset.renderer =
      this.game.renderer.type === Phaser.WEBGL
        ? "phaser-webgl"
        : "phaser-canvas";
    this.game.canvas.setAttribute("role", "img");
  }
  invalidateLayout() {
    this.dirty = true;
  }
  update(now: number, delta: number) {
    const { state, reducedMotion, animate } = this.frame(now, delta);
    if (animate) this.motionTime += Math.min(delta, 100);
    const key = `${state.difficulty}:${state.level}`;
    if (key !== this.levelKey || this.dirty) this.rebuild(state, key);
    if (state !== this.previous) this.syncBlocks(state);
    this.syncCats(state, reducedMotion);
    this.previous = state;
  }
  private rebuild(state: GameState, key: string) {
    this.levelKey = key;
    this.dirty = false;
    this.previous = null;
    this.routes.clear();
    const w = this.scale.width,
      h = this.scale.height;
    this.layout = artworkLayout(state.pixels, w, h);
    this.pixels = new Map(state.pixels.map((pixel) => [pixel.id, pixel]));
    this.backdrop.setSize(w, h);
    const ctx = this.backdrop.context;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    paintBackdrop(ctx, w / this.dpr, h / this.dpr);
    ctx.restore();
    const { cell, ox, oy } = this.layout;
    for (const pixel of state.pixels) {
      ctx.fillStyle = "#827e6e30";
      ctx.fillRect(
        ox + (pixel.x + 0.5) * cell,
        oy + (pixel.y + 0.5) * cell,
        this.dpr,
        this.dpr,
      );
    }
    this.backdrop.refresh();
    this.background.setTexture("cat-backdrop").setDisplaySize(w, h);
    while (this.blocks.length < state.pixels.length)
      this.blocks.push(
        this.add.image(0, 0, "cat-atlas", "block-gold-false").setOrigin(0),
      );
    this.blocks.forEach((block, index) => {
      const pixel = state.pixels[index];
      block.setVisible(!!pixel);
      if (pixel)
        block
          .setPosition(ox + pixel.x * cell, oy + pixel.y * cell)
          .setDisplaySize(cell, cell);
    });
  }
  private syncBlocks(state: GameState) {
    const exposed = new Set(exposedIds(state));
    state.pixels.forEach((pixel, index) => {
      const visible = pixel.status === "present" || pixel.status === "reserved";
      const block = this.blocks[index];
      block.setVisible(visible);
      if (visible) {
        const frame = `block-${pixel.color}-${exposed.has(pixel.id)}`;
        if (block.frame.name !== frame) block.setFrame(frame);
      }
    });
    this.game.canvas.setAttribute(
      "aria-label",
      `Pixel artwork: ${state.collected} of ${state.total} blocks collected`,
    );
  }
  private syncCats(state: GameState, reduced: boolean) {
    const { cell } = this.layout;
    const w = this.scale.width,
      h = this.scale.height;
    const alive = new Set(state.ants.map((cat) => cat.id));
    for (const id of this.routes.keys())
      if (!alive.has(id)) this.routes.delete(id);
    for (let i = 0; i < MAX_ACTIVE_ANTS; i++) {
      const cat = state.ants[i],
        sprite = this.cats[i],
        cargo = this.cargo[i];
      sprite.setVisible(!!cat);
      cargo.setVisible(!!cat && cat.phase === "return");
      if (!cat) continue;
      const pixel = this.pixels.get(cat.pixelId)!;
      const departureDelay = cat.phase === "outbound" ? (cat.id % 4) * 40 : 0;
      const walkingDuration =
        cat.phase === "outbound"
          ? cat.durationMs - 120 - departureDelay
          : cat.durationMs;
      const progress = Math.max(
        0,
        Math.min(1, (cat.elapsedMs - departureDelay) / walkingDuration),
      );
      const returning = cat.phase === "return";
      let cached = this.routes.get(cat.id);
      if (!cached || cached.source !== cat.route) {
        cached = {
          source: cat.route,
          paths: catPaths(
            cat.route,
            cat.slotIndex,
            this.layout,
            w,
            h,
            this.dpr,
          ),
        };
        this.routes.set(cat.id, cached);
      }
      const { x, y, direction } = walkPosition(
        returning ? cached.paths.returning : cached.paths.outbound,
        progress,
      );
      const arrival =
        returning && !reduced
          ? Math.max(
              0,
              1 - Math.hypot(x - w / 2, y - h * 0.885) / (20 * this.dpr),
            )
          : 0;
      const scale = 1 - arrival * 0.85,
        alpha = 1 - arrival * 0.7;
      const step = reduced
        ? 0
        : 1 + (Math.floor(this.motionTime / 100 + cat.id) % 2);
      sprite
        .setFrame(`cat-${pixel.color}-${step}`)
        .setPosition(x, y)
        .setFlipX(direction === 0 ? sprite.flipX : direction < 0)
        .setScale(this.dpr * scale)
        .setAlpha(alpha);
      if (returning) {
        const size =
          Math.max(8 * this.dpr, Math.min(11 * this.dpr, cell * 0.8)) * scale;
        cargo
          .setFrame(`block-${pixel.color}-false`)
          .setPosition(x, y - 14 * this.dpr * scale)
          .setDisplaySize(size, size)
          .setAlpha(alpha);
      }
    }
  }
}

function artworkLayout(pixels: Pixel[], width: number, height: number): Layout {
  const minX = Math.min(...pixels.map((pixel) => pixel.x));
  const minY = Math.min(...pixels.map((pixel) => pixel.y));
  const columns = Math.max(...pixels.map((pixel) => pixel.x)) - minX + 1;
  const rows = Math.max(...pixels.map((pixel) => pixel.y)) - minY + 1;
  const cell = Math.min((width * 0.82) / columns, (height * 0.66) / rows);
  return {
    cell,
    ox: (width - cell * columns) / 2 - minX * cell,
    oy: height * 0.035 + (height * 0.68 - cell * rows) / 2 - minY * cell,
  };
}
