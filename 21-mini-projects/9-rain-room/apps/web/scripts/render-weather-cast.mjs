// Static SVG/Sharp evidence and ordinary-room thumbnails, never browser screenshots.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const output = process.env.WEATHER_CAPTURE_DIR || '../../artifacts/weather-intensity'
await mkdir(output, { recursive: true })
const server = await createServer({
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
const dom = new Window()
try {
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { default: Premium } = await server.ssrLoadModule(
    '/src/pages/focus/ui/premium/PremiumScene.tsx',
  )
  const { default: Weather } = await server.ssrLoadModule('/src/pages/focus/ui/RainOverlay.tsx')
  const { ALL_BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  const { getSceneWeather } = await server.ssrLoadModule('/src/pages/focus/model/sceneWeather.ts')
  const svgContent = (element) => {
    dom.document.body.innerHTML = renderToStaticMarkup(element)
    const svg = dom.document.querySelector('svg')
    if (!svg) throw new Error('Missing scene SVG')
    return svg.innerHTML
  }
  const labels = {
    rain: '많은 비',
    'heavy-rain': '더 많은 비',
    storm: '폭우',
    sleet: '눈비',
    snow: '펑펑 눈',
  }
  const tiles = [],
    records = []
  for (const [index, room] of ALL_BACKGROUNDS.entries()) {
    const weather = getSceneWeather(room.id)
    let content
    if (room.id.startsWith('premium-')) {
      content = svgContent(createElement(Premium, { spaceId: room.id, static: true }))
    } else {
      const rear = (await readFile(`public/backgrounds/rear/normal/${room.id}.png`)).toString(
        'base64',
      )
      content = `<image href="data:image/png;base64,${rear}" width="800" height="820"/>`
      content += svgContent(
        createElement(Cafe, {
          backgroundId: room.id,
          layer: 'foreground',
          artOnly: true,
          paused: true,
        }),
      )
      content += svgContent(createElement(Weather, { backgroundId: room.id, static: true }))
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820">${content}</svg>`
    const large = await sharp(Buffer.from(svg)).png().toBuffer()
    await writeFile(`${output}/${room.id}-large.png`, large)
    await sharp(large)
      .resize(342, 359, { fit: 'cover' })
      .png()
      .toFile(`${output}/${room.id}-mobile.png`)
    await sharp(large)
      .resize(320, 328)
      .webp({ quality: 80 })
      .toFile(`public/backgrounds/thumbnail/${room.id}.webp`)
    const thumb = await sharp(large).resize(240, 246).png().toBuffer()
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="38"><rect width="240" height="38" fill="#171b1b"/><text x="8" y="15" font-family="sans-serif" font-size="11" fill="#ede3d1">${room.name}</text><text x="8" y="30" font-family="sans-serif" font-size="10" fill="#b9c9d0">${labels[weather]}</text></svg>`,
    )
    const left = (index % 6) * 240,
      top = Math.floor(index / 6) * 284
    tiles.push({ input: thumb, left, top }, { input: label, left, top: top + 246 })
    records.push({ id: room.id, weather, image: `${room.id}-large.png` })
  }
  await sharp({
    create: {
      width: 1440,
      height: Math.ceil(records.length / 6) * 284,
      channels: 4,
      background: '#171b1b',
    },
  })
    .composite(tiles)
    .png()
    .toFile(`${output}/contact-sheet.png`)
  await writeFile(
    `${output}/manifest.json`,
    JSON.stringify(
      {
        method: 'Static React SSR + Sharp, not live animation capture',
        generatedAt: new Date().toISOString(),
        spaces: records,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Rendered ${records.length} weather/cast scenes; all thumbnails refreshed, rear PNGs untouched.`,
  )
} finally {
  await dom.happyDOM.abort()
  await server.close()
}
