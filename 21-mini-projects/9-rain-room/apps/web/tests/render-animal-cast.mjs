// Static SVG animal proof; not a browser screenshot.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url)),
  out = fileURLToPath(new URL('../../../artifacts/animals/', import.meta.url))
await mkdir(out, { recursive: true })
const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
try {
  const { default: Wild } = await server.ssrLoadModule('/src/pages/focus/ui/SceneWildlife.tsx')
  const { default: Pets } = await server.ssrLoadModule('/src/pages/focus/ui/ScenePets.tsx')
  const { BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  const { getSceneAnimals } = await server.ssrLoadModule('/src/pages/focus/model/sceneAnimals.ts')
  const layers = []
  let i = 0
  for (const bg of BACKGROUNDS) {
    if (!getSceneAnimals(bg).length) continue
    const markup = renderToStaticMarkup(
      createElement(
        'g',
        null,
        createElement(Wild, { background: bg }),
        createElement(Pets, { background: bg }),
      ),
    )
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 220 800 600"><rect x="0" y="220" width="800" height="600" fill="#273b32"/>${markup}</svg>`
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    await writeFile(`${out}/${bg.id}.png`, png)
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="30"><rect width="400" height="30" fill="#181818"/><text x="8" y="20" fill="#ddd" font-size="13">${bg.id}: ${getSceneAnimals(
        bg,
      )
        .map((a) => a.species)
        .join(', ')}</text></svg>`,
    )
    const x = (i % 4) * 400,
      y = Math.floor(i / 4) * 330
    layers.push({ input: png, left: x, top: y }, { input: label, left: x, top: y + 300 })
    i++
  }
  await sharp({
    create: { width: 1600, height: Math.ceil(i / 4) * 330, channels: 4, background: '#181818' },
  })
    .composite(layers)
    .png()
    .toFile(`${out}/animal-cast.png`)
  console.log(`Rendered ${i} animal proofs into ${out}`)
} finally {
  await server.close()
}
