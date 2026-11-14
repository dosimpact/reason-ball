// Static SVG character proof, not a browser screenshot.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const out = fileURLToPath(new URL('../../../artifacts/characters/', import.meta.url))
await mkdir(out, { recursive: true })
const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
try {
  const { default: Companions } = await server.ssrLoadModule(
    '/src/pages/focus/ui/SceneCompanions.tsx',
  )
  const { BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  const layers = []
  let index = 0
  for (const bg of BACKGROUNDS.filter((b) => b.companions)) {
    const svg = renderToStaticMarkup(
      createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: 600,
          height: 280,
          viewBox: '100 400 600 280',
        },
        createElement('rect', { x: 100, y: 400, width: 600, height: 280, fill: '#242a24' }),
        createElement(Companions, { background: bg, withTable: ![35, 36].includes(bg.scene) }),
      ),
    )
    const png = await sharp(Buffer.from(svg)).resize(600, 280).png().toBuffer()
    await writeFile(`${out}/${bg.id}.png`, png)
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="32"><rect width="600" height="32" fill="#181818"/><text x="12" y="22" fill="#ddd" font-family="sans-serif" font-size="15">${bg.id}${[35, 36].includes(bg.scene) ? ' · isolated cast (scene furniture omitted)' : ''}</text></svg>`,
    )
    const x = (index % 3) * 600,
      y = Math.floor(index / 3) * 312
    layers.push({ input: png, left: x, top: y }, { input: label, left: x, top: y + 280 })
    index++
  }
  await sharp({
    create: { width: 1800, height: Math.ceil(index / 3) * 312, channels: 4, background: '#181818' },
  })
    .composite(layers)
    .png()
    .toFile(`${out}/cast-contact-sheet.png`)
  console.log(`Character crops: ${out}; ${index} populated rooms`)
} finally {
  await server.close()
}
