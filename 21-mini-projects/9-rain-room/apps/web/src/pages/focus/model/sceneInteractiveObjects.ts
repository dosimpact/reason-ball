import { ALL_BACKGROUNDS } from './backgrounds.ts'
import { STANDARD_SCENE_OBJECTS } from './sceneInteractiveStandard.ts'
import { PREMIUM_SCENE_OBJECTS } from './sceneInteractivePremium.ts'
import { LARGE_STANDARD_SCENE_OBJECTS } from './sceneInteractiveLargeStandard.ts'
import { LARGE_PREMIUM_SCENE_OBJECTS } from './sceneInteractiveLargePremium.ts'
import type { SceneInteractiveObject } from './sceneInteractiveTypes.ts'

/** Room-local, deliberately unannounced discoveries. This is the prop catalog;
 * autonomous animals remain in animalHabitats/animalLife. New rooms need their own
 * authored objects, source supports, three-language labels and finite reactions.
 * Art is additive native vector geometry; preserved core assets are not repainted. */
export const SCENE_INTERACTIVE_OBJECTS: readonly SceneInteractiveObject[] = Object.freeze([
  ...STANDARD_SCENE_OBJECTS,
  ...PREMIUM_SCENE_OBJECTS,
  ...LARGE_STANDARD_SCENE_OBJECTS,
  ...LARGE_PREMIUM_SCENE_OBJECTS,
])

const roomObjects = new Map<string, readonly SceneInteractiveObject[]>()
for (const room of ALL_BACKGROUNDS)
  roomObjects.set(
    room.id,
    Object.freeze(SCENE_INTERACTIVE_OBJECTS.filter((object) => object.roomId === room.id)),
  )
const empty: readonly SceneInteractiveObject[] = Object.freeze([])
const objectById = new Map(SCENE_INTERACTIVE_OBJECTS.map((object) => [object.id, object]))

export function getSceneInteractiveObject(id: string): SceneInteractiveObject | undefined {
  return objectById.get(id)
}

export function getSceneInteractiveObjects(roomId: string): readonly SceneInteractiveObject[] {
  return roomObjects.get(roomId) ?? empty
}
