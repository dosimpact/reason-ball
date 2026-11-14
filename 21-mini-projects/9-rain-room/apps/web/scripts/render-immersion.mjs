// Static SVG/Sharp artwork evidence. These are not browser screenshots or live animation captures.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const out = process.env.SCENE_CAPTURE_DIR ?? '../../artifacts/immersion'
await mkdir(out, { recursive: true })
const server = await createServer({
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
try {
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { default: Atmosphere } = await server.ssrLoadModule(
    '/src/pages/focus/ui/SceneAtmosphere.tsx',
  )
  const { BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  const layers = []
  const manifest = []
  const large = new Set(BACKGROUNDS.map((room) => room.id))
  for (const [index, room] of BACKGROUNDS.entries()) {
    let base = renderToStaticMarkup(createElement(Cafe, { backgroundId: room.id })).match(
      /<svg\b[\s\S]*?<\/svg>/,
    )[0]
    base = base
      .replace(/<g class="steam"[\s\S]*?<\/g>/g, '')
      .replace(/<path class="steam"[^>]*><\/path>/g, '')
      .replace(/<path class="steam"[^>]*\/>/g, '')
    let foreground = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: room.id, layer: 'foreground', artOnly: true }),
    ).match(/<svg\b[\s\S]*?<\/svg>/)[0]
    foreground = foreground
      .replace(/<g class="steam"[\s\S]*?<\/g>/g, '')
      .replace(/<path class="steam"[^>]*><\/path>/g, '')
      .replace(/<path class="steam"[^>]*\/>/g, '')
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '')
    const hashes = []
    for (const phase of [0.2, 0.75]) {
      let svg = base
      let effectMarkup = ''
      // The second SVG contains nested local SVG viewports; parse its full outer markup using happy-dom.
      const { Window } = await import('happy-dom')
      const window = new Window()
      window.document.body.innerHTML = renderToStaticMarkup(
        createElement(Atmosphere, {
          backgroundId: room.id,
          preview: { yawn: false, gust: false, lightning: false },
          detailPhase: phase,
        }),
      )
      for (const overlay of [...window.document.body.children].sort((a, b) =>
        room.scene === 37
          ? Number(a.classList.contains('scene-rain-overlay')) -
            Number(b.classList.contains('scene-rain-overlay'))
          : 0,
      )) {
        if (overlay.tagName.toLowerCase() !== 'svg') continue
        let content = overlay.innerHTML
        effectMarkup += content
        svg = svg.replace(/<\/svg>$/, `${content}</svg>`)
      }
      await window.happyDOM.abort()
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      if (process.env.SCENE_RUNTIME_PROOF === '1' && phase === 0.75) {
        const bitmap = (
          await sharp(await readFile(`public/backgrounds/rear/normal/${room.id}.png`))
            .png()
            .toBuffer()
        ).toString('base64')
        const runtime = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 820"><image href="data:image/png;base64,${bitmap}" width="800" height="820"/>${foreground}${effectMarkup}</svg>`
        await sharp(Buffer.from(runtime))
          .resize(800, 820)
          .png()
          .toFile(`${out}/${room.id}-runtime-large.png`)
        await sharp(Buffer.from(runtime))
          .resize(342, 240, { fit: 'cover' })
          .png()
          .toFile(`${out}/${room.id}-runtime-mobile.png`)
      }
      if (
        (phase === 0.75 || room.scene === 37) &&
        [
          'cafe-rain',
          'cafe-rain-dome',
          'study-linen',
          'cafe-neon-night',
          'water-moon',
          'water-lake',
          'water-velvet-tide',
        ].includes(room.id)
      ) {
        const bitmap = (
          await sharp(await readFile(`public/backgrounds/rear/fullscreen/${room.id}.png`))
            .png()
            .toBuffer()
        ).toString('base64')
        const raster = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 820"><image href="data:image/png;base64,${bitmap}" width="800" height="820"/>${foreground}${effectMarkup}</svg>`
        await sharp(Buffer.from(raster))
          .resize(800, 820)
          .png()
          .toFile(`${out}/${room.id}-raster-large.png`)
        if (room.scene === 37) {
          await sharp(Buffer.from(raster))
            .resize(800, 820)
            .png()
            .toFile(`${out}/neon-${phase === 0.2 ? 'dim' : 'bright'}-raster-large.png`)
          await sharp(Buffer.from(raster))
            .resize(342, 240, { fit: 'cover' })
            .png()
            .toFile(`${out}/neon-${phase === 0.2 ? 'dim' : 'bright'}-raster-mobile.png`)
        }
        await sharp(Buffer.from(raster))
          .resize(342, 240, { fit: 'cover' })
          .png()
          .toFile(`${out}/${room.id}-raster-mobile.png`)
      }
      if (room.scene === 37)
        await sharp(Buffer.from(svg))
          .png()
          .toFile(`${out}/neon-${phase === 0.2 ? 'dim' : 'bright'}-large.png`)
      const image = await sharp(Buffer.from(svg))
        .resize(342, 240, { fit: 'cover' })
        .png()
        .toBuffer()
      hashes.push(createHash('sha256').update(image).digest('hex'))
      if (room.scene === 37)
        await writeFile(`${out}/neon-${phase === 0.2 ? 'dim' : 'bright'}-mobile.png`, image)
      if (phase === 0.75) {
        await writeFile(`${out}/${room.id}-mobile.png`, image)
        layers.push({
          input: await sharp(image).resize(300, 210).png().toBuffer(),
          left: (index % 5) * 300,
          top: Math.floor(index / 5) * 245,
        })
        if (large.has(room.id)) {
          await writeFile(`${out}/${room.id}.svg`, svg)
          await sharp(Buffer.from(svg)).png().toFile(`${out}/${room.id}-large.png`)
        }
      }
      if (large.has(room.id)) await writeFile(`${out}/${room.id}-phase-${phase}.png`, image)
    }
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="35"><rect width="300" height="35" fill="#171b18"/><text x="9" y="23" font-family="Arial" font-size="12" fill="#dedbd0">${index + 1}. ${room.name}</text></svg>`,
    )
    layers.push({ input: label, left: (index % 5) * 300, top: Math.floor(index / 5) * 245 + 210 })
    manifest.push({ id: room.id, phasePixelsDiffer: hashes[0] !== hashes[1], hashes })
  }
  await sharp({
    create: {
      width: 1500,
      height: Math.ceil(BACKGROUNDS.length / 5) * 245,
      channels: 4,
      background: '#101510',
    },
  })
    .composite(layers)
    .png()
    .toFile(`${out}/all-${BACKGROUNDS.length}-dynamic-details.png`)
  if (process.env.SCENE_RUNTIME_PROOF === '1') {
    const runtimeLayers = []
    const rearLayers = []
    for (const [index, room] of BACKGROUNDS.entries()) {
      await sharp(`public/backgrounds/rear/normal/${room.id}.png`)
        .png()
        .toFile(`${out}/${room.id}-rear-large.png`)
      await sharp(`public/backgrounds/rear/normal/${room.id}.png`)
        .resize(342, 240, { fit: 'cover' })
        .png()
        .toFile(`${out}/${room.id}-rear-mobile.png`)
      rearLayers.push({
        input: await sharp(`${out}/${room.id}-rear-mobile.png`).resize(300, 210).png().toBuffer(),
        left: (index % 5) * 300,
        top: Math.floor(index / 5) * 245,
      })
      runtimeLayers.push({
        input: await sharp(`${out}/${room.id}-runtime-mobile.png`)
          .resize(300, 210)
          .png()
          .toBuffer(),
        left: (index % 5) * 300,
        top: Math.floor(index / 5) * 245,
      })
      runtimeLayers.push({
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="35"><rect width="300" height="35" fill="#171b18"/><text x="9" y="23" font-family="Arial" font-size="12" fill="#dedbd0">${index + 1}. ${room.name}</text></svg>`,
        ),
        left: (index % 5) * 300,
        top: Math.floor(index / 5) * 245 + 210,
      })
    }
    rearLayers.push(...runtimeLayers.filter((_, index) => index % 2 === 1))
    await sharp({
      create: {
        width: 1500,
        height: Math.ceil(BACKGROUNDS.length / 5) * 245,
        channels: 4,
        background: '#101510',
      },
    })
      .composite(rearLayers)
      .png()
      .toFile(`${out}/all-${BACKGROUNDS.length}-rear.png`)
    await sharp({
      create: {
        width: 1500,
        height: Math.ceil(BACKGROUNDS.length / 5) * 245,
        channels: 4,
        background: '#101510',
      },
    })
      .composite(runtimeLayers)
      .png()
      .toFile(`${out}/all-${BACKGROUNDS.length}-runtime.png`)
  }
  await writeFile(
    `${out}/preview-manifest.json`,
    JSON.stringify(
      { type: 'SSR SVG/Sharp static preview phases; not browser screenshots', rooms: manifest },
      null,
      2,
    ),
  )
  console.log(
    `Rendered ${manifest.length} rooms, changed phase pixels ${manifest.filter((room) => room.phasePixelsDiffer).length}; ${out}`,
  )
} finally {
  await server.close()
}
