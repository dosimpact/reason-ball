// Refresh the actual picker/loading/legacy assets for the eight renovated rooms only.
// These are deterministic React SVG + Sharp assets, never browser/GPU screenshots.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { AUTUMN_SPACES } from '../src/pages/focus/model/sceneAutumn.ts'

const web = fileURLToPath(new URL('../', import.meta.url))
const proof = fileURLToPath(
  new URL('../../../artifacts/autumn-spaces-2026-11-13/', import.meta.url),
)
const output = `${web}/public/backgrounds`
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const dom = new Window()
sharp.cache(false)
sharp.concurrency(1)
await mkdir(proof, { recursive: true })
for (const dir of [
  output,
  `${output}/thumbnail`,
  `${output}/rear/normal`,
  `${output}/rear/fullscreen`,
])
  await mkdir(dir, { recursive: true })
const server = await createServer({
  root: web,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
const records = []
function firstSvg(markup) {
  const holder = dom.document.createElement('div')
  holder.innerHTML = markup
  const node = holder.querySelector('svg')
  if (!node) throw new Error('Missing source artwork SVG')
  node.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  node.setAttribute('width', '800')
  node.setAttribute('height', '820')
  return node.outerHTML
}
async function save(relative, bytes) {
  await writeFile(`${output}/${relative}`, bytes)
  return { path: `public/backgrounds/${relative}`, sha256: hash(bytes), bytes: bytes.length }
}
try {
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { default: Rain } = await server.ssrLoadModule('/src/pages/focus/ui/RainOverlay.tsx')
  const { getPremiumSpace } = await server.ssrLoadModule('/src/pages/focus/model/premiumSpaces.ts')
  for (const room of AUTUMN_SPACES) {
    const render = (layer) =>
      firstSvg(
        renderToStaticMarkup(
          createElement(Cafe, {
            backgroundId: room.id,
            layer,
            artOnly: true,
            thumbnail: true,
            paused: true,
          }),
          { identifierPrefix: `autumn-${room.id}-${layer}-` },
        ),
      )
    const all = Buffer.from(render('all'))
    const rear = Buffer.from(render('rear'))
    const outputs = []
    outputs.push(await save(`rear/normal/${room.id}.png`, await sharp(rear).png().toBuffer()))
    outputs.push(
      await save(
        `rear/fullscreen/${room.id}.png`,
        await sharp(rear, { density: 108 }).png().toBuffer(),
      ),
    )
    outputs.push(
      await save(
        `${room.id}.webp`,
        await sharp(all, { density: 108 }).webp({ quality: 86 }).toBuffer(),
      ),
    )
    let thumbnail = await sharp(all).resize(320, 328).png().toBuffer()
    if (!getPremiumSpace(room.id)) {
      const rain = firstSvg(
        renderToStaticMarkup(
          createElement(Rain, { backgroundId: room.id, static: true, paused: true }),
        ),
      )
      const drops = await sharp(Buffer.from(rain)).resize(320, 328).png().toBuffer()
      thumbnail = await sharp(thumbnail)
        .composite([{ input: drops }])
        .png()
        .toBuffer()
    }
    outputs.push(
      await save(
        `thumbnail/${room.id}.webp`,
        await sharp(thumbnail).webp({ quality: 80 }).toBuffer(),
      ),
    )
    records.push({ id: room.id, season: room.season, outputs })
    console.log(`Autumn compatibility assets: ${room.id}`)
  }
  const sources = [
    'src/pages/focus/model/sceneAutumn.ts',
    'src/pages/focus/model/backgrounds.ts',
    'src/pages/focus/model/premiumSpaces.ts',
    'src/pages/focus/model/sceneWeather.ts',
    'src/pages/focus/ui/AutumnScenery.tsx',
    'src/pages/focus/ui/Cafe.tsx',
    'src/pages/focus/ui/premium/PremiumScene.tsx',
    'src/pages/focus/ui/backgrounds.css',
    'scripts/render-autumn-assets.mjs',
  ]
  const sourceHashes = []
  for (const path of sources)
    sourceHashes.push({ path, sha256: hash(await readFile(`${web}/${path}`)) })
  await writeFile(
    `${proof}/compatibility-assets.json`,
    JSON.stringify(
      {
        method:
          'Static React SVG and Sharp; actual picker/loading/legacy files; not browser/GPU screenshots',
        createdAt: new Date().toISOString(),
        sourceHashes,
        rooms: records,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Refreshed ${records.length} autumn rooms, ${records.length * 4} assets.`)
} finally {
  await server.close()
  await dom.happyDOM.abort()
}
