// Original SVG artwork QA/assets. These PNGs are static renders, NOT browser screenshots.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const output = `${root}/public/backgrounds`,
  proof = fileURLToPath(new URL('../../../artifacts/premium-scenes/', import.meta.url))
await Promise.all(
  [proof, `${output}/rear/normal`, `${output}/rear/fullscreen`, `${output}/thumbnail`].map((path) =>
    mkdir(path, { recursive: true }),
  ),
)
const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
try {
  const { default: Scene } = await server.ssrLoadModule(
    '/src/pages/focus/ui/premium/PremiumScene.tsx',
  )
  const { PREMIUM_SPACES } = await server.ssrLoadModule('/src/pages/focus/model/premiumSpaces.ts')
  const { PREMIUM_EXPERIENCES } = await server.ssrLoadModule(
    '/src/pages/focus/model/premiumExperience.ts',
  )
  const layers = [],
    manifest = []
  for (const [index, space] of PREMIUM_SPACES.entries()) {
    const render = (layer, coffeeCount = 0) =>
      renderToStaticMarkup(
        createElement(Scene, { spaceId: space.id, layer, static: true, coffeeCount }),
      ).replace('<svg', '<svg width="800" height="820"')
    const rear = render('rear'),
      all = render('all'),
      foreground = render('foreground')
    if (/data-premium-(?:person|animal|object)=/.test(rear))
      throw Error(`Living cast or indoor objects baked into ${space.id} rear`)
    if (/data-premium-motion=/.test(rear)) throw Error(`Motion baked into ${space.id} rear`)
    const motions = PREMIUM_EXPERIENCES[space.id]
    if (!motions || motions.length < 4) throw Error(`Missing signature motions for ${space.id}`)
    for (const motion of motions) {
      if (!foreground.includes(`data-premium-motion="${motion.id}"`))
        throw Error(`Signature ${motion.id} absent from runtime foreground`)
    }
    await writeFile(`${proof}/${space.id}-rear.svg`, rear)
    await writeFile(`${proof}/${space.id}-all.svg`, all)
    await writeFile(`${proof}/${space.id}-foreground.svg`, foreground)
    const rearNormal = await sharp(Buffer.from(rear)).png().toBuffer()
    await writeFile(`${output}/rear/normal/${space.id}.png`, rearNormal)
    await sharp(Buffer.from(rear))
      .resize(1200, 1230)
      .png()
      .toFile(`${output}/rear/fullscreen/${space.id}.png`)
    await sharp(Buffer.from(all))
      .resize(320, 328)
      .webp({ quality: 80 })
      .toFile(`${output}/thumbnail/${space.id}.webp`)
    await writeFile(
      `${proof}/${space.id}-large.png`,
      await sharp(Buffer.from(all)).png().toBuffer(),
    )
    await sharp(Buffer.from(all))
      .resize(342, 359, { fit: 'cover' })
      .png()
      .toFile(`${proof}/${space.id}-mobile.png`)
    await writeFile(`${proof}/${space.id}-rear.png`, rearNormal)
    const thumb = await sharp(Buffer.from(all)).resize(300, 260, { fit: 'cover' }).png().toBuffer()
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="45"><rect width="300" height="45" fill="#181818"/><text x="10" y="19" fill="#eee" font-family="Arial,sans-serif" font-size="12">${index + 1}. ${space.name}</text><text x="10" y="35" fill="#999" font-family="Arial,sans-serif" font-size="9">${space.id.replace('premium-', '')}</text></svg>`,
    )
    const left = (index % 5) * 300,
      top = Math.floor(index / 5) * 305
    layers.push({ input: thumb, left, top }, { input: label, left, top: top + 260 })
    manifest.push({
      id: space.id,
      name: space.name,
      rear: 'fixed landscape, architecture and floor only',
      proof: `${space.id}-large.png`,
      mobile: `${space.id}-mobile.png`,
      signatureMotions: motions.map(({ id, label }) => ({ id, label })),
    })
    console.log(`Rendered ${index + 1}/30 ${space.id}`)
  }
  await sharp({ create: { width: 1500, height: 1830, channels: 4, background: '#181818' } })
    .composite(layers)
    .png()
    .toFile(`${proof}/contact-sheet.png`)
  for (const id of ['premium-personal-roastery', 'premium-memory-house']) {
    const svg = renderToStaticMarkup(
      createElement(Scene, { spaceId: id, layer: 'all', static: true, coffeeCount: 25 }),
    ).replace('<svg', '<svg width="800" height="820"')
    await sharp(Buffer.from(svg)).png().toFile(`${proof}/${id}-collection25.png`)
  }
  await writeFile(
    `${proof}/manifest.json`,
    JSON.stringify(
      {
        method: 'Static React SSR + Sharp SVG rendering; not browser screenshots',
        generatedAt: new Date().toISOString(),
        spaces: manifest,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Premium artwork complete: ${manifest.length} rooms; proof ${proof}`)
} finally {
  await server.close()
}
