// Static artwork QA: these files are SVG render previews, NOT browser screenshots.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const out = '../../artifacts/backgrounds'
await mkdir(out, { recursive: true })
const server = await createServer({
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
try {
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { BACKGROUNDS, BACKGROUND_CATEGORIES } = await server.ssrLoadModule(
    '/src/pages/focus/model/backgrounds.ts',
  )
  const layers = []
  const additionalLayers = []
  const cafeLayers = []
  const manifest = []
  const width = 300,
    height = 270
  const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  for (let index = 0; index < BACKGROUNDS.length; index++) {
    const background = BACKGROUNDS[index]
    const markup = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: background.id, thumbnail: true }),
    )
    const artwork = [...markup.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0])
    let svg = artwork[0]
    // Compose the decorative rain SVG into the same artwork coordinates for static QA.
    for (const overlay of artwork.slice(1)) {
      const content = overlay.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
      svg = svg.replace(/<\/svg>$/, `<g opacity=".36">${content}</g></svg>`)
    }
    if (!svg) throw new Error(`Missing SVG: ${background.id}`)
    if (!svg.includes('xmlns='))
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    await writeFile(`${out}/${background.id}.svg`, svg)
    const image = await sharp(Buffer.from(svg))
      .resize(width, 220, { fit: 'cover' })
      .png()
      .toBuffer()
    await writeFile(`${out}/${background.id}.png`, image)
    const column = index % 5,
      row = Math.floor(index / 5)
    layers.push({ input: image, left: column * width, top: row * height })
    const title = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="50"><rect width="300" height="50" fill="#181818"/><text x="12" y="22" fill="#f5f5f5" font-family="Arial, sans-serif" font-size="14">${String(index + 1).padStart(2, '0')} · ${escape(background.name)}</text><text x="12" y="40" fill="#999" font-family="Arial, sans-serif" font-size="10">${escape(BACKGROUND_CATEGORIES.find((c) => c.id === background.category)?.name || background.category)}</text></svg>`,
    )
    layers.push({ input: title, left: column * width, top: row * height + 220 })
    if (background.scene >= 30 && background.scene < 35) {
      const left = (background.scene - 30) * width
      additionalLayers.push({ input: image, left, top: 0 }, { input: title, left, top: 220 })
    }
    if (background.scene === 35 || background.scene === 36) {
      const left = (background.scene - 35) * width
      cafeLayers.push({ input: image, left, top: 0 }, { input: title, left, top: 220 })
    }
    manifest.push({
      id: background.id,
      name: background.name,
      category: background.category,
      file: `${background.id}.png`,
    })
  }
  await sharp({
    create: {
      width: width * 5,
      height: height * Math.ceil(BACKGROUNDS.length / 5),
      channels: 4,
      background: '#000',
    },
  })
    .composite(layers)
    .png()
    .toFile(`${out}/all-${BACKGROUNDS.length}-backgrounds.png`)
  if (additionalLayers.length)
    await sharp({
      create: {
        width: width * (additionalLayers.length / 2),
        height,
        channels: 4,
        background: '#000',
      },
    })
      .composite(additionalLayers)
      .png()
      .toFile(`${out}/additional-5-backgrounds.png`)
  if (cafeLayers.length)
    await sharp({
      create: { width: width * (cafeLayers.length / 2), height, channels: 4, background: '#000' },
    })
      .composite(cafeLayers)
      .png()
      .toFile(`${out}/additional-2-cafes.png`)
  await writeFile(
    `${out}/manifest.json`,
    JSON.stringify(
      { type: 'static SVG artwork renders; not browser screenshots', backgrounds: manifest },
      null,
      2,
    ),
  )
  console.log(`Rendered ${manifest.length} distinct background previews into ${out}`)
} finally {
  await server.close()
}
