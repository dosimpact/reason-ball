// Readable configuration inventory; normal builds never read sample music.
import { mkdir, writeFile, access } from 'node:fs/promises'
import { SCENE_EFFECTS, validateSceneEffects } from '../src/pages/focus/model/sceneEffects.ts'
import { ALL_BACKGROUNDS, validateBackgrounds } from '../src/pages/focus/model/backgrounds.ts'
import { PREMIUM_SPACES, validatePremiumSpaces } from '../src/pages/focus/model/premiumSpaces.ts'
import { sceneAssetUrl } from '../src/pages/focus/lib/sceneAsset.ts'
import { PREMIUM_EXPERIENCES } from '../src/pages/focus/model/premiumExperience.ts'
import { SCENE_WEATHER, getSceneWeather } from '../src/pages/focus/model/sceneWeather.ts'
const errors = [
  ...validateSceneEffects(),
  ...validateBackgrounds(ALL_BACKGROUNDS),
  ...validatePremiumSpaces(),
]
if (errors.length) throw new Error(`Scene effect catalog: ${errors.join(', ')}`)
for (const config of Object.values(SCENE_EFFECTS)) await access(`public${config.assetPath}`)
await mkdir('../../artifacts/scene-effects', { recursive: true })
await writeFile(
  '../../artifacts/scene-effects/catalog.json',
  JSON.stringify(
    Object.values(SCENE_EFFECTS).map((scene) => ({
      ...scene,
      precipitation: getSceneWeather(scene.id),
    })),
    null,
    2,
  ),
)
console.log(`Scene effects validated/exported: ${Object.keys(SCENE_EFFECTS).length} spaces`)

// The legacy effect inventory remains the original 38; premium art has its own geometry.
for (const space of PREMIUM_SPACES)
  for (const resolution of ['thumbnail', 'normal', 'fullscreen'] as const)
    await access(`public${sceneAssetUrl(space.id, resolution)}`)
await writeFile(
  '../../artifacts/scene-effects/premium-catalog.json',
  JSON.stringify(PREMIUM_SPACES, null, 2),
)
console.log(`Premium catalog validated/exported: ${PREMIUM_SPACES.length} open spaces`)
const motionIds = new Set<string>()
for (const space of PREMIUM_SPACES) {
  const motions = PREMIUM_EXPERIENCES[space.id]
  if (!motions || motions.length < 4) throw new Error(`Missing premium motions: ${space.id}`)
  for (const motion of motions) {
    if (motionIds.has(motion.id)) throw new Error(`Duplicate premium motion: ${motion.id}`)
    motionIds.add(motion.id)
  }
}
await writeFile(
  '../../artifacts/scene-effects/premium-experiences.json',
  JSON.stringify(PREMIUM_EXPERIENCES, null, 2),
)
console.log(`Premium signature motions validated/exported: ${motionIds.size}`)
if (
  ALL_BACKGROUNDS.some((space) => !Object.hasOwn(SCENE_WEATHER, space.id)) ||
  Object.keys(SCENE_WEATHER).length !== ALL_BACKGROUNDS.length
)
  throw new Error('Weather catalog must cover exactly every scene')
await writeFile(
  '../../artifacts/scene-effects/weather-catalog.json',
  JSON.stringify(SCENE_WEATHER, null, 2),
)
