import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

// Start the project's dev server first. No production diagnostics or state injection API is exposed.
const url = process.env.CAT_BENCH_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  const result = await page.evaluate(async () => {
    const { createRenderer } = await import("/src/widgets/game/renderer.ts");
    const { createGame, tickGame, deployBox, getHintLane } =
      await import("/src/entities/game/index.ts");
    let state = createGame(100, "hard"),
      peak = state;
    for (let i = 0; i < 500; i++) {
      const lane = getHintLane(state);
      if (lane !== null) state = deployBox(state, lane);
      state = tickGame(state, 25);
      if (state.ants.length > peak.ants.length) peak = state;
    }
    const results = [];
    for (const count of [peak.ants.length, 24]) {
      // The 24-cat case stresses only presentation, with duplicated carriers, not game-rule validity.
      const snapshot = {
        ...peak,
        ants: Array.from({ length: count }, (_, i) => ({
          ...peak.ants[i % peak.ants.length],
          id: i,
        })),
      };
      const host = document.createElement("div");
      host.style.cssText =
        "position:fixed;top:0;left:0;width:344px;height:304px";
      document.body.append(host);
      const runtime = createRenderer(host, () => ({
        state: snapshot,
        reducedMotion: false,
        animate: true,
      }));
      const deadline = performance.now() + 10000;
      while (!host.querySelector("canvas")?.dataset.renderer) {
        if (performance.now() > deadline)
          throw new Error("Renderer boot timed out");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const renderer = host.querySelector("canvas").dataset.renderer;
      runtime.game.loop.sleep();
      const samples = [];
      for (let i = 0; i < 650; i++) {
        const start = performance.now();
        runtime.game.step(i * 16.67, 16.67);
        if (i >= 50) samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      const scene = runtime.game.scene.getScene("cats");
      const objectsBefore = scene.children.length;
      // Resets must reuse the pool, not grow the Scene display list.
      for (let i = 0; i < 10; i++) {
        scene.invalidateLayout();
        runtime.game.step(11000 + i * 16.67, 16.67);
      }
      if (scene.children.length !== objectsBefore)
        throw new Error("Display list grew after rebuilds");
      results.push({
        renderer,
        cats: count,
        pixels: snapshot.pixels.length,
        samples: samples.length,
        meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
        p95Ms: samples[Math.floor(samples.length * 0.95)],
        maxMs: samples.at(-1),
        pooledDisplayObjects: objectsBefore,
      });
      runtime.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (host.querySelector("canvas"))
        throw new Error("Renderer canvas survived destroy");
      host.remove();
    }
    return {
      date: new Date().toISOString(),
      browser: navigator.userAgent,
      dpr: devicePixelRatio,
      width: 344,
      height: 304,
      note: "CPU Scene update and render submission only; excludes boot and GPU completion. 24 cats is synthetic presentation stress.",
      results,
    };
  });
  const json = JSON.stringify(result, null, 2);
  console.log(json);
  writeFileSync("docs/flow/evidence/phaser-render-benchmark.json", `${json}\n`);
} finally {
  await browser.close();
}
