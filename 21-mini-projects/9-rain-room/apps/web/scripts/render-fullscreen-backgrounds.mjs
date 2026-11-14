// Raster compatibility assets from our original SVG artwork; not browser screenshots.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
const output = 'public/backgrounds'
await Promise.all(
  [output, `${output}/thumbnail`, `${output}/rear/normal`, `${output}/rear/fullscreen`].map(
    (path) => mkdir(path, { recursive: true }),
  ),
)
const server = await createServer({
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
try {
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { default: RainOverlay } = await server.ssrLoadModule('/src/pages/focus/ui/RainOverlay.tsx')
  const { BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  for (const scene of BACKGROUNDS) {
    const markup = renderToStaticMarkup(createElement(Cafe, { backgroundId: scene.id }))
    let svg = markup.match(/<svg\b[\s\S]*?<\/svg>/)?.[0]
    if (!svg) throw new Error(`Missing SVG: ${scene.id}`)
    const rearMarkup = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: scene.id, layer: 'rear', artOnly: true }),
    )
    const rearSvg = rearMarkup
      .match(/<svg\b[\s\S]*?<\/svg>/)[0]
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1230"')
    await sharp(Buffer.from(rearSvg)).png().toFile(`${output}/rear/fullscreen/${scene.id}.png`)
    await sharp(Buffer.from(rearSvg))
      .resize(800, 820)
      .png()
      .toFile(`${output}/rear/normal/${scene.id}.png`)
    // Steam is now a live shared overlay, including on iOS; do not bake it twice.
    svg = svg
      .replace(/<g class="steam"[\s\S]*?<\/g>/g, '')
      .replace(/<path class="steam"[^>]*><\/path>/g, '')
      .replace(/<path class="steam"[^>]*\/>/g, '')
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1230"')
    await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(`${output}/${scene.id}.webp`)
    const rainMarkup = renderToStaticMarkup(
      createElement(RainOverlay, { backgroundId: scene.id, static: true }),
    )
    const rain = rainMarkup.replace(
      '<svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="328"',
    )
    const thumbnailMarkup = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: scene.id, thumbnail: true }),
    )
    const thumbnailSvg = thumbnailMarkup
      .match(/<svg\b[\s\S]*?<\/svg>/)[0]
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="328"')
    const small = await sharp(Buffer.from(thumbnailSvg)).resize(320, 328).png().toBuffer()
    await sharp(small)
      .composite([{ input: await sharp(Buffer.from(rain)).png().toBuffer() }])
      .webp({ quality: 80 })
      .toFile(`${output}/thumbnail/${scene.id}.webp`)
  }
  console.log(`Generated ${BACKGROUNDS.length} fullscreen artwork assets at 1200×1230.`)
} finally {
  await server.close()
}
