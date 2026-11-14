import { getSceneWorld, SCENE_WORLD_BOUNDS } from '../model/sceneWorldCatalog.ts'
import { renovatedWorldContent } from './sceneWorldArchitecture.ts'

/** Shared native/fallback room architecture, with source-aligned materials and explicit room plans.
 * All paths are baked into positive coordinates for the installed Pixi SVGParser. */
export function sceneWorldSvg(id: string, layer: 'underlay' | 'joinery' = 'underlay'): string {
  const world = getSceneWorld(id),
    bounds = SCENE_WORLD_BOUNDS
  const content = renovatedWorldContent({ world, plan: world.renovation, edge: world.edge }, layer)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}" data-world-id="${world.id}" data-world-layer="${layer}" data-world-detail="${world.detail}" data-room-envelope="${world.renovation.envelope}" data-room-foreground="${world.renovation.foreground}">${content}</svg>`
}
