import { fitScene, type SceneFraming } from './pixiScene.ts'
import { SCENE_WORLD_BOUNDS } from './sceneWorldCatalog.ts'
export type SceneWorldFrame = SceneFraming & {
  worldX: number
  worldY: number
  worldWidth: number
  worldHeight: number
  viewportWorld: { x: number; y: number; width: number; height: number }
}
/** Keep the original composition intact where possible and show actual surrounding world. */
export function frameSceneWorld(width: number, height: number, _id?: string): SceneWorldFrame {
  const fit = fitScene(width, height)
  const bounds = SCENE_WORLD_BOUNDS
  const scale = Math.max(fit.scale, width / bounds.width, height / bounds.height)
  if (
    ![scale * bounds.width, scale * bounds.height].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new RangeError('World camera exceeds numeric bounds')
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const x = clamp(
    (width - 800 * scale) / 2,
    width - (bounds.x + bounds.width) * scale,
    -bounds.x * scale,
  )
  const y = clamp(
    (height - 820 * scale) / 2,
    height - (bounds.y + bounds.height) * scale,
    -bounds.y * scale,
  )
  return {
    scale,
    x,
    y,
    width: 800 * scale,
    height: 820 * scale,
    worldX: x + bounds.x * scale,
    worldY: y + bounds.y * scale,
    worldWidth: bounds.width * scale,
    worldHeight: bounds.height * scale,
    viewportWorld: { x: -x / scale, y: -y / scale, width: width / scale, height: height / scale },
  }
}
