// Actual inline SVG artwork rasterized for review; never browser screenshots or runtime assets.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(
  new URL('../../../artifacts/drink-illustrations-2026-11-12/', import.meta.url),
)
await mkdir(output, { recursive: true })
const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
const box = (body, width, height) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`,
  )
const tile = (width, height, color) =>
  box(`<rect width="${width}" height="${height}" rx="12" fill="${color}"/>`, width, height)
const geometry = (markup, size) =>
  markup
    .match(/<svg\b[\s\S]*?<\/svg>/)[0]
    .replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`)
try {
  const { default: Cup } = await server.ssrLoadModule('/src/pages/focus/ui/ritual/DrinkCup.tsx')
  const { DRINKS } = await server.ssrLoadModule('/src/pages/focus/model/cafeRitual.ts')
  const art = [],
    small = [],
    vapor = [],
    records = []
  for (const [i, { id }] of DRINKS.entries()) {
    const markup = renderToStaticMarkup(
      createElement(Cup, {
        drinkId: id,
        temperature: id === 'cold-brew' ? 'iced' : 'hot',
        size: 360,
      }),
    )
    const svg = geometry(markup, 360)
    await writeFile(`${output}/${id}.svg`, svg)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    await writeFile(`${output}/${id}.png`, png)
    const left = 20 + (i % 4) * 250,
      top = 70 + Math.floor(i / 4) * 280
    art.push({ input: tile(234, 264, '#222'), left, top })
    art.push({
      input: await sharp(png).resize(224, 224).png().toBuffer(),
      left: left + 5,
      top: top + 2,
    })
    art.push({
      input: box(
        `<text x="117" y="18" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#c7cdbf">${id}</text>`,
        234,
        25,
      ),
      left,
      top: top + 231,
    })
    for (let panel = 0; panel < 2; panel++) {
      const x = 16 + panel * 400 + (i % 4) * 92,
        y = 52 + Math.floor(i / 4) * 120
      small.push({ input: tile(84, 108, panel ? '#f5f5f5' : '#222'), left: x, top: y })
      small.push({
        input: await sharp(Buffer.from(geometry(markup, 68)))
          .png()
          .toBuffer(),
        left: x + 8,
        top: y + 20,
      })
    }
    const vaporX = 20 + (i % 3) * 360,
      vaporY = 60 + Math.floor(i / 3) * 234
    vapor.push({ input: tile(348, 224, '#222'), left: vaporX, top: vaporY })
    for (const [j, temperature] of ['hot', 'iced'].entries()) {
      if (id === 'cold-brew' && temperature === 'hot') continue
      const steaming = geometry(
        renderToStaticMarkup(
          createElement(Cup, {
            drinkId: id,
            temperature,
            size: 180,
            steam: true,
          }),
        ),
        180,
      ).replace(
        /(<svg\b[^>]*>)/,
        '$1<style>.ritual-steam path{opacity:.65}.ritual-aroma path{opacity:.4}</style>',
      )
      vapor.push({
        input: await sharp(Buffer.from(steaming)).png().toBuffer(),
        left: vaporX + j * 168,
        top: vaporY + 5,
      })
    }
    vapor.push({
      input: box(
        `<text x="174" y="15" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#c7cdbf">${id}</text><text x="174" y="30" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#aaa">${id === 'cold-brew' ? 'iced only (right)' : 'hot steam (left) / iced aroma (right)'}</text>`,
        348,
        35,
      ),
      left: vaporX,
      top: vaporY + 184,
    })
    records.push({
      id,
      svg: `${id}.svg`,
      png: `${id}.png`,
      method: 'native inline SVG / no raster references',
    })
  }
  art.push({
    input: box(
      '<text x="20" y="28" font-family="sans-serif" font-size="22" fill="#eee">Rain Room · 10 native SVG drink illustrations</text><text x="20" y="52" font-family="sans-serif" font-size="13" fill="#aaa">Matte cream / sage / earth · actual component art · NOT a browser screenshot</text>',
      1040,
      60,
    ),
    left: 0,
    top: 0,
  })
  await sharp({ create: { width: 1040, height: 916, channels: 4, background: '#181818' } })
    .composite(art)
    .png()
    .toFile(`${output}/all-drinks.png`)
  for (let panel = 0; panel < 2; panel++)
    small.push({
      input: box(
        `<text x="20" y="28" font-family="sans-serif" font-size="15" fill="#eee">68px SVG · ${panel ? 'selected #f5f5f5' : 'default #222'}</text><text x="20" y="451" font-family="sans-serif" font-size="12" fill="#aaa">Artwork proof only · not a browser capture</text>`,
        400,
        470,
      ),
      left: panel * 400,
      top: 0,
    })
  await sharp({ create: { width: 800, height: 470, channels: 4, background: '#181818' } })
    .composite(small)
    .png()
    .toFile(`${output}/small-dark-light.png`)
  vapor.push({
    input: box(
      '<text x="20" y="26" font-family="sans-serif" font-size="22" fill="#eee">Steam-enabled native SVG · 180px</text><text x="20" y="47" font-family="sans-serif" font-size="13" fill="#aaa">Readable static opacity sample · not an animation or browser capture</text>',
      1120,
      55,
    ),
    left: 0,
    top: 0,
  })
  await sharp({ create: { width: 1120, height: 1000, channels: 4, background: '#181818' } })
    .composite(vapor)
    .png()
    .toFile(`${output}/steam-options.png`)

  // Room proofs are optional references from the preceding space review.
  const refs = []
  for (const [i, id] of ['cafe-rain', 'premium-memory-house'].entries()) {
    try {
      const room = await readFile(`${output}/../space-review-2026-11-12/after/${id}-full.png`)
      refs.push({
        input: await sharp(room)
          .resize(500, 400, { fit: 'contain', background: '#181818' })
          .png()
          .toBuffer(),
        left: 20 + i * 500,
        top: 30,
      })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  if (refs.length) {
    refs.push({
      input: await sharp(`${output}/all-drinks.png`).resize(1040, 916).png().toBuffer(),
      left: 0,
      top: 440,
    })
    await sharp({ create: { width: 1040, height: 1356, channels: 4, background: '#181818' } })
      .composite(refs)
      .png()
      .toFile(`${output}/room-style-match.png`)
  }
  await writeFile(
    `${output}/catalog.json`,
    `${JSON.stringify({ method: 'SVG artwork proof, not browser screenshots; room refs are static deployed texture composites', drinks: records }, null, 2)}\n`,
  )
  console.log(`Rendered ${records.length} native SVG drink proofs: ${output}`)
} finally {
  await server.close()
}
